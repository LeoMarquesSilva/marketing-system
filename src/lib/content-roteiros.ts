import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { ContentTopic } from "./content-topics";
import {
  CONTENT_MAX_AGE_DAYS,
  getContentCutoffDate,
  getRoteiroDate,
} from "./content-utils";
import {
  buildClassifyPrompt,
  isIrrelevantResponse,
  isPressReleaseNoise,
  mapTopicAreaToLegalArea,
  parseClassifiedArea,
  shouldSkipAsIrrelevant,
  validateClassifiedArea,
} from "./content-classification";
import { buildRssQueryWithRecency } from "./content-rss";
import { BROWSER_UA, fetchArticleContent } from "./content-extraction";
import { getDepartmentsForLegalArea } from "./content-areas";
import {
  buildAreaPerformanceContext,
  fetchPerformancePostsWindow,
  type AreaPerformanceContext,
} from "./content-performance";
import type { InstagramPost } from "./instagram-posts";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const LEGAL_AREAS = [
  "Cível",
  "Trabalhista",
  "Reestruturação (Insolvência)",
  "Societário e Contrato",
  "Operações Legais (Legal Ops)",
  "Distressed Deals",
] as const;

const CAROUSEL_PROMPT = `Você é redator jurídico de um escritório de advocacia.

Com base na notícia abaixo, crie um post completo em formato de carrossel para redes sociais, seguindo exatamente a estrutura e estilo abaixo:

---

**Slide de Capa**
Título: Frase impactante e objetiva (manchete)
Subtítulo: Uma linha curta de apoio que complementa o título

**Slide de Desenvolvimento 1**  
Título: Subtópico específico  
Conteúdo: Explicação clara e direta com exemplo

**Slide de Desenvolvimento 2**  
Título: Benefícios ou Justificativas  
Conteúdo:
- Benefício 1
- Benefício 2
- Benefício 3

**Slide de Desenvolvimento 3**  
Título: Impactos ou Desafios  
Conteúdo: Principais desafios ou controvérsias

**Slide Final**  
Título: Conclusão ou Perspectiva Futura  
Conteúdo: Resumo final + Call to Action (ex: "Procure um advogado especializado")

---

**Notícia**
Título: {{TITLE}}
Resumo: {{SNIPPET}}
Conteúdo da matéria: {{ARTICLE}}
Link: {{LINK}}
Área do Direito: {{AREA}}
{{PERFORMANCE}}

Baseie-se no conteúdo da matéria quando disponível (é mais completo que o resumo). Use linguagem acessível, objetiva, com tom profissional. Não invente fatos que não estejam na notícia e não cite diretamente o veículo de imprensa.`;

const RSS_BASE =
  "https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-419&q=";

export function getSupabaseAdmin() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface RssItem {
  title: string;
  link?: string;
  contentSnippet?: string;
  isoDate?: string;
  pubDate?: string;
}

function buildRssUrl(rssQuery: string): string {
  return `${RSS_BASE}${encodeURIComponent(rssQuery)}`;
}

/** Um `rss_query` que já é uma URL http(s) é tratado como feed direto do veículo. */
export function isDirectFeedUrl(rssQuery: string): boolean {
  return /^https?:\/\//i.test(rssQuery.trim());
}

/**
 * Busca itens de um feed. Se `rssQuery` for uma URL, usa o feed direto do
 * veículo (ex.: Conjur, JOTA); caso contrário monta uma busca no Google News a
 * partir das palavras-chave. Feeds diretos ignoram o operador de recência
 * (não suportado fora do Google News).
 */
export async function fetchRssItems(
  rssQuery: string,
  monthsBack?: number
): Promise<RssItem[]> {
  const direct = isDirectFeedUrl(rssQuery);
  const url = direct
    ? rssQuery.trim()
    : buildRssUrl(buildRssQueryWithRecency(rssQuery, monthsBack));

  const parser = new Parser({
    headers: { "User-Agent": BROWSER_UA },
    timeout: 10000,
  });
  const feed = await parser.parseURL(url);
  return (feed.items ?? []).map((item) => ({
    title: item.title ?? "",
    link: item.link ?? undefined,
    contentSnippet: item.contentSnippet ?? item.content ?? undefined,
    isoDate: item.isoDate ?? undefined,
    pubDate: item.pubDate ?? undefined,
  }));
}

