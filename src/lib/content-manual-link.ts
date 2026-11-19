/**
 * Criação de roteiro a partir de um link de notícia colado pelo usuário.
 *
 * Reaproveita a mesma engrenagem do pipeline de RSS — extração do artigo,
 * classificação de área por IA e geração do carrossel — mudando só a entrada:
 * em vez de um item de feed com título pronto, temos apenas uma URL, então o
 * título vem do og:title da própria página.
 *
 * A área NÃO recebe dica de tema (não há tema): a IA classifica livremente
 * entre as áreas do escritório, e o resultado é validado contra essa lista.
 */

import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { openAIKey } from "@/lib/openai-keys";
import { fetchArticleContent } from "@/lib/content-extraction";
import {
  generateCarousel,
  getSupabaseAdmin,
  normalizeTitleKey,
  resolveNewsArea,
} from "@/lib/content-roteiros";
import {
  buildAreaPerformanceContext,
  fetchPerformancePostsWindow,
} from "@/lib/content-performance";
import { getContentCutoffDate } from "@/lib/content-utils";
import { collaboratorHintForArea } from "@/lib/content-generator/learning";
import { fetchAllPages } from "@/lib/supabase-pages";
import {
  createFollowupAlerts,
  loadGenerationContext,
  loadRelatedCandidates,
  scoreNewsRelevance,
} from "@/lib/content-generator/server";
import { isSameStory, rankRelatedCandidates, relatedCarouselGuidance, storyTerms } from "@/lib/content-generator/related";

/**
 * URL de notícia aceita. O protocolo é validado explicitamente: `z.url()` do
 * Zod 4 aceita `javascript:`, `data:` e `file:`, que não podem ser buscados
 * pelo servidor nem gravados como link de um post.
 */
export const manualLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Cole o link da notícia.")
    .max(2048, "Link muito longo.")
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "https:" || parsed.protocol === "http:";
        } catch {
          return false;
        }
      },
      { message: "Informe um link http(s) válido." }
    ),
});

export type ManualLinkInput = z.infer<typeof manualLinkSchema>;

export class ManualLinkError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "ManualLinkError";
  }
}

export interface ManualLinkResult {
  id: string;
  title: string;
  area: string;
  post: string;
  link: string;
  imageUrl: string | null;
  /** Título e área foram deduzidos da página, então vale conferir. */
  detected: { title: boolean; area: boolean };
}

/** Título mínimo para valer um post — abaixo disso a extração falhou. */
const MIN_TITLE_LENGTH = 15;

