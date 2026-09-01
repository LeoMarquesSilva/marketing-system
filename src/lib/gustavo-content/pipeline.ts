import { fetchArticleContent } from "@/lib/content-extraction";
import { fetchRssItems, filterItems } from "@/lib/content-roteiros";
import { analyzeScore, generateAngles } from "@/lib/gustavo-content/ai";
import { SCORE_SUGGESTION_FROM } from "@/lib/gustavo-content/constants";
import { findSameFact, type DedupeCandidate } from "@/lib/gustavo-content/dedupe";
import { listRecentForDedupe } from "@/lib/gustavo-content/items";
import { statusFromScore } from "@/lib/gustavo-content/score";
import { GustavoContentError, getGustavoContentAdmin } from "@/lib/gustavo-content/server";
import { listTheses } from "@/lib/gustavo-content/theses-server";
import { thesisSnapshot } from "@/lib/gustavo-content/theses";
import { listTopics } from "@/lib/gustavo-content/topics";
import { pickInstitutionalCandidates } from "@/lib/gustavo-content/institutional-import";
import { preserveArticleText } from "@/lib/gustavo-content/editorial-context";
import { getStrategy } from "@/lib/gustavo-content/strategy-server";

export interface GustavoFetchOptions {
  topicIds?: string[];
  maxCreated?: number;
  fetchArticle?: boolean;
  trigger?: string;
  source?: "rss" | "institutional";
}

export interface GustavoFetchResult {
  itemsSeen: number;
  discardedUnder55: number;
  radarCreated: number;
  suggestionsCreated: number;
  duplicates: number;
  errors: string[];
}

