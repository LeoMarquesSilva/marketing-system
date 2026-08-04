/**
 * Boletim (newsletter) por área jurídica.
 *
 * Diferente do carrossel, aqui a curadoria é manual: o sócio escolhe quais
 * notícias entram na edição e a IA redige cada uma em tom institucional, em
 * parágrafos corridos. O texto gerado fica editável e a edição é assinada por
 * quem responde pelo conteúdo.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { fetchArticleContent } from "@/lib/content-extraction";
import { getSupabaseAdmin } from "@/lib/content-roteiros";

export const NEWSLETTER_STATUSES = ["rascunho", "em_revisao", "assinado"] as const;
export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];

export interface NewsletterItem {
  id: string;
  newsletter_id: string;
  position: number;
  roteiro_id: string | null;
  source_link: string | null;
  source_title: string | null;
  headline: string;
  body: string;
  original_body: string | null;
  edited_by_id: string | null;
  edited_by_name: string | null;
  edited_at: string | null;
  created_at: string;
}

export interface Newsletter {
  id: string;
  title: string;
  edition_label: string | null;
  area: string;
  status: NewsletterStatus;
  intro_title: string | null;
  intro_body: string | null;
  signature_names: string | null;
  collaborator_names: string | null;
  signed_by_id: string | null;
  signed_by_name: string | null;
  signed_at: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsletterWithItems extends Newsletter {
  items: NewsletterItem[];
}

export interface NewsletterActor {
  id: string | null;
  name: string | null;
}

export class NewsletterError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "NewsletterError";
  }
}

const NEWSLETTER_COLUMNS =
  "id, title, edition_label, area, status, intro_title, intro_body, signature_names, collaborator_names, signed_by_id, signed_by_name, signed_at, created_by_id, created_by_name, created_at, updated_at";

const ITEM_COLUMNS =
  "id, newsletter_id, position, roteiro_id, source_link, source_title, headline, body, original_body, edited_by_id, edited_by_name, edited_at, created_at";

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export const NEWSLETTER_ITEM_PROMPT = `Você é advogado redator de um escritório de advocacia e está escrevendo uma seção de uma newsletter informativa periódica enviada a clientes.

Escreva o texto desta notícia seguindo exatamente este formato:

Título: manchete objetiva e informativa, sem sensacionalismo, citando o processo, tema repetitivo ou norma quando houver (ex.: "STJ define que cotas condominiais são créditos extraconcursais (Tema 1391)")
Corpo: de 3 a 5 parágrafos corridos.

Regras de redação:
- Tom institucional e técnico-jurídico, como um informativo de escritório de advocacia. Nada de linguagem de rede social, emojis, hashtags, bullets ou chamada para ação.
- Abra situando o fato (o que aconteceu, quando, quem, em que juízo ou tribunal).
- Desenvolva os fundamentos jurídicos: cite dispositivos legais, números de lei, teses fixadas, temas repetitivos e números de processo SOMENTE quando aparecerem no material fornecido.
- Feche com o impacto prático para empresas, credores e para o mercado.
- Não invente fatos, números, datas ou citações que não estejam no material.
- Não mencione o veículo de imprensa nem escreva "segundo a reportagem".
- Não se dirija ao leitor na segunda pessoa e não ofereça serviços do escritório.
- Escreva em português do Brasil.

Área da newsletter: {{AREA}}

**Notícia**
Título: {{TITLE}}
Resumo: {{SNIPPET}}
Conteúdo da matéria: {{ARTICLE}}
Link: {{LINK}}
{{INSTRUCTIONS}}

Responda apenas com o texto no formato pedido, começando por "Título:".`;

export const NEWSLETTER_INTRO_PROMPT = `Você é advogado redator de um escritório de advocacia e está escrevendo o texto de abertura de uma newsletter informativa periódica da área de {{AREA}}, enviada a clientes.

Escreva neste formato:

Título: título curto da abertura
Corpo: de 1 a 2 parágrafos.

Regras:
- Tom institucional, acolhedor e sóbrio, como a carta de abertura de um informativo de escritório.
- Apresente brevemente o panorama do período a partir dos assuntos listados abaixo, sem repetir o detalhamento de cada um.
- Não invente fatos que não estejam nos títulos listados.
- Não use bullets, emojis nem chamada para ação comercial.
- Escreva em português do Brasil.

Assuntos desta edição:
{{HEADLINES}}

Responda apenas com o texto no formato pedido, começando por "Título:".`;

/** Separa a resposta da IA em manchete e corpo. */
export function parseGeneratedSection(text: string): { headline: string; body: string } {
  const lines = (text ?? "").split("\n");
  let headline = "";
  const bodyLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\*\*/g, "");
    if (!line) {
      if (bodyLines.length > 0) bodyLines.push("");
      continue;
    }

    const titleMatch = line.match(/^t[íi]tulo\s*:\s*(.*)$/i);
    if (titleMatch && !headline) {
      headline = titleMatch[1].trim();
      continue;
    }

    const bodyMatch = line.match(/^corpo\s*:\s*(.*)$/i);
    if (bodyMatch) {
      if (bodyMatch[1].trim()) bodyLines.push(bodyMatch[1].trim());
      continue;
    }

    bodyLines.push(line);
  }

  const body = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // Sem rótulo "Título:", a primeira linha vira a manchete.
  if (!headline && bodyLines.length > 0) {
    headline = bodyLines[0];
    return { headline, body: bodyLines.slice(1).join("\n").trim() };
  }
  return { headline, body };
}