export function filterItems(items: RssItem[], monthsBack = 4): RssItem[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

  return items.filter((item) => {
    const title = item.title ?? "";
    const snippet = item.contentSnippet ?? "";
    const dateStr = item.isoDate ?? item.pubDate;
    if (!dateStr) return false;

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;

    const validTitle = title.length > 10;
    const validSnippet = snippet.length > 20;
    const inRange = date >= start && date <= now;

    return validTitle && validSnippet && inRange;
  });
}

export async function resolveNewsArea(
  openai: ReturnType<typeof createOpenAI>,
  title: string,
  snippet: string,
  topicLegalArea?: string | null
): Promise<{ area: string; skip: boolean }> {
  const prompt = buildClassifyPrompt(title, snippet, topicLegalArea);

  const { text } = await generateText({
    model: openai("gpt-4.1-mini"),
    prompt,
    temperature: 0.1,
  });

  const rawText = text?.trim() ?? "";
  if (isIrrelevantResponse(rawText)) {
    return { area: LEGAL_AREAS[0], skip: true };
  }

  const aiArea = parseClassifiedArea(rawText);
  const topicMapped = topicLegalArea ? mapTopicAreaToLegalArea(topicLegalArea) : null;

  let finalArea = aiArea;

  if (topicMapped && topicMapped !== "Operações Legais (Legal Ops)") {
    const reestruturacaoCluster = [
      "Reestruturação (Insolvência)",
      "Societário e Contrato",
      "Distressed Deals",
    ] as const;

    if (
      topicMapped === "Reestruturação (Insolvência)" &&
      reestruturacaoCluster.includes(aiArea as (typeof reestruturacaoCluster)[number])
    ) {
      finalArea = aiArea;
    } else if (topicMapped !== "Reestruturação (Insolvência)") {
      finalArea = aiArea;
    } else {
      finalArea = topicMapped;
    }
  }

  return validateClassifiedArea(finalArea, title, snippet);
}

export async function generateCarousel(
  openai: ReturnType<typeof createOpenAI>,
  title: string,
  snippet: string,
  link: string,
  area: string,
  performanceBlock?: string,
  articleText?: string
): Promise<string> {
  const prompt = CAROUSEL_PROMPT.replace("{{TITLE}}", title)
    .replace("{{SNIPPET}}", snippet)
    .replace(
      "{{ARTICLE}}",
      articleText && articleText.length > 0
        ? articleText
        : "(não disponível — use o resumo acima)"
    )
    .replace("{{LINK}}", link)
    .replace("{{AREA}}", area)
    .replace("{{PERFORMANCE}}", performanceBlock ? `\n${performanceBlock}` : "");

  const { text } = await generateText({
    model: openai("gpt-4.1-mini"),
    prompt,
    temperature: 0.7,
  });

  return text?.trim() ?? "";
}

export interface ContentRoteiro {
  id: string;
  topic_id: string;
  title: string;
  link: string | null;
  content_snippet: string | null;
  area: string;
  post: string;
  status: string;
  published_at: string | null;
  created_at: string;
  approved_by_id?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  has_alterations?: boolean | null;
  alterations_notes?: string | null;
  sent_for_manager_review?: boolean | null;
  performance_hint?: string | null;
  image_url?: string | null;
  original_post?: string | null;
  edited_by_id?: string | null;
  edited_by_name?: string | null;
  edited_at?: string | null;
  reviewer_approved_at?: string | null;
  sent_to_mkt_at?: string | null;
  sent_to_mkt_by_name?: string | null;
  marketing_request_id?: string | null;
  vios_task_id?: string | null;
}

export interface UserViosTaskOption {
  id: string;
  vios_id: string;
  tarefa: string;
  area_processo: string | null;
  data_limite: string | null;
  status: string;
  already_linked: boolean;
}

