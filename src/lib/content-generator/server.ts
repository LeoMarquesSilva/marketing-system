/**
 * Servidor do Gerador de conteúdo: configurações, aprendizado (Instagram +
 * escolhas + edições da equipe), nota de potencial e escrita do carrossel.
 * Não importa content-roteiros.ts (que importa este arquivo).
 */
import { createClient } from "@supabase/supabase-js";
import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { OPENAI_DEFAULT_MODEL, openAIGenerationOptions } from "@/lib/openai-models";
import { openAIKey } from "@/lib/openai-keys";
import { fetchInstagramPosts } from "@/lib/instagram-posts";
import { fetchArticleContent } from "@/lib/content-extraction";
import { LEGAL_AREAS } from "@/lib/content-areas";
import { fetchAllPages } from "@/lib/supabase-pages";
import { listReferences, syncReferenceAccounts } from "@/lib/content-generator/references-server";
import { referencesPromptBlock, summarizeReferences } from "@/lib/content-generator/references";
import {
  settingsFromRow,
  settingsToRow,
  type GeneratorSettings,
  type GeneratorSettingsRow,
} from "@/lib/content-generator/settings";
import {
  relatedCandidatesBlock,
  relatedCarouselGuidance,
  toRelatedRef,
  uniquePeople,
  type RankedCandidate,
  type RelatedCandidate,
  type RelatedKind,
  type RelatedPerson,
  type RelatedRef,
} from "@/lib/content-generator/related";
import {
  captionHeadline,
  computeLearningStats,
  LEARNING_WINDOW_DAYS,
  learningBlockForArea,
  type LearningPlaybook,
  type LearningRoteiroRow,
  type LearningSnapshot,
  type LearningStats,
  type LearningTopicRow,
} from "@/lib/content-generator/learning";
import {
  buildCarouselPrompt,
  buildRelevancePrompt,
  type CarouselPromptInput,
  type RelevancePromptInput,
} from "@/lib/content-generator/prompt";

type OpenAIProvider = ReturnType<typeof createOpenAI>;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Janela das escolhas/fontes no aprendizado (a mesma do dedupe da busca). */
const CHOICES_WINDOW_DAYS = 120;

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key);
}

export function contentOpenAI(): OpenAIProvider {
  const apiKey = openAIKey("conteudo");
  if (!apiKey) throw new Error("OPENAI_API_KEY_CONTEUDO não configurada.");
  return createOpenAI({ apiKey });
}

// ── Configurações ────────────────────────────────────────────────────────────

export async function getGeneratorSettings(): Promise<GeneratorSettings> {
  const { data } = await adminDb().from("content_generator_settings").select("*").eq("id", "default").maybeSingle();
  return settingsFromRow(data as GeneratorSettingsRow | null);
}

export async function saveGeneratorSettings(
  input: Partial<GeneratorSettings>,
  actor: { id: string; name: string | null },
): Promise<GeneratorSettings> {
  const row = {
    id: "default",
    ...settingsToRow(input),
    updated_by_id: actor.id,
    updated_by_name: actor.name,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await adminDb().from("content_generator_settings").upsert(row).select("*").single();
  if (error) throw new Error("Não foi possível salvar as configurações.");
  return settingsFromRow(data as GeneratorSettingsRow);
}

// ── Aprendizado ──────────────────────────────────────────────────────────────

interface SnapshotRow {
  id: string;
  created_at: string;
  trigger: string;
  created_by_name: string | null;
  posts_analyzed: number;
  choices_analyzed: number;
  edits_analyzed: number;
  stats: LearningStats;
  playbook: LearningPlaybook;
}

function snapshotFromRow(row: SnapshotRow): LearningSnapshot {
  return {
    id: row.id,
    createdAt: row.created_at,
    trigger: row.trigger,
    createdByName: row.created_by_name,
    postsAnalyzed: row.posts_analyzed,
    choicesAnalyzed: row.choices_analyzed,
    editsAnalyzed: row.edits_analyzed,
    stats: row.stats,
    playbook: row.playbook,
  };
}

export async function getLatestLearning(): Promise<LearningSnapshot | null> {
  const { data } = await adminDb()
    .from("content_learning_snapshots")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? snapshotFromRow(data as SnapshotRow) : null;
}

export async function listLearningHistory(limit = 6): Promise<Pick<LearningSnapshot, "id" | "createdAt" | "trigger" | "createdByName" | "postsAnalyzed" | "choicesAnalyzed" | "editsAnalyzed">[]> {
  const { data } = await adminDb()
    .from("content_learning_snapshots")
    .select("id, created_at, trigger, created_by_name, posts_analyzed, choices_analyzed, edits_analyzed")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    trigger: row.trigger as string,
    createdByName: (row.created_by_name as string | null) ?? null,
    postsAnalyzed: row.posts_analyzed as number,
    choicesAnalyzed: row.choices_analyzed as number,
    editsAnalyzed: row.edits_analyzed as number,
  }));
}