function getOpenAI() {
  const apiKey = process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) {
    throw new NewsletterError("Geração por IA não está configurada.", 503);
  }
  return createOpenAI({ apiKey });
}

export interface GenerateSectionInput {
  title: string;
  snippet?: string | null;
  link?: string | null;
  area: string;
  /** Texto da matéria já extraído; quando ausente, é buscado a partir do link. */
  articleText?: string | null;
  /** Pedido extra do usuário ao regerar (ex.: "encurte e foque no impacto"). */
  instructions?: string | null;
}

/** Redige uma seção do boletim a partir de uma notícia. */
export async function generateNewsletterSection(
  input: GenerateSectionInput
): Promise<{ headline: string; body: string }> {
  const openai = getOpenAI();

  let articleText = input.articleText ?? "";
  if (!articleText && input.link) {
    try {
      const article = await fetchArticleContent(input.link);
      articleText = article.text;
    } catch {
      // Veículo pode bloquear o servidor; seguimos com título e resumo.
    }
  }

  const snippet = (input.snippet ?? "").trim();
  if (!articleText && !snippet) {
    throw new NewsletterError(
      "Não há texto suficiente da notícia para redigir a seção da newsletter.",
      422
    );
  }

  const prompt = NEWSLETTER_ITEM_PROMPT.replace("{{AREA}}", input.area)
    .replace("{{TITLE}}", input.title)
    .replace("{{SNIPPET}}", snippet || "(não disponível)")
    .replace(
      "{{ARTICLE}}",
      articleText || "(não disponível — use o resumo acima)"
    )
    .replace("{{LINK}}", input.link ?? "(não disponível)")
    .replace(
      "{{INSTRUCTIONS}}",
      input.instructions?.trim()
        ? `\n**Ajuste pedido pelo revisor**\n${input.instructions.trim()}`
        : ""
    );

  const { text } = await generateText({
    model: openai("gpt-4.1-mini"),
    prompt,
    temperature: 0.4,
  });

  const parsed = parseGeneratedSection(text?.trim() ?? "");
  if (!parsed.body) {
    throw new NewsletterError("A IA não retornou um texto válido para esta notícia.", 502);
  }
  return { headline: parsed.headline || input.title, body: parsed.body };
}