export async function fetchContentRoteiros(options?: {
  status?: string;
  topic_id?: string;
  area?: string;
  areas?: string[];
  max_age_days?: number;
}): Promise<ContentRoteiro[]> {
  const maxAgeDays = options?.max_age_days ?? CONTENT_MAX_AGE_DAYS;
  const since = getContentCutoffDate(maxAgeDays);

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("content_roteiros")
    .select("id, topic_id, title, link, content_snippet, area, post, status, published_at, created_at, approved_by_id, approved_by_name, approved_at, has_alterations, alterations_notes, sent_for_manager_review, performance_hint, image_url, original_post, edited_by_id, edited_by_name, edited_at, reviewer_approved_at, sent_to_mkt_at, sent_to_mkt_by_name, marketing_request_id, vios_task_id")
    .gte("created_at", since.toISOString())
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.topic_id) {
    query = query.eq("topic_id", options.topic_id);
  }
  if (options?.area) {
    query = query.eq("area", options.area);
  } else if (options?.areas && options.areas.length > 0) {
    query = query.in("area", options.areas);
  } else if (options?.areas && options.areas.length === 0) {
    return [];
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as ContentRoteiro[]).filter(
    (r) => getRoteiroDate(r) >= since
  );
}

export async function fetchRoteiroById(id: string): Promise<ContentRoteiro | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_roteiros")
    .select("id, topic_id, title, link, content_snippet, area, post, status, published_at, created_at, approved_by_id, approved_by_name, approved_at, has_alterations, alterations_notes, sent_for_manager_review, performance_hint, image_url, original_post, edited_by_id, edited_by_name, edited_at, reviewer_approved_at, sent_to_mkt_at, sent_to_mkt_by_name, marketing_request_id, vios_task_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ContentRoteiro | null;
}