const listSchema = (max: number) => z.array(z.string()).max(max);

const playbookSchema = z.object({
  resumo: z.string().describe("2 a 3 frases sobre o que o perfil aprendeu, em português simples"),
  geral: z.object({
    oQueEngaja: listSchema(5),
    ganchos: listSchema(5).describe("Modelos de primeira frase/capa que funcionaram"),
    evitar: listSchema(5),
    formato: z.string().describe("Qual formato (carrossel, reels, imagem) rende mais e quando usar"),
  }),
  areas: z.array(
    z.object({
      area: z.enum(LEGAL_AREAS),
      oQueEngaja: listSchema(4),
      temasPromissores: listSchema(4),
      ganchos: listSchema(3),
      evitar: listSchema(3),
    }),
  ),
  preferenciasDaEquipe: listSchema(5).describe("Que tipo de matéria os advogados escolhem e qual ignoram/descartam"),
  edicoesDaEquipe: listSchema(5).describe("Padrões nas correções que a equipe faz no texto da IA"),
  fontes: listSchema(5).describe("Recomendações sobre as fontes de notícias (manter, pausar, ajustar termos)"),
  referencias: z.object({
    resumo: z.string().describe("2 frases: o que os escritórios de referência fazem diferente de nós; vazio se não houver dados"),
    oQueFazem: listSchema(5).describe("Temas, formatos e frequência dos escritórios de referência e concorrentes"),
    comoMostramDominio: listSchema(5).describe("Recursos que mostram domínio técnico (análise de precedente, números do caso, bastidores de operação) em vez de explicar o básico"),
    ideiasDePauta: listSchema(5).describe("Pautas no nível deles que o nosso escritório poderia fazer, por área"),
    naoCopiar: listSchema(4).describe("O que eles postam que não vale para nós (ex.: só institucional, autopromoção)"),
  }),
});

