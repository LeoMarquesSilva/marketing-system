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
  const apiKey = process.env.NEXT_OPENAI_API_KEY;
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
  const { data: existing } = await supabase
    .from("content_roteiros")
    .select("id, title, link")
    .gte("created_at", getContentCutoffDate(120).toISOString());

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

  // Mesmo contexto de performance usado no pipeline de RSS.
  let performanceBlock: string | undefined;
  let collaboratorHint: string | null = null;
  try {
    const posts = await fetchPerformancePostsWindow();
    const context = posts.length > 0 ? buildAreaPerformanceContext(posts, area) : null;
    performanceBlock = context?.promptBlock;
    collaboratorHint = context?.collaboratorHint ?? null;
  } catch {
    // Histórico é opcional: sem ele o post ainda é gerado.
  }

  const post = await generateCarousel(
    openai,
    title,
    snippet,
    link,
    area,
    performanceBlock,
    article.text
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