/** Tarefas do VIOS atribuídas ao usuário (para vincular ao post). */
export async function fetchUserViosTasks(userId: string): Promise<UserViosTaskOption[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("vios_tasks")
    .select("id, vios_id, tarefa, area_processo, data_limite, status, marketing_request_id")
    .eq("assignee_id", userId)
    .in("status", ["pendente", "em_andamento"])
    .order("data_limite", { ascending: true, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((t) => ({
    id: t.id as string,
    vios_id: t.vios_id as string,
    tarefa: t.tarefa as string,
    area_processo: (t.area_processo as string | null) ?? null,
    data_limite: (t.data_limite as string | null) ?? null,
    status: t.status as string,
    already_linked: t.marketing_request_id != null,
  }));
}

/** Vincula (ou desvincula, com null) o post a uma tarefa do VIOS. */
export async function linkRoteiroViosTask(
  id: string,
  viosTaskId: string | null
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("content_roteiros")
    .update({ vios_task_id: viosTaskId })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface ApprovalData {
  approved_by_id: string;
  approved_by_name: string;
  has_alterations?: boolean;
  alterations_notes?: string | null;
  sent_for_manager_review?: boolean;
  post?: string;
}

export type RoteiroStatus =
  | "aguardando_aprovacao"
  | "em_revisao"
  | "aprovado_revisor"
  | "enviado_mkt"
  | "aprovado"
  | "rejeitado";

export async function updateRoteiroStatus(
  id: string,
  status: RoteiroStatus,
  approvalData?: ApprovalData,
  postOverride?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const updates: Record<string, unknown> = { status };

  if (status === "aprovado" && approvalData) {
    updates.approved_by_id = approvalData.approved_by_id;
    updates.approved_by_name = approvalData.approved_by_name;
    updates.approved_at = new Date().toISOString();
    updates.has_alterations = approvalData.has_alterations ?? false;
    updates.alterations_notes = approvalData.alterations_notes ?? null;
    updates.sent_for_manager_review = approvalData.sent_for_manager_review ?? false;
    if (approvalData.post !== undefined) {
      updates.post = approvalData.post;
    }
  }

  // Colaborador validou e enviou ao revisor (VIOS): registra quem validou.
  if (status === "em_revisao" && approvalData) {
    updates.approved_by_id = approvalData.approved_by_id;
    updates.approved_by_name = approvalData.approved_by_name;
    updates.approved_at = new Date().toISOString();
  }

  // Colaborador marcou que o revisor aprovou.
  if (status === "aprovado_revisor") {
    updates.reviewer_approved_at = new Date().toISOString();
  }

  // Edição avulsa do texto (ex.: colaborador ajustando no modal de detalhe).
  if (postOverride !== undefined) {
    updates.post = postOverride;
  }

  const { error } = await supabase
    .from("content_roteiros")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Envia o post aprovado ao marketing: cria um card no Planner
 * (marketing_requests, tipo "Post Redes Sociais") e marca o roteiro como enviado.
 */
/** Designer padrão atribuída aos posts enviados ao marketing. */
const DEFAULT_DESIGNER_NAME = "Valentina Iacovacci";

/** Soma N dias úteis (pula sábado/domingo) a uma data. */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function sendRoteiroToMarketing(
  id: string,
  sender: { id?: string | null; name?: string | null },
  origin?: string
): Promise<{ marketing_request_id: string }> {
  const supabase = getSupabaseAdmin();

  const { data: r, error: fetchErr } = await supabase
    .from("content_roteiros")
    .select("title, area, post, link, content_snippet, vios_task_id")
    .eq("id", id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!r) throw new Error("Conteúdo de post não encontrado.");

  const description = [
    r.content_snippet ? `Notícia: ${r.content_snippet}` : null,
    r.link ? `Link da notícia: ${r.link}` : null,
    "",
    "--- Texto do post (carrossel) ---",
    r.post,
  ]
    .filter((l) => l !== null)
    .join("\n");

  // Mapeia a área jurídica para o nome de departamento usado no Planner.
  const requestingArea = getDepartmentsForLegalArea(r.area)[0] ?? r.area;

  // Designer padrão (Valentina): busca o id pelo nome, se existir.
  const { data: designer } = await supabase
    .from("users")
    .select("id, name")
    .ilike("name", DEFAULT_DESIGNER_NAME)
    .maybeSingle();

  // Prazo: 2 dias úteis às 14:00.
  const deadline = formatDateYMD(addBusinessDays(new Date(), 2));

  // Link do card aponta para o documento Word (gerado sob demanda).
  const wordLink = origin
    ? `${origin.replace(/\/$/, "")}/api/content-roteiros/word?id=${id}`
    : null;

  const { data: created, error: insertErr } = await supabase
    .from("marketing_requests")
    .insert({
      title: r.title,
      description,
      requesting_area: requestingArea,
      request_type: "Post Redes Sociais",
      status: "pending",
      workflow_stage: "tarefas",
      priority: "normal",
      link: wordLink,
      deadline,
      deadline_time: "14:00",
      assignee: designer?.name ?? DEFAULT_DESIGNER_NAME,
      assignee_id: designer?.id ?? null,
      solicitante: sender.name ?? null,
      solicitante_id: sender.id ?? null,
      created_by: sender.name ?? null,
      created_by_id: sender.id ?? null,
      nome_advogado: sender.name ?? null,
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);

  const { error: updateErr } = await supabase
    .from("content_roteiros")
    .update({
      status: "enviado_mkt",
      sent_to_mkt_at: new Date().toISOString(),
      sent_to_mkt_by_name: sender.name ?? null,
      marketing_request_id: created.id,
    })
    .eq("id", id);
  if (updateErr) throw new Error(updateErr.message);

  // Vincula a tarefa do VIOS ao card do Planner (se houver vínculo).
  if (r.vios_task_id) {
    await supabase
      .from("vios_tasks")
      .update({ marketing_request_id: created.id })
      .eq("id", r.vios_task_id as string);
  }

  return { marketing_request_id: created.id as string };
}

/**
 * Salva a edição do colaborador ("ficar com este texto"). Preserva o texto
 * original da IA e marca has_alterations quando o texto final difere do original.
 */
export async function saveRoteiroEdit(
  id: string,
  post: string,
  editor: { id?: string | null; name?: string | null }
): Promise<{ has_alterations: boolean }> {
  const supabase = getSupabaseAdmin();

  const { data: current, error: fetchErr } = await supabase
    .from("content_roteiros")
    .select("post, original_post")
    .eq("id", id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  // Texto da IA: o que já estava salvo como original, ou o post atual (antes desta edição).
  const aiOriginal = current?.original_post ?? current?.post ?? "";
  const hasAlterations = post.trim() !== aiOriginal.trim();

  const { error } = await supabase
    .from("content_roteiros")
    .update({
      post,
      original_post: current?.original_post ?? current?.post ?? null,
      edited_by_id: editor.id ?? null,
      edited_by_name: editor.name ?? null,
      edited_at: new Date().toISOString(),
      has_alterations: hasAlterations,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  return { has_alterations: hasAlterations };
}

export interface FetchPipelineOptions {
  monthsBack?: number;
  limit?: number;
  /**
   * Busca o conteúdo real da matéria (texto + capa) para cada post gerado.
   * Padrão true. Desligue para execuções mais rápidas (só título+snippet).
   */
  fetchArticle?: boolean;
  /** Para após criar N roteiros (evita execuções longas demais). */
  maxCreated?: number;
  /** Origem da execução, para o log (`cron`, `manual`, etc.). */
  trigger?: string;
}

/** Chave normalizada de título para detectar notícias repetidas (ignora veículo, acentos, pontuação). */
export function normalizeTitleKey(title: string): string {
  return (title || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+[-–|]\s+[^-–|]+$/, "") // remove sufixo " - Veículo"
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 12)
    .join(" ");
}

/** Embaralha (Fisher–Yates) — distribui a cota entre as fontes a cada execução. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function runFetchPipeline(
  topicIds?: string[],
  topics?: ContentTopic[],
  options?: FetchPipelineOptions
): Promise<{ created: number; errors: string[]; skipped: number }> {
  const apiKey = process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_OPENAI_API_KEY não configurada.");
  }

  const openai = createOpenAI({ apiKey });
  const supabase = getSupabaseAdmin();

  const monthsBack = options?.monthsBack ?? 4;
  const limit = options?.limit ?? 20;
  const fetchArticle = options?.fetchArticle ?? true;
  const maxCreated = options?.maxCreated;
  const trigger = options?.trigger ?? "manual";
  const startedAt = new Date();

  let topicsToProcess: ContentTopic[];
  if (topics && topics.length > 0) {
    topicsToProcess = topics;
  } else {
    const { data } = await supabase
      .from("content_topics")
      .select("id, name, rss_query, legal_area, is_active, months_back, item_limit")
      .eq("is_active", true);
    topicsToProcess = (data ?? []) as ContentTopic[];
    if (topicIds && topicIds.length > 0) {
      topicsToProcess = topicsToProcess.filter((t) => topicIds.includes(t.id));
    }
  }

  if (topicsToProcess.length === 0) {
    throw new Error("Nenhum tema ativo para processar.");
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Dedupe: carrega links/títulos já existentes (janela recente) para não repetir.
  const dedupeSince = getContentCutoffDate(120);
  const { data: existing } = await supabase
    .from("content_roteiros")
    .select("link, title")
    .gte("created_at", dedupeSince.toISOString());
  const seenLinks = new Set<string>(
    (existing ?? []).map((r) => (r.link as string | null) ?? "").filter(Boolean)
  );
  const seenTitles = new Set<string>(
    (existing ?? []).map((r) => normalizeTitleKey((r.title as string) ?? "")).filter(Boolean)
  );

  // Carrega o histórico de performance do Instagram uma vez e memoiza por área.
  let performancePosts: InstagramPost[] = [];
  try {
    performancePosts = await fetchPerformancePostsWindow();
  } catch {
    performancePosts = [];
  }
  const performanceCache = new Map<string, AreaPerformanceContext | null>();
  const getPerformance = (area: string): AreaPerformanceContext | null => {
    if (performancePosts.length === 0) return null;
    if (!performanceCache.has(area)) {
      performanceCache.set(area, buildAreaPerformanceContext(performancePosts, area));
    }
    return performanceCache.get(area) ?? null;
  };

  // Distribui a cota entre as fontes: embaralha a ordem e limita quantos posts
  // cada tema pode criar por execução, para um único feed não esgotar o maxCreated
  // e as fontes novas sempre serem amostradas.
  const orderedTopics = shuffle(topicsToProcess);
  const perTopicMax =
    maxCreated != null
      ? Math.max(2, Math.ceil(maxCreated / orderedTopics.length))
      : Infinity;

  topicLoop: for (const topic of orderedTopics) {
    try {
      const topicMonths = "months_back" in topic ? topic.months_back : monthsBack;
      const topicLimit = "item_limit" in topic ? topic.item_limit : limit;
      const items = await fetchRssItems(topic.rss_query, topicMonths);
      const filtered = filterItems(items, topicMonths);
      const limited = filtered.slice(0, topicLimit);

      let createdThisTopic = 0;
      for (const item of limited) {
        if (maxCreated != null && created >= maxCreated) break topicLoop;
        if (createdThisTopic >= perTopicMax) break; // próxima fonte

        try {
          const title = item.title;
          const snippet = item.contentSnippet ?? "";

          // Dedupe: pula notícia já transformada em post (mesmo link ou título).
          const titleKey = normalizeTitleKey(title);
          const linkKey = item.link ?? "";
          if ((linkKey && seenLinks.has(linkKey)) || (titleKey && seenTitles.has(titleKey))) {
            skipped++;
            continue;
          }

          // Pré-filtro barato: descarta lixo óbvio (polícia/crime/etc.) ANTES de
          // gastar chamadas de IA. Importante para feeds diretos mais amplos.
          if (shouldSkipAsIrrelevant(title, snippet)) {
            skipped++;
            continue;
          }

          // Tema de Legal Ops: descarta ruído de release corporativo (captação de
          // investimento, troca de sede, nomeação de executivo, prêmio) ANTES da
          // IA — são notícias que citam "legaltech"/"departamento jurídico" sem
          // conteúdo educativo aproveitável para o carrossel.
          if (
            mapTopicAreaToLegalArea(topic.legal_area) === "Operações Legais (Legal Ops)" &&
            isPressReleaseNoise(title, snippet)
          ) {
            skipped++;
            continue;
          }

          const rawArea = await resolveNewsArea(
            openai,
            title,
            snippet,
            topic.legal_area
          );
          if (rawArea.skip) continue;
          const area = rawArea.area;

          // Só agora (item aprovado) buscamos o conteúdo real — texto + capa numa
          // única requisição. Limita as buscas HTTP aos itens que viram post.
          const article = fetchArticle
            ? await fetchArticleContent(item.link)
            : { text: "", imageUrl: null };

          const performance = getPerformance(area);
          const imageUrl = article.imageUrl;

          const post = await generateCarousel(
            openai,
            title,
            snippet,
            item.link ?? "",
            area,
            performance?.promptBlock,
            article.text
          );

          const publishedAt = item.isoDate ?? item.pubDate;
          const { error: insertErr } = await supabase.from("content_roteiros").insert({
            topic_id: topic.id,
            title,
            link: item.link ?? null,
            content_snippet: snippet || null,
            area,
            post,
            status: "aguardando_aprovacao",
            published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
            performance_hint: performance?.collaboratorHint ?? null,
            image_url: imageUrl,
          });

          if (insertErr) {
            errors.push(`${item.title}: ${insertErr.message}`);
          } else {
            created++;
            createdThisTopic++;
            // Registra para não repetir dentro da mesma execução.
            if (linkKey) seenLinks.add(linkKey);
            if (titleKey) seenTitles.add(titleKey);
          }
        } catch (err) {
          errors.push(
            `${item.title}: ${err instanceof Error ? err.message : "Erro desconhecido"}`
          );
        }
      }
    } catch (err) {
      errors.push(
        `${topic.name}: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    }
  }

  await logFetchRun(supabase, {
    trigger,
    startedAt,
    topicsProcessed: topicsToProcess.length,
    created,
    skipped,
    errors,
  });

  return { created, errors, skipped };
}

/** Registra o resultado de uma execução do pipeline (observabilidade). Best-effort. */
async function logFetchRun(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  run: {
    trigger: string;
    startedAt: Date;
    topicsProcessed: number;
    created: number;
    skipped: number;
    errors: string[];
  }
): Promise<void> {
  try {
    await supabase.from("content_fetch_runs").insert({
      trigger: run.trigger,
      started_at: run.startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      topics_processed: run.topicsProcessed,
      created: run.created,
      skipped: run.skipped,
      error_count: run.errors.length,
      errors: run.errors.slice(0, 20),
    });
  } catch {
    // Tabela de log é opcional — nunca derruba o pipeline.
  }
}

export interface ContentFetchRun {
  id: string;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  topics_processed: number;
  created: number;
  skipped: number;
  error_count: number;
  errors: string[] | null;
}

/** Últimas execuções do pipeline, para a tela de admin/diagnóstico. */
export async function fetchRecentFetchRuns(limit = 10): Promise<ContentFetchRun[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_fetch_runs")
    .select("id, trigger, started_at, finished_at, topics_processed, created, skipped, error_count, errors")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as ContentFetchRun[];
}