/** Sugere o texto de abertura a partir das manchetes já na edição. */
export async function generateNewsletterIntro(
  area: string,
  headlines: string[]
): Promise<{ headline: string; body: string }> {
  if (headlines.length === 0) {
    throw new NewsletterError(
      "Adicione ao menos uma notícia antes de gerar a abertura.",
      400
    );
  }

  const openai = getOpenAI();
  const prompt = NEWSLETTER_INTRO_PROMPT.replace("{{AREA}}", area).replace(
    "{{HEADLINES}}",
    headlines.map((h) => `- ${h}`).join("\n")
  );

  const { text } = await generateText({
    model: openai("gpt-4.1-mini"),
    prompt,
    temperature: 0.5,
  });

  const parsed = parseGeneratedSection(text?.trim() ?? "");
  if (!parsed.body) {
    throw new NewsletterError("A IA não retornou um texto válido para a abertura.", 502);
  }
  return { headline: parsed.headline || "Nesta edição", body: parsed.body };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listNewsletters(options?: {
  areas?: string[];
  area?: string;
}): Promise<Newsletter[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("content_newsletters")
    .select(NEWSLETTER_COLUMNS)
    .order("created_at", { ascending: false });

  if (options?.area) {
    query = query.eq("area", options.area);
  } else if (options?.areas) {
    if (options.areas.length === 0) return [];
    query = query.in("area", options.areas);
  }

  const { data, error } = await query;
  if (error) throw new NewsletterError(error.message, 500);
  return (data ?? []) as unknown as Newsletter[];
}

export async function fetchNewsletter(id: string): Promise<NewsletterWithItems | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_newsletters")
    .select(NEWSLETTER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new NewsletterError(error.message, 500);
  if (!data) return null;

  const { data: items, error: itemsError } = await supabase
    .from("content_newsletter_items")
    .select(ITEM_COLUMNS)
    .eq("newsletter_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (itemsError) throw new NewsletterError(itemsError.message, 500);

  return {
    ...(data as unknown as Newsletter),
    items: (items ?? []) as unknown as NewsletterItem[],
  };
}

export interface CreateNewsletterInput {
  title: string;
  area: string;
  edition_label?: string | null;
}

export async function createNewsletter(
  input: CreateNewsletterInput,
  actor: NewsletterActor
): Promise<Newsletter> {
  const title = input.title.trim();
  if (title.length < 3) {
    throw new NewsletterError("Informe um título para a edição.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_newsletters")
    .insert({
      title,
      area: input.area,
      edition_label: input.edition_label?.trim() || null,
      signature_names: actor.name ?? null,
      created_by_id: actor.id,
      created_by_name: actor.name,
    })
    .select(NEWSLETTER_COLUMNS)
    .single();

  if (error || !data) {
    throw new NewsletterError(error?.message ?? "Não foi possível criar a edição.", 500);
  }
  return data as unknown as Newsletter;
}

const EDITABLE_FIELDS = [
  "title",
  "edition_label",
  "intro_title",
  "intro_body",
  "signature_names",
  "collaborator_names",
] as const;

export type NewsletterUpdate = Partial<
  Record<(typeof EDITABLE_FIELDS)[number], string | null>
> & { status?: NewsletterStatus };

export async function updateNewsletter(
  id: string,
  update: NewsletterUpdate
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (update[field] !== undefined) {
      const value = update[field];
      updates[field] = typeof value === "string" ? value.trim() || null : null;
    }
  }
  if (update.status !== undefined) {
    if (!NEWSLETTER_STATUSES.includes(update.status)) {
      throw new NewsletterError("Status inválido.", 400);
    }
    updates.status = update.status;
    // Reabrir para edição desfaz a assinatura anterior.
    if (update.status !== "assinado") {
      updates.signed_by_id = null;
      updates.signed_by_name = null;
      updates.signed_at = null;
    }
  }
  if (Object.keys(updates).length === 0) return;

  // O título é obrigatório no banco; não deixamos ser apagado pela edição.
  if (updates.title === null) {
    throw new NewsletterError("Informe um título para a edição.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("content_newsletters")
    .update(updates)
    .eq("id", id);
  if (error) throw new NewsletterError(error.message, 500);
}

/** Assina a edição em nome do sócio responsável e trava a edição. */
export async function signNewsletter(
  id: string,
  actor: NewsletterActor
): Promise<void> {
  const newsletter = await fetchNewsletter(id);
  if (!newsletter) throw new NewsletterError("Edição não encontrada.", 404);
  if (newsletter.items.length === 0) {
    throw new NewsletterError("Adicione ao menos uma notícia antes de assinar.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("content_newsletters")
    .update({
      status: "assinado",
      signed_by_id: actor.id,
      signed_by_name: actor.name,
      signed_at: new Date().toISOString(),
      signature_names: newsletter.signature_names ?? actor.name ?? null,
    })
    .eq("id", id);
  if (error) throw new NewsletterError(error.message, 500);
}

export async function deleteNewsletter(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("content_newsletters").delete().eq("id", id);
  if (error) throw new NewsletterError(error.message, 500);
}

/** Impede alterações numa edição já assinada. */
export async function assertNewsletterEditable(id: string): Promise<Newsletter> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_newsletters")
    .select(NEWSLETTER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new NewsletterError(error.message, 500);
  if (!data) throw new NewsletterError("Edição não encontrada.", 404);

  const newsletter = data as unknown as Newsletter;
  if (newsletter.status === "assinado") {
    throw new NewsletterError(
      "Esta edição está assinada. Reabra para edição antes de alterar.",
      409
    );
  }
  return newsletter;
}

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

async function nextPosition(newsletterId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("content_newsletter_items")
    .select("position")
    .eq("newsletter_id", newsletterId)
    .order("position", { ascending: false })
    .limit(1);
  const last = (data?.[0]?.position as number | undefined) ?? -1;
  return last + 1;
}

export interface AddItemsResult {
  created: NewsletterItem[];
  errors: { roteiro_id: string; title: string; message: string }[];
}

/** Adiciona notícias já coletadas (content_roteiros) à edição, redigindo cada uma. */
export async function addItemsFromRoteiros(
  newsletterId: string,
  roteiroIds: string[]
): Promise<AddItemsResult> {
  const newsletter = await assertNewsletterEditable(newsletterId);
  const supabase = getSupabaseAdmin();

  const { data: roteiros, error } = await supabase
    .from("content_roteiros")
    .select("id, title, link, content_snippet, area")
    .in("id", roteiroIds);
  if (error) throw new NewsletterError(error.message, 500);

  const { data: existing } = await supabase
    .from("content_newsletter_items")
    .select("roteiro_id")
    .eq("newsletter_id", newsletterId);
  const alreadyIn = new Set(
    (existing ?? []).map((row) => row.roteiro_id as string | null).filter(Boolean)
  );

  const created: NewsletterItem[] = [];
  const errors: AddItemsResult["errors"] = [];
  let position = await nextPosition(newsletterId);

  for (const roteiro of (roteiros ?? []) as Record<string, unknown>[]) {
    const id = roteiro.id as string;
    const title = (roteiro.title as string) ?? "";
    if (alreadyIn.has(id)) {
      errors.push({ roteiro_id: id, title, message: "Já está nesta edição." });
      continue;
    }

    try {
      const section = await generateNewsletterSection({
        title,
        snippet: (roteiro.content_snippet as string | null) ?? null,
        link: (roteiro.link as string | null) ?? null,
        area: newsletter.area,
      });

      const { data: inserted, error: insertError } = await supabase
        .from("content_newsletter_items")
        .insert({
          newsletter_id: newsletterId,
          position: position++,
          roteiro_id: id,
          source_link: (roteiro.link as string | null) ?? null,
          source_title: title,
          headline: section.headline,
          body: section.body,
          original_body: section.body,
        })
        .select(ITEM_COLUMNS)
        .single();

      if (insertError || !inserted) {
        throw new Error(insertError?.message ?? "Falha ao salvar a seção.");
      }
      created.push(inserted as unknown as NewsletterItem);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao redigir a seção.";
      errors.push({ roteiro_id: id, title, message });
    }
  }

  return { created, errors };
}

/** Adiciona uma notícia a partir de um link avulso colado pelo usuário. */
export async function addItemFromLink(
  newsletterId: string,
  url: string
): Promise<NewsletterItem> {
  const newsletter = await assertNewsletterEditable(newsletterId);

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new NewsletterError("Informe um link http(s) válido.", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new NewsletterError("Informe um link http(s) válido.", 400);
  }

  const article = await fetchArticleContent(parsed.toString());
  const link = article.resolvedUrl ?? parsed.toString();
  const title = (article.title ?? "").trim();

  if (!article.text || title.length < 15) {
    throw new NewsletterError(
      "Esse site não deixa o sistema ler a matéria (bloqueio do veículo, login ou paywall).",
      422
    );
  }

  const section = await generateNewsletterSection({
    title,
    snippet: article.text.slice(0, 600),
    link,
    area: newsletter.area,
    articleText: article.text,
  });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_newsletter_items")
    .insert({
      newsletter_id: newsletterId,
      position: await nextPosition(newsletterId),
      roteiro_id: null,
      source_link: link,
      source_title: title,
      headline: section.headline,
      body: section.body,
      original_body: section.body,
    })
    .select(ITEM_COLUMNS)
    .single();

  if (error || !data) {
    throw new NewsletterError(error?.message ?? "Não foi possível salvar a seção.", 500);
  }
  return data as unknown as NewsletterItem;
}

export async function updateItemText(
  newsletterId: string,
  itemId: string,
  update: { headline?: string; body?: string },
  actor: NewsletterActor
): Promise<void> {
  await assertNewsletterEditable(newsletterId);

  const updates: Record<string, unknown> = {
    edited_by_id: actor.id,
    edited_by_name: actor.name,
    edited_at: new Date().toISOString(),
  };
  if (update.headline !== undefined) updates.headline = update.headline.trim();
  if (update.body !== undefined) updates.body = update.body.trim();

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("content_newsletter_items")
    .update(updates)
    .eq("id", itemId)
    .eq("newsletter_id", newsletterId);
  if (error) throw new NewsletterError(error.message, 500);
}

/** Reescreve a seção com a IA, opcionalmente com uma instrução do revisor. */
export async function regenerateItem(
  newsletterId: string,
  itemId: string,
  instructions?: string | null
): Promise<NewsletterItem> {
  const newsletter = await assertNewsletterEditable(newsletterId);
  const supabase = getSupabaseAdmin();

  const { data: item, error } = await supabase
    .from("content_newsletter_items")
    .select(ITEM_COLUMNS)
    .eq("id", itemId)
    .eq("newsletter_id", newsletterId)
    .maybeSingle();
  if (error) throw new NewsletterError(error.message, 500);
  if (!item) throw new NewsletterError("Seção não encontrada.", 404);

  const current = item as unknown as NewsletterItem;
  const section = await generateNewsletterSection({
    title: current.source_title ?? current.headline,
    snippet: current.body,
    link: current.source_link,
    area: newsletter.area,
    instructions,
  });

  const { data: updated, error: updateError } = await supabase
    .from("content_newsletter_items")
    .update({
      headline: section.headline,
      body: section.body,
      edited_by_id: null,
      edited_by_name: null,
      edited_at: null,
    })
    .eq("id", itemId)
    .eq("newsletter_id", newsletterId)
    .select(ITEM_COLUMNS)
    .single();
  if (updateError || !updated) {
    throw new NewsletterError(updateError?.message ?? "Falha ao regerar a seção.", 500);
  }
  return updated as unknown as NewsletterItem;
}

export async function deleteItem(newsletterId: string, itemId: string): Promise<void> {
  await assertNewsletterEditable(newsletterId);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("content_newsletter_items")
    .delete()
    .eq("id", itemId)
    .eq("newsletter_id", newsletterId);
  if (error) throw new NewsletterError(error.message, 500);
}

/** Reordena os itens conforme a sequência de ids recebida. */
export async function reorderItems(
  newsletterId: string,
  orderedIds: string[]
): Promise<void> {
  await assertNewsletterEditable(newsletterId);
  const supabase = getSupabaseAdmin();

  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error } = await supabase
      .from("content_newsletter_items")
      .update({ position: index })
      .eq("id", orderedIds[index])
      .eq("newsletter_id", newsletterId);
    if (error) throw new NewsletterError(error.message, 500);
  }
}
