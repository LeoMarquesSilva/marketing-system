import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { ContentTopic } from "./content-topics";

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

**Slide de Introdução**  
Título: Frase impactante e objetiva  
Conteúdo: Contextualização geral e relevância do tema

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
Link: {{LINK}}  
Área do Direito: {{AREA}}

Use linguagem acessível, objetiva, com tom profissional. Não cite diretamente o veículo de imprensa.`;

const CLASSIFY_PROMPT = `Você é um classificador jurídico especializado. Analise a seguinte notícia e classifique-a em UMA ÚNICA das áreas do Direito listadas abaixo, baseando-se no tema principal e no contexto jurídico:

ÁREAS DISPONÍVEIS:
- Cível (contratos, responsabilidade civil, direito de família, sucessões, indenizações)
- Trabalhista (relações de trabalho, CLT, demissões, rescisões, direitos trabalhistas)
- Reestruturação (Insolvência) (falência, recuperação judicial, concurso de credores, massa falida, credores)
- Societário e Contrato (constituição de empresas, fusões, aquisições, contratos comerciais, governança corporativa)
- Operações Legais (Legal Ops) (compliance, conformidade regulatória, processos legais internos, gestão de riscos jurídicos)
- Distressed Deals (aquisições de empresas em dificuldade, compra de ativos em insolvência, negociações com credores)

NOTÍCIA A CLASSIFICAR:
Título: {{TITLE}}
Resumo: {{SNIPPET}}

INSTRUÇÕES:
1. Leia com atenção o título e resumo.
2. Identifique as palavras-chave jurídicas.
3. Determine a área principal que melhor se encaixa.
4. Se houver dúvida entre duas áreas, escolha aquela que representa o tema CENTRAL da notícia.

RESPOSTA:
Forneça APENAS o nome da área, sem explicações adicionais. Exemplo: "Reestruturação (Insolvência)"`;

const RSS_BASE =
  "https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-419&q=";

function getSupabaseAdmin() {
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

async function fetchRssItems(rssQuery: string): Promise<RssItem[]> {
  const url = buildRssUrl(rssQuery);
  const parser = new Parser();
  const feed = await parser.parseURL(url);
  return (feed.items ?? []).map((item) => ({
    title: item.title ?? "",
    link: item.link ?? undefined,
    contentSnippet: item.contentSnippet ?? item.content ?? undefined,
    isoDate: item.isoDate ?? undefined,
    pubDate: item.pubDate ?? undefined,
  }));
}

function filterItems(items: RssItem[], monthsBack = 4): RssItem[] {
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

async function classifyNews(
  openai: ReturnType<typeof createOpenAI>,
  title: string,
  snippet: string
): Promise<string> {
  const prompt = CLASSIFY_PROMPT.replace("{{TITLE}}", title).replace(
    "{{SNIPPET}}",
    snippet
  );

  const { text } = await generateText({
    model: openai("gpt-4.1-mini"),
    prompt,
    temperature: 0.2,
  });

  const trimmed = text?.trim() ?? "";
  return LEGAL_AREAS.includes(trimmed as (typeof LEGAL_AREAS)[number])
    ? trimmed
    : LEGAL_AREAS[0];
}

async function generateCarousel(
  openai: ReturnType<typeof createOpenAI>,
  title: string,
  snippet: string,
  link: string,
  area: string
): Promise<string> {
  const prompt = CAROUSEL_PROMPT.replace("{{TITLE}}", title)
    .replace("{{SNIPPET}}", snippet)
    .replace("{{LINK}}", link)
    .replace("{{AREA}}", area);

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
}

export async function fetchContentRoteiros(options?: {
  status?: string;
  topic_id?: string;
  area?: string;
}): Promise<ContentRoteiro[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("content_roteiros")
    .select("id, topic_id, title, link, content_snippet, area, post, status, published_at, created_at, approved_by_id, approved_by_name, approved_at, has_alterations, alterations_notes, sent_for_manager_review")
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.topic_id) {
    query = query.eq("topic_id", options.topic_id);
  }
  if (options?.area) {
    query = query.eq("area", options.area);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentRoteiro[];
}

export interface ApprovalData {
  approved_by_id: string;
  approved_by_name: string;
  has_alterations?: boolean;
  alterations_notes?: string | null;
  sent_for_manager_review?: boolean;
  post?: string;
}

export async function updateRoteiroStatus(
  id: string,
  status: "aguardando_aprovacao" | "aprovado" | "rejeitado",
  approvalData?: ApprovalData
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

  const { error } = await supabase
    .from("content_roteiros")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export interface FetchPipelineOptions {
  monthsBack?: number;
  limit?: number;
}

export async function runFetchPipeline(
  topicIds?: string[],
  topics?: ContentTopic[],
  options?: FetchPipelineOptions
): Promise<{ created: number; errors: string[] }> {
  const apiKey = process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_OPENAI_API_KEY não configurada.");
  }

  const openai = createOpenAI({ apiKey });
  const supabase = getSupabaseAdmin();

  const monthsBack = options?.monthsBack ?? 4;
  const limit = options?.limit ?? 20;

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
  const errors: string[] = [];

  for (const topic of topicsToProcess) {
    try {
      const topicMonths = "months_back" in topic ? topic.months_back : monthsBack;
      const topicLimit = "item_limit" in topic ? topic.item_limit : limit;
      const items = await fetchRssItems(topic.rss_query);
      const filtered = filterItems(items, topicMonths);
      const limited = filtered.slice(0, topicLimit);

      for (const item of limited) {
        try {
          const area = await classifyNews(
            openai,
            item.title,
            item.contentSnippet ?? ""
          );
          const post = await generateCarousel(
            openai,
            item.title,
            item.contentSnippet ?? "",
            item.link ?? "",
            area
          );

          const publishedAt = item.isoDate ?? item.pubDate;
          const { error: insertErr } = await supabase.from("content_roteiros").insert({
            topic_id: topic.id,
            title: item.title,
            link: item.link ?? null,
            content_snippet: item.contentSnippet ?? null,
            area,
            post,
            status: "aguardando_aprovacao",
            published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
          });

          if (insertErr) {
            errors.push(`${item.title}: ${insertErr.message}`);
          } else {
            created++;
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

  return { created, errors };
}