export async function createRoteiroFromLink(
  input: ManualLinkInput,
  actor: { id: string; name: string }
): Promise<ManualLinkResult> {
  const apiKey = openAIKey("conteudo");
  if (!apiKey) {
    throw new ManualLinkError(
      "Geração por IA não está configurada.",
      503,
      "AI_NOT_CONFIGURED"
    );
  }

  const article = await fetchArticleContent(input.url);
  const link = article.resolvedUrl ?? input.url;

  if (!article.text && !article.title) {
    // Alguns veículos (ex.: Conjur) recusam requisição de servidor com 403,
    // mesmo com cabeçalhos de navegador. Nesse caso não há o que extrair.
    throw new ManualLinkError(
      "Esse site não deixa o sistema ler a matéria (bloqueio do próprio veículo, login ou paywall). " +
        "Copie o texto da notícia e gere o post pelo tema correspondente.",
      422,
      "ARTICLE_UNREADABLE"
    );
  }

  const title = (article.title ?? "").trim();
  if (title.length < MIN_TITLE_LENGTH) {
    throw new ManualLinkError(
      "Não encontramos o título da notícia nessa página.",
      422,
      "TITLE_NOT_FOUND"
    );
  }

  const supabase = getSupabaseAdmin();

  // Evita post duplicado do mesmo link/manchete numa janela recente.
  const titleKey = normalizeTitleKey(title);
  // Paginado: o Supabase corta em 1.000 linhas e a janela tem mais que isso.
  const existing = await fetchAllPages<{ id: string; title: string | null; link: string | null; created_at: string }>((from, to) =>
    supabase
      .from("content_roteiros")
      .select("id, title, link, created_at")
      .gte("created_at", getContentCutoffDate(120).toISOString())
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );

  for (const row of existing ?? []) {
    const rowLink = (row.link as string | null) ?? "";
    const rowTitleKey = normalizeTitleKey((row.title as string) ?? "");
    if ((rowLink && rowLink === link) || (titleKey && rowTitleKey === titleKey)) {
      throw new ManualLinkError(
        "Essa notícia já virou post. Procure por ela na lista de roteiros.",
        409,
        "ALREADY_EXISTS"
      );
    }
  }

  // A mesma notícia por outro veículo nas últimas 3 semanas também já está na lista.
  const storySince = getContentCutoffDate(21).toISOString();
  const itemStory = storyTerms(title);
  const sameStory = existing.find(
    (row) => row.created_at >= storySince && row.title && isSameStory(storyTerms(row.title), itemStory)
  );
  if (sameStory) {
    throw new ManualLinkError(
      `Essa notícia já está na lista, vinda de outro veículo: "${sameStory.title}". Procure por ela em Posts.`,
      409,
      "ALREADY_EXISTS"
    );
  }

  const openai = createOpenAI({ apiKey });

  // Sem dica de tema: a IA decide a área só pelo conteúdo.
  const snippet = article.text.slice(0, 600);
  const resolved = await resolveNewsArea(openai, title, snippet, null);
  if (resolved.skip) {
    throw new ManualLinkError(
      "Essa notícia não parece relevante para as áreas do escritório. Se discordar, gere o post a partir de um tema.",
      422,
      "NOT_RELEVANT"
    );
  }
  const area = resolved.area;

  // Mesmas regras e aprendizado da busca; sem aprendizado, a dica antiga das legendas.
  const generation = await loadGenerationContext();
  let performanceBlock: string | undefined;
  let collaboratorHint: string | null = collaboratorHintForArea(generation.learning, area);
  try {
    if (!generation.learning) {
      const posts = await fetchPerformancePostsWindow();
      const context = posts.length > 0 ? buildAreaPerformanceContext(posts, area) : null;
      performanceBlock = context?.promptBlock;
      collaboratorHint = collaboratorHint ?? context?.collaboratorHint ?? null;
    }
  } catch {
    // Histórico é opcional: sem ele o post ainda é gerado.
  }
  const learningBlock = generation.learningFor(area) || performanceBlock;

  // Quem colou o link já escolheu: a nota (e o "já falamos disso?") só informa, não barra a geração.
  const relatedCandidates = await loadRelatedCandidates().catch(() => []);
  const related = rankRelatedCandidates({ title, snippet }, relatedCandidates);
  const relevance = await scoreNewsRelevance(
    openai,
    { title, snippet, area, learningBlock, areaGuideline: generation.settings.areaGuidelines[area] },
    related
  ).catch(() => null);

  const post = await generateCarousel(
    openai,
    title,
    snippet,
    link,
    area,
    learningBlock,
    article.text,
    generation.settings,
    relatedCarouselGuidance(relevance?.related.kind, relevance?.related.ref, relevance?.related.note)
  );

  const { data: inserted, error } = await supabase
    .from("content_roteiros")
    .insert({
      topic_id: null, // link avulso não vem de tema
      title,
      link,
      content_snippet: snippet || null,
      area,
      post,
      status: "aguardando_aprovacao",
      published_at: null,
      performance_hint: collaboratorHint,
      image_url: article.imageUrl,
      relevance_score: relevance?.score ?? null,
      relevance_reason: relevance?.reason ?? null,
      related_kind: relevance?.related.kind ?? null,
      related_ref: relevance?.related.ref ?? null,
      related_note: relevance?.related.note ?? null,
      source: "manual",
      created_by_id: actor.id,
      created_by_name: actor.name,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new ManualLinkError(
      "Não foi possível salvar o post gerado.",
      500,
      "SAVE_FAILED"
    );
  }

  // Desdobramento de post de outra pessoa: ela é avisada (quem trouxe o link não se avisa).
  if (relevance?.related.kind === "desdobramento") {
    await createFollowupAlerts({
      roteiroId: inserted.id as string,
      ref: relevance.related.ref,
      note: relevance.related.note,
      excludeUserId: actor.id,
    }).catch(() => undefined);
  }

  return {
    id: inserted.id as string,
    title,
    area,
    post,
    link,
    imageUrl: article.imageUrl,
    detected: { title: true, area: true },
  };
}