export async function runGustavoContentFetchPipeline(
  options: GustavoFetchOptions = {}
): Promise<GustavoFetchResult> {
  if (!process.env.NEXT_OPENAI_API_KEY) {
    throw new GustavoContentError("NEXT_OPENAI_API_KEY não configurada.", 503);
  }

  const admin = getGustavoContentAdmin();
  const startedAt = new Date();
  const maxCreated = options.maxCreated ?? 8;
  const fetchArticle = options.fetchArticle ?? true;
  const trigger = options.trigger ?? "manual";

  if (options.source === "institutional") {
    return importInstitutionalNews({
      maxCreated,
      trigger,
      fetchArticle,
    });
  }

  const topics = (await listTopics()).filter((topic) => {
    if (!topic.is_active) return false;
    if (options.topicIds?.length) return options.topicIds.includes(topic.id);
    return true;
  });

  const result: GustavoFetchResult = {
    itemsSeen: 0,
    discardedUnder55: 0,
    radarCreated: 0,
    suggestionsCreated: 0,
    duplicates: 0,
    errors: [],
  };

  if (topics.length === 0) {
    await logRun(admin, { trigger, startedAt, topicsCount: 0, result });
    return result;
  }

  const [allTheses, strategy] = await Promise.all([listTheses(), getStrategy()]);
  const theses = allTheses.filter((thesis) => thesis.status !== "disabled");
  const existing = await listRecentForDedupe();
  const seen: DedupeCandidate[] = [...existing];

  let created = 0;
  topicLoop: for (const topic of topics) {
    try {
      const items = await fetchRssItems(topic.rss_query, topic.months_back);
      const limited = filterItems(items, topic.months_back).slice(0, topic.item_limit);

      for (const item of limited) {
        if (created >= maxCreated) break topicLoop;
        result.itemsSeen += 1;
        const title = item.title ?? "";
        const link = item.link ?? null;
        if (findSameFact(seen, { title, link })) {
          result.duplicates += 1;
          continue;
        }

        try {
          const article = fetchArticle
            ? await fetchArticleContent(item.link)
            : { text: "", imageUrl: null, resolvedUrl: link };

          const score = await analyzeScore({
            title,
            snippet: item.contentSnippet ?? "",
            article: article.text,
            link: article.resolvedUrl ?? link,
            theses,
            strategy,
          });

          const status = statusFromScore(score.total);
          if (!status) {
            result.discardedUnder55 += 1;
            continue;
          }

          let anglesPatch: Record<string, unknown> = {};
          if (score.total >= SCORE_SUGGESTION_FROM) {
            try {
              const angles = await generateAngles({
                title,
                snippet: item.contentSnippet ?? "",
                article: article.text,
                link: article.resolvedUrl ?? link,
                theses,
                strategy,
              });
              const matched =
                theses.find((thesis) => thesis.id === angles.thesisMatch.thesisId) ?? null;
              const validated = matched?.status === "validated" ? matched : null;
              const opinionStatus = validated ? "validated" : "needs_gustavo";
              anglesPatch = {
                angles: angles.angles,
                selected_angle: angles.angles[0] ?? null,
                thesis_id: validated?.id ?? matched?.id ?? null,
                thesis_snapshot: validated
                  ? thesisSnapshot(validated)
                  : matched
                    ? thesisSnapshot(matched)
                    : null,
                opinion_status: opinionStatus,
                gustavo_questions:
                  opinionStatus === "needs_gustavo" ? angles.questions.slice(0, 3) : [],
              };
            } catch (err) {
              result.errors.push(
                `${title}: ângulos — ${err instanceof Error ? err.message : "falha"}`
              );
            }
          }

          const publishedAt = item.isoDate ?? item.pubDate;
          const { error } = await admin.from("gustavo_content_items").insert({
            source: "rss",
            topic_id: topic.id,
            title,
            link: article.resolvedUrl ?? link,
            content_snippet: item.contentSnippet ?? article.text.slice(0, 500) ?? null,
            published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
            image_url: article.imageUrl,
            source_context: {
              ...score.sourceContext,
              articleText: preserveArticleText(article.text),
              extractionWarning: article.text
                ? null
                : "Matéria incompleta — seguimos com título e resumo do RSS.",
            },
            editorial_score: score.total,
            score_breakdown: score.breakdown,
            score_reason: score.reason,
            business_problem: score.businessProblem,
            recommended_channels: score.recommendedChannels,
            status,
            ...anglesPatch,
          });

          if (error) {
            result.errors.push(`${title}: ${error.message}`);
            continue;
          }

          seen.push({ title, link: article.resolvedUrl ?? link });
          created += 1;
          if (status === "sugestao") result.suggestionsCreated += 1;
          else result.radarCreated += 1;
        } catch (err) {
          result.errors.push(
            `${title}: ${err instanceof Error ? err.message : "Erro desconhecido"}`
          );
        }
      }
    } catch (err) {
      result.errors.push(
        `${topic.name}: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    }
  }

  await logRun(admin, { trigger, startedAt, topicsCount: topics.length, result });
  return result;
}

async function logRun(
  admin: ReturnType<typeof getGustavoContentAdmin>,
  input: {
    trigger: string;
    startedAt: Date;
    topicsCount: number;
    result: GustavoFetchResult;
  }
) {
  try {
    await admin.from("gustavo_content_fetch_runs").insert({
      trigger: input.trigger,
      started_at: input.startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      topics_count: input.topicsCount,
      items_seen: input.result.itemsSeen,
      discarded_under_55: input.result.discardedUnder55,
      radar_created: input.result.radarCreated,
      suggestions_created: input.result.suggestionsCreated,
      duplicates: input.result.duplicates,
      error_count: input.result.errors.length,
      errors: input.result.errors.slice(0, 20),
    });
  } catch {
    // log best-effort
  }
}

export async function importInstitutionalNews(options: {
  maxCreated?: number;
  trigger?: string;
  fetchArticle?: boolean;
  days?: number;
} = {}): Promise<GustavoFetchResult> {
  if (!process.env.NEXT_OPENAI_API_KEY) {
    throw new GustavoContentError("NEXT_OPENAI_API_KEY não configurada.", 503);
  }

  const admin = getGustavoContentAdmin();
  const startedAt = new Date();
  const maxCreated = options.maxCreated ?? 8;
  const days = options.days ?? 21;
  const fetchArticle = options.fetchArticle ?? true;
  const trigger = options.trigger ?? "institutional";
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const result: GustavoFetchResult = {
    itemsSeen: 0,
    discardedUnder55: 0,
    radarCreated: 0,
    suggestionsCreated: 0,
    duplicates: 0,
    errors: [],
  };

  const { data: roteiros, error: roteirosError } = await admin
    .from("content_roteiros")
    .select("title, link, content_snippet, published_at, image_url")
    .eq("area", "Reestruturação")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);

  if (roteirosError) {
    throw new GustavoContentError(roteirosError.message, 500);
  }

  const [allTheses, strategy] = await Promise.all([listTheses(), getStrategy()]);
  const theses = allTheses.filter((thesis) => thesis.status !== "disabled");
  const existing = await listRecentForDedupe();
  const candidates = pickInstitutionalCandidates(
    existing,
    (roteiros ?? []).map((row) => ({
      title: String(row.title ?? ""),
      link: (row.link as string | null) ?? null,
      content_snippet: (row.content_snippet as string | null) ?? null,
      published_at: (row.published_at as string | null) ?? null,
      image_url: (row.image_url as string | null) ?? null,
    })),
    maxCreated * 3
  );

  result.duplicates = (roteiros?.length ?? 0) - candidates.length;
  const seen: DedupeCandidate[] = [...existing];
  let created = 0;

  for (const item of candidates) {
    if (created >= maxCreated) break;
    result.itemsSeen += 1;
    const title = item.title;
    const link = item.link;
    try {
      const article = fetchArticle
        ? await fetchArticleContent(link ?? undefined)
        : { text: "", imageUrl: item.image_url ?? null, resolvedUrl: link };

      const score = await analyzeScore({
        title,
        snippet: item.content_snippet ?? "",
        article: article.text || item.content_snippet || "",
        link: article.resolvedUrl ?? link,
        theses,
        strategy,
      });

      const status = statusFromScore(score.total);
      if (!status) {
        result.discardedUnder55 += 1;
        continue;
      }

      let anglesPatch: Record<string, unknown> = {};
      if (score.total >= SCORE_SUGGESTION_FROM) {
        const angles = await generateAngles({
          title,
          snippet: item.content_snippet ?? "",
          article: article.text || item.content_snippet || "",
          link: article.resolvedUrl ?? link,
          theses,
          strategy,
        });
        const matched = theses.find((thesis) => thesis.id === angles.thesisMatch.thesisId) ?? null;
        const validated = matched?.status === "validated" ? matched : null;
        const opinionStatus = validated ? "validated" : "needs_gustavo";
        anglesPatch = {
          angles: angles.angles,
          selected_angle: angles.angles[0] ?? null,
          thesis_id: validated?.id ?? matched?.id ?? null,
          thesis_snapshot: validated
            ? thesisSnapshot(validated)
            : matched
              ? thesisSnapshot(matched)
              : null,
          opinion_status: opinionStatus,
          gustavo_questions: opinionStatus === "needs_gustavo" ? angles.questions.slice(0, 3) : [],
        };
      }

      const { error } = await admin.from("gustavo_content_items").insert({
        source: "rss",
        title,
        link: article.resolvedUrl ?? link,
        content_snippet: item.content_snippet ?? article.text.slice(0, 500) ?? null,
        published_at: item.published_at,
        image_url: article.imageUrl ?? item.image_url ?? null,
        source_context: {
          ...score.sourceContext,
          articleText: preserveArticleText(article.text || item.content_snippet),
          extractionWarning: article.text
            ? null
            : "Reaproveitada do Conteúdo para Post — extração complementar quando disponível.",
        },
        editorial_score: score.total,
        score_breakdown: score.breakdown,
        score_reason: score.reason,
        business_problem: score.businessProblem,
        recommended_channels: score.recommendedChannels,
        status,
        ...anglesPatch,
      });

      if (error) {
        result.errors.push(`${title}: ${error.message}`);
        continue;
      }

      seen.push({ title, link: article.resolvedUrl ?? link });
      created += 1;
      if (status === "sugestao") result.suggestionsCreated += 1;
      else result.radarCreated += 1;
    } catch (err) {
      result.errors.push(`${title}: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  }

  await logRun(admin, { trigger, startedAt, topicsCount: 0, result });
  return result;
}

export async function listFetchRuns() {
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_fetch_runs")
    .select(
      "id, trigger, started_at, finished_at, topics_count, items_seen, discarded_under_55, radar_created, suggestions_created, duplicates, error_count, errors, created_at"
    )
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw new GustavoContentError(error.message, 500);
  return data ?? [];
}

