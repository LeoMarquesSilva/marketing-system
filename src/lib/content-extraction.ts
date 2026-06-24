/**
 * Resolução de links do Google News e extração de conteúdo do artigo real
 * (texto + og:image) em uma única busca. Usado pelo pipeline de notícias para
 * dar à IA o texto completo da matéria — não só o snippet do feed.
 *
 * Tudo aqui é best-effort: qualquer falha devolve null/"" e o pipeline segue
 * com o que tiver (título + snippet).
 */

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Tamanho máximo do texto do artigo enviado à IA (evita prompts gigantes). */
export const ARTICLE_TEXT_MAX_CHARS = 5000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 6000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_UA, ...(rest.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve o link "casca" do Google News para a URL real do veículo, usando o
 * endpoint batchexecute (assinatura data-n-a-ts / data-n-a-sg). Best-effort.
 */
export async function resolveGoogleNewsUrl(link: string): Promise<string | null> {
  const match = link.match(/\/articles\/([^?]+)/);
  if (!match) return /news\.google\./.test(link) ? null : link;
  const id = match[1];

  try {
    const artResp = await fetchWithTimeout(`https://news.google.com/rss/articles/${id}`);
    if (!artResp.ok) return null;
    const html = await artResp.text();
    const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    if (!ts || !sg) return null;

    const inner = JSON.stringify([
      "garturlreq",
      [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
        "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      id,
      Number(ts),
      sg,
    ]);
    const body = "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]));

    const resp = await fetchWithTimeout(
      "https://news.google.com/_/DotsSplashUi/data/batchexecute",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        timeoutMs: 6000,
      }
    );
    if (!resp.ok) return null;
    const txt = await resp.text();
    const real = txt.match(/https?:\/\/(?!news\.google|www\.google)[^"\\\s]+/)?.[0];
    return real ?? null;
  } catch {
    return null;
  }
}

export function extractOgImage(html: string): string | null {
  const head = html.slice(0, 200_000);
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    if (m?.[1]) {
      const url = m[1].trim();
      if (/^https?:\/\//i.test(url)) return url;
    }
  }
  return null;
}

/** Decodifica entidades HTML mais comuns para texto legível. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");
}

/**
 * Extrai o texto principal do artigo a partir do HTML. Heurística leve (sem
 * dependências): remove scripts/estilos/nav, prioriza <article>, e junta os
 * parágrafos mais substanciais. Devolve "" se não achar nada útil.
 */
export function extractArticleText(html: string): string {
  if (!html) return "";

  // Remove blocos que nunca contêm o corpo da matéria.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(nav|header|footer|aside|form|figure)[\s\S]*?<\/\1>/gi, " ");

  const collectParagraphs = (fragment: string): string[] => {
    const out: string[] = [];
    const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fragment)) !== null) {
      const text = decodeEntities(m[1].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      if (text.length >= 50) out.push(text);
    }
    return out;
  };

  // Começa pelos parágrafos do documento todo; se algum bloco <article> render
  // mais texto, prioriza ele. (Pegar só o primeiro <article> costuma capturar
  // um bloco lateral de "matérias relacionadas", não o corpo.)
  let best = collectParagraphs(cleaned);
  const articles = cleaned.match(/<article[\s\S]*?<\/article>/gi) ?? [];
  for (const article of articles) {
    const candidate = collectParagraphs(article);
    if (candidate.join(" ").length > best.join(" ").length) best = candidate;
  }

  let result = best.join("\n\n").trim();

  // Fallback: nenhum <p> útil — usa o texto cru do corpo.
  if (result.length < 200) {
    const stripped = decodeEntities(cleaned.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (stripped.length > result.length) result = stripped;
  }

  return result.slice(0, ARTICLE_TEXT_MAX_CHARS).trim();
}

export interface ArticleContent {
  resolvedUrl: string | null;
  text: string;
  imageUrl: string | null;
}

/**
 * Resolve o link real e extrai texto + og:image em UMA única busca de HTML.
 * Substitui a antiga busca separada de og:image, economizando uma requisição.
 */
export async function fetchArticleContent(
  link: string | undefined
): Promise<ArticleContent> {
  const empty: ArticleContent = { resolvedUrl: null, text: "", imageUrl: null };
  if (!link) return empty;

  try {
    const realUrl =
      (await resolveGoogleNewsUrl(link)) ?? (/news\.google\./.test(link) ? null : link);
    if (!realUrl) return empty;

    const resp = await fetchWithTimeout(realUrl, { redirect: "follow", timeoutMs: 7000 });
    if (!resp.ok) return { ...empty, resolvedUrl: realUrl };

    const html = await resp.text();
    return {
      resolvedUrl: realUrl,
      text: extractArticleText(html),
      imageUrl: extractOgImage(html),
    };
  } catch {
    return empty;
  }
}