function clip(text: string | null | undefined, max: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Estuda o Instagram do escritório, as escolhas e descartes da equipe e as
 * correções feitas no texto da IA, e guarda o "manual do que funciona".
 */
export async function refreshLearning(options: {
  trigger: "manual" | "automatico";
  actor?: { id: string; name: string | null } | null;
}): Promise<LearningSnapshot> {
  const db = adminDb();
  const since = new Date(Date.now() - LEARNING_WINDOW_DAYS * DAY_MS).toISOString();
  const choicesSince = new Date(Date.now() - CHOICES_WINDOW_DAYS * DAY_MS).toISOString();

  const [posts, roteiros, topicsResult, editsResult] = await Promise.all([
    fetchInstagramPosts({ from: since }),
    // Paginado: a janela passa de 1.000 linhas, o teto de cada consulta do Supabase.
    fetchAllPages<LearningRoteiroRow>((from, to) =>
      db
        .from("content_roteiros")
        .select("id, topic_id, title, area, status, created_at, approved_by_id")
        .gte("created_at", choicesSince)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    db.from("content_topics").select("id, name, legal_area, is_active"),
    db
      .from("content_roteiros")
      .select("area, original_post, post")
      .eq("has_alterations", true)
      .not("original_post", "is", null)
      .order("edited_at", { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  const topics = (topicsResult.data ?? []) as LearningTopicRow[];
  const edits = (editsResult.data ?? []) as { area: string; original_post: string; post: string }[];
  // Matérias escolhidas antes da janela também ensinam: busca todas as escolhas.
  const { data: allChoices } = await db
    .from("content_roteiros")
    .select("title, area, status")
    .not("approved_by_id", "is", null)
    .order("approved_at", { ascending: false })
    .limit(60);
  const { data: discarded } = await db
    .from("content_roteiros")
    .select("title, area")
    .eq("status", "rejeitado")
    .limit(30);

  const stats = computeLearningStats({ posts, roteiros, topics, edits: edits.length });

  // Escritórios de referência: lê os perfis desatualizados e resume o que postam (tudo opcional).
  await syncReferenceAccounts().catch((err) => console.error("[aprendizado] referências não atualizadas", err));
  const references = await listReferences().catch(() => ({ accounts: [], posts: [] }));
  const referencesBlock = referencesPromptBlock(
    summarizeReferences(references.accounts.filter((account) => account.isActive), references.posts),
  );
  const settings = await getGeneratorSettings().catch(() => settingsFromRow(null));
  const guidelines = Object.entries(settings.areaGuidelines);

  const twoWeeksAgo = Date.now() - 14 * DAY_MS;
  const ignored = roteiros
    .filter((row) => !row.approved_by_id && row.status === "aguardando_aprovacao" && new Date(row.created_at).getTime() < twoWeeksAgo)
    .sort(() => Math.random() - 0.5)
    .slice(0, 30);

  const input = [
    `INSTAGRAM DO ESCRITÓRIO — ${stats.totals.posts} posts medidos nos últimos ${LEARNING_WINDOW_DAYS} dias; engajamento médio ${stats.totals.engagementRate}% (curtidas + comentários + salvamentos ÷ alcance).`,
    `Por formato: ${stats.formats.map((f) => `${f.format}: ${f.posts} posts, ${f.engagementRate}% de engajamento, alcance médio ${f.avgReach}, ${f.avgShares} compartilhamentos/post`).join("; ")}.`,
    ...stats.areas
      .filter((area) => area.posts > 0)
      .map((area) =>
        [
          `\nÁREA ${area.area}: ${area.posts} posts, engajamento médio ${area.engagementRate}%, alcance médio ${area.avgReach}.`,
          `Melhores:\n${area.top.map((post) => `- [${post.format}, ${post.engagementRate}%, ${post.shares} compart., ${post.saves} salv.] ${post.headline}`).join("\n")}`,
          area.bottom.length ? `Piores:\n${area.bottom.map((post) => `- [${post.format}, ${post.engagementRate}%] ${post.headline}`).join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    `\nMATÉRIAS QUE A EQUIPE ESCOLHEU (${allChoices?.length ?? 0}):\n${(allChoices ?? []).map((row) => `- [${row.area}] ${clip(row.title as string, 140)}`).join("\n")}`,
    discarded?.length ? `\nDESCARTADAS PELA EQUIPE:\n${discarded.map((row) => `- [${row.area}] ${clip(row.title as string, 140)}`).join("\n")}` : "",
    ignored.length ? `\nAMOSTRA DE MATÉRIAS QUE NINGUÉM ESCOLHEU (mais de 2 semanas na lista):\n${ignored.map((row) => `- [${row.area}] ${clip(row.title, 140)}`).join("\n")}` : "",
    `\nFONTES (últimos ${CHOICES_WINDOW_DAYS} dias): ${stats.sources.map((s) => `${s.name}${s.active ? "" : " (pausada)"}: ${s.generated} geradas, ${s.chosen} escolhidas`).join("; ")}.`,
    edits.length
      ? `\nCORREÇÕES DA EQUIPE NO TEXTO DA IA (versão da IA → versão final):\n${edits
          .map((edit, index) => `#${index + 1} [${edit.area}]\nIA: ${clip(edit.original_post, 700)}\nFINAL: ${clip(edit.post, 700)}`)
          .join("\n\n")}`
      : "",
    referencesBlock ? `\n${referencesBlock}` : "",
    guidelines.length
      ? `\nLINHA EDITORIAL DEFINIDA PELOS SÓCIOS (suas recomendações precisam respeitar isto; ela vale mais que o histórico):\n${guidelines
          .map(([area, text]) => `- ${area}: ${text}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { object } = await generateObject({
    model: contentOpenAI()(OPENAI_DEFAULT_MODEL),
    schema: playbookSchema,
    prompt: [
      "Você é o estrategista de conteúdo do Instagram de um escritório de advocacia empresarial (Bismarchi | Pires).",
      "Estude os dados abaixo e escreva o manual do que funciona, que será usado pela IA que escolhe notícias e escreve carrosséis.",
      "Seja concreto e baseado nos dados (cite padrões de tema, de primeira frase e de formato). Não invente números. Se uma área tiver pouca amostra, diga menos sobre ela.",
      "Em 'referencias', compare o que os escritórios de referência e concorrentes postam com o nosso perfil, com foco em como eles mostram domínio do assunto em vez de explicar o básico. Sem dados de referências, deixe as listas vazias.",
      "Escreva em português do Brasil, frases curtas, sem jargão de marketing.",
      "",
      input,
    ].join("\n"),
    ...openAIGenerationOptions(OPENAI_DEFAULT_MODEL, { reasoningEffort: "medium", temperature: 0.3 }),
  });

  const playbook = object as LearningPlaybook;
  const { data, error } = await db
    .from("content_learning_snapshots")
    .insert({
      trigger: options.trigger,
      created_by_id: options.actor?.id ?? null,
      created_by_name: options.actor?.name ?? null,
      posts_analyzed: stats.totals.posts,
      choices_analyzed: allChoices?.length ?? 0,
      edits_analyzed: edits.length,
      stats,
      playbook,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error("Não foi possível salvar o aprendizado.");
  return snapshotFromRow(data as SnapshotRow);
}

// ── Nota de potencial e escrita ──────────────────────────────────────────────

const relevanceSchema = z.object({
  score: z.number().int().min(0).max(10),
  reason: z.string(),
  relacao: z.enum(["novo", "repetido", "desdobramento"]),
  referencia: z.number().int().nullable(),
  novidade: z.string().describe("No desdobramento, o que mudou desde o nosso post; senão, vazio"),
});

export interface RelevanceResult {
  score: number;
  reason: string;
  related: { kind: RelatedKind; ref: RelatedRef | null; note: string | null };
}

/**
 * Nota de potencial (0–10) e, quando há algo parecido no que já publicamos ou
 * escolhemos, se é repetição ou desdobramento (fato novo no mesmo caso).
 */
export async function scoreNewsRelevance(
  openai: OpenAIProvider,
  input: Omit<RelevancePromptInput, "relatedBlock">,
  related: RankedCandidate[] = [],
): Promise<RelevanceResult> {
  const { object } = await generateObject({
    model: openai(OPENAI_DEFAULT_MODEL),
    schema: relevanceSchema,
    prompt: buildRelevancePrompt({ ...input, relatedBlock: relatedCandidatesBlock(related) }),
    // Comparar com o histórico pede um pouco de raciocínio; sem histórico, resposta direta.
    ...openAIGenerationOptions(OPENAI_DEFAULT_MODEL, { reasoningEffort: related.length ? "low" : "none", temperature: 0.2 }),
  });
  const reference = object.referencia ? related[object.referencia - 1]?.candidate : undefined;
  const kind: RelatedKind = object.relacao !== "novo" && reference ? object.relacao : "novo";
  return {
    score: Math.min(10, Math.max(0, Math.round(object.score))),
    reason: clip(object.reason, 240),
    related: {
      kind,
      ref: kind === "novo" || !reference ? null : toRelatedRef(reference),
      note: kind === "desdobramento" && object.novidade.trim() ? clip(object.novidade, 280) : null,
    },
  };
}

/** Janela do "já falamos disso": o que publicamos no Instagram em ~1 ano e meio. */
const RELATED_WINDOW_DAYS = 540;

/**
 * Memória do que já publicamos (Instagram) e do que a equipe já escolheu,
 * carregada uma vez por busca para comparar com cada notícia nova.
 */
export async function loadRelatedCandidates(): Promise<RelatedCandidate[]> {
  const db = adminDb();
  const since = new Date(Date.now() - RELATED_WINDOW_DAYS * DAY_MS).toISOString();
  type PostRow = {
    id: string;
    caption: string | null;
    permalink: string | null;
    published_at: string | null;
    solicitante_id: string | null;
    solicitante: string | null;
    solicitantes: RelatedPerson[] | null;
  };
  type ChosenRow = {
    id: string;
    title: string;
    content_snippet: string | null;
    approved_at: string | null;
    approved_by_id: string | null;
    approved_by_name: string | null;
    created_by_id: string | null;
    created_by_name: string | null;
  };
  const [posts, chosen] = await Promise.all([
    fetchAllPages<PostRow>((from, to) =>
      db
        .from("instagram_posts")
        .select("id, caption, permalink, published_at, solicitante_id, solicitante, solicitantes")
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<ChosenRow>((from, to) =>
      db
        .from("content_roteiros")
        .select("id, title, content_snippet, approved_at, approved_by_id, approved_by_name, created_by_id, created_by_name")
        .not("approved_by_id", "is", null)
        .order("approved_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);
  return [
    ...posts
      .filter((post) => post.caption?.trim())
      .map((post) => {
        const headline = captionHeadline(post.caption, 200);
        const rest = (post.caption ?? "").replace(/\s+/g, " ").replace(headline, "").trim();
        return {
          source: "instagram" as const,
          id: post.id,
          title: headline || "Post no Instagram",
          text: rest.slice(0, 600),
          url: post.permalink,
          date: post.published_at,
          // Quem pediu/fez o post (vínculo na tela de Métricas): recebe o aviso de desdobramento.
          people: uniquePeople([
            ...(post.solicitantes ?? []),
            post.solicitante_id ? { id: post.solicitante_id, name: post.solicitante ?? "" } : null,
          ]),
        };
      }),
    ...chosen.map((row) => ({
      source: "roteiro" as const,
      id: row.id,
      title: row.title,
      text: row.content_snippet ?? "",
      url: null,
      date: row.approved_at,
      people: uniquePeople([
        row.approved_by_id ? { id: row.approved_by_id, name: row.approved_by_name ?? "" } : null,
        row.created_by_id ? { id: row.created_by_id, name: row.created_by_name ?? "" } : null,
      ]),
    })),
  ];
}

// ── Avisos de desdobramento ──────────────────────────────────────────────────

export interface FollowupAlert {
  id: string;
  roteiroId: string;
  ref: RelatedRef;
  note: string | null;
  createdAt: string;
  roteiro: { title: string; area: string; imageUrl: string | null; status: string };
}

/**
 * Avisa quem fez o post original (ou escolheu a matéria) de que o assunto teve
 * fato novo. Só pessoas ativas; quem trouxe a matéria não se avisa.
 */
export async function createFollowupAlerts(input: {
  roteiroId: string;
  ref: RelatedRef | null | undefined;
  note: string | null | undefined;
  excludeUserId?: string | null;
}): Promise<number> {
  const people = (input.ref?.people ?? []).filter((person) => person.id !== input.excludeUserId);
  if (!input.ref || people.length === 0) return 0;
  const db = adminDb();
  const { data: users, error: usersError } = await db
    .from("users")
    .select("id, is_active")
    .in("id", people.map((person) => person.id));
  if (usersError) throw new Error(usersError.message);
  const recipients = (users ?? []).filter((user) => user.is_active !== false);
  if (recipients.length === 0) return 0;
  const { error } = await db.from("content_followup_alerts").upsert(
    recipients.map((user) => ({ recipient_id: user.id, roteiro_id: input.roteiroId, ref: input.ref, note: input.note ?? null })),
    { onConflict: "recipient_id,roteiro_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
  return recipients.length;
}

/** Avisos pendentes da pessoa, só de matérias que ainda estão disponíveis. */
export async function listFollowupAlerts(userId: string): Promise<FollowupAlert[]> {
  const { data, error } = await adminDb()
    .from("content_followup_alerts")
    .select("id, roteiro_id, ref, note, created_at, content_roteiros!inner(title, area, image_url, status)")
    .eq("recipient_id", userId)
    .eq("status", "pendente")
    .eq("content_roteiros.status", "aguardando_aprovacao")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("Não foi possível carregar os avisos.");
  return (data ?? []).map((row) => {
    const roteiro = (Array.isArray(row.content_roteiros) ? row.content_roteiros[0] : row.content_roteiros) as {
      title: string;
      area: string;
      image_url: string | null;
      status: string;
    };
    return {
      id: row.id as string,
      roteiroId: row.roteiro_id as string,
      ref: row.ref as RelatedRef,
      note: (row.note as string | null) ?? null,
      createdAt: row.created_at as string,
      roteiro: { title: roteiro.title, area: roteiro.area, imageUrl: roteiro.image_url, status: roteiro.status },
    };
  });
}

/** Alguém escolheu (feito) ou descartou a matéria: fecha os avisos dela. */
export async function resolveFollowupAlerts(roteiroId: string, status: "feito" | "dispensado"): Promise<void> {
  await adminDb()
    .from("content_followup_alerts")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("roteiro_id", roteiroId)
    .eq("status", "pendente");
}

/** "Agora não": a pessoa dispensa o próprio aviso. */
export async function dismissFollowupAlert(alertId: string, userId: string): Promise<void> {
  const { error } = await adminDb()
    .from("content_followup_alerts")
    .update({ status: "dispensado", resolved_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("recipient_id", userId);
  if (error) throw new Error("Não foi possível dispensar o aviso.");
}

/** Quem recebeu o aviso pode abrir e escolher a matéria, mesmo sendo de outra área. */
export async function hasFollowupAlert(userId: string, roteiroId: string): Promise<boolean> {
  const { data } = await adminDb()
    .from("content_followup_alerts")
    .select("id")
    .eq("recipient_id", userId)
    .eq("roteiro_id", roteiroId)
    .limit(1);
  return Boolean(data?.length);
}

export async function writeCarousel(openai: OpenAIProvider, input: CarouselPromptInput): Promise<string> {
  const { text } = await generateText({
    model: openai(OPENAI_DEFAULT_MODEL),
    prompt: buildCarouselPrompt(input),
    ...openAIGenerationOptions(OPENAI_DEFAULT_MODEL, { reasoningEffort: "low", temperature: 0.7 }),
  });
  return text?.trim() ?? "";
}

/** Contexto que a busca e o link avulso carregam uma vez por execução. */
export async function loadGenerationContext(): Promise<{
  settings: GeneratorSettings;
  learning: LearningSnapshot | null;
  learningFor: (area: string) => string;
}> {
  const settings = await getGeneratorSettings().catch(() => settingsFromRow(null));
  const learning = settings.useLearning ? await getLatestLearning().catch(() => null) : null;
  return { settings, learning, learningFor: (area) => learningBlockForArea(learning, area) };
}

/**
 * "Refazer com IA": reescreve o carrossel com as regras atuais, o aprendizado e
 * o pedido de quem está revisando. A nova versão vira a "versão da IA".
 */
export async function regenerateRoteiroPost(id: string, instruction: string | null): Promise<{ post: string }> {
  const db = adminDb();
  const { data: row, error } = await db
    .from("content_roteiros")
    .select("title, content_snippet, link, area, status, related_kind, related_ref, related_note")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) throw new Error("Matéria não encontrada.");
  if (row.status === "enviado_mkt") throw new Error("Esse post já foi enviado ao Marketing; ajuste pelo Planner.");

  const context = await loadGenerationContext();
  const article = row.link ? await fetchArticleContent(row.link as string).catch(() => ({ text: "", imageUrl: null })) : { text: "", imageUrl: null };
  const post = await writeCarousel(contentOpenAI(), {
    title: row.title as string,
    snippet: (row.content_snippet as string | null) ?? "",
    articleText: article.text,
    link: (row.link as string | null) ?? "",
    area: row.area as string,
    settings: context.settings,
    learningBlock: context.learningFor(row.area as string),
    extraInstruction: instruction ?? undefined,
    relatedGuidance: relatedCarouselGuidance(
      row.related_kind as RelatedKind | null,
      row.related_ref as RelatedRef | null,
      row.related_note as string | null,
    ),
  });
  if (!post) throw new Error("A IA não devolveu texto. Tente de novo.");

  const { error: updateError } = await db
    .from("content_roteiros")
    .update({ post, original_post: post, has_alterations: false })
    .eq("id", id);
  if (updateError) throw new Error("Não foi possível salvar o novo texto.");
  return { post };
}
