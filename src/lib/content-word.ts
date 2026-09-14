/**
 * Parsing do post-carrossel e geração do documento Word (.doc via HTML),
 * compartilhados entre o cliente (botão "Baixar Word") e o servidor (endpoint
 * que gera o arquivo para o link do card no Planner).
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";

export interface SlideBody {
  type: "bullet" | "text";
  content: string;
}
export interface SlideView {
  heading: string;
  title: string;
  body: SlideBody[];
}

const FIELD_RE =
  /^\*{0,2}\s*(t[íi]tulo|subt[íi]tulo|conte[úu]do|call to action|cta)\s*:?\s*\*{0,2}\s*(.*)$/i;

/**
 * Faz o parse do post-carrossel em slides estruturados, tolerando rótulos em
 * negrito (ex.: **Título:**, **Conteúdo:**) e cabeçalhos (**Slide N – ...**).
 */
export function parseCarousel(text: string): SlideView[] {
  const slides: SlideView[] = [];
  let current: SlideView | null = null;
  const ensure = () => {
    if (!current) {
      current = { heading: "", title: "", body: [] };
      slides.push(current);
    }
    return current;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || /^-{3,}$/.test(line)) continue;

    const stripped = line.replace(/\*\*/g, "").trim();
    const fieldMatch = line.match(FIELD_RE);

    if (fieldMatch) {
      const label = fieldMatch[1].toLowerCase();
      const value = fieldMatch[2].trim();
      const s = ensure();
      if (/^t[íi]tulo$/.test(label)) {
        if (value) s.title = value;
      } else if (value) {
        s.body.push({ type: "text", content: value });
      }
      continue;
    }

    if (/^\*\*.+\*\*$/.test(line)) {
      current = { heading: stripped, title: "", body: [] };
      slides.push(current);
      continue;
    }

    if (/^[-•]\s+/.test(line)) {
      ensure().body.push({ type: "bullet", content: line.replace(/^[-•]\s+/, "") });
      continue;
    }

    ensure().body.push({ type: "text", content: line });
  }

  for (const s of slides) {
    if (!s.title) s.title = s.heading;
  }
  return slides;
}

export interface RoteiroWordInput {
  title: string;
  area: string;
  link?: string | null;
  contentSnippet?: string | null;
  post: string;
  hasAlterations?: boolean | null;
  editedByName?: string | null;
  editedAt?: string | null;
  originalPost?: string | null;
  authorName?: string | null;
  authorRole?: string | null;
}

const esc = (s?: string | null) =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const inlineHtml = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

/** Monta o HTML do documento Word (.doc) a partir do roteiro. */
export function buildRoteiroWordHtml(r: RoteiroWordInput): string {
  const editedInfo = r.hasAlterations
    ? `Sim${r.editedByName ? ` — por ${esc(r.editedByName)}` : ""}${
        r.editedAt
          ? ` em ${format(new Date(r.editedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
          : ""
      }`
    : "Não (texto original da IA)";

  const slides = parseCarousel(r.post);
  const slidesHtml = slides
    .map((s, i) => {
      const ref =
        i === 0
          ? "SLIDE 01 — Capa"
          : `SLIDE ${String(i + 1).padStart(2, "0")}${s.heading ? ` — ${esc(s.heading)}` : ""}`;
      const author =
        i === 0
          ? `<p style="margin:1pt 0;color:#555;">${esc(r.authorName ?? "")}${
              r.authorRole ? ` — ${esc(r.authorRole)}` : ""
            }</p>`
          : "";
      const body = s.body
        .map(
          (b) =>
            `<p style="margin:2pt 0;">${b.type === "bullet" ? "• " : ""}${inlineHtml(b.content)}</p>`
        )
        .join("");
      return `<h3 style="color:#04202f;margin:14pt 0 4pt;font-size:11pt;">${ref}</h3>
        <p style="margin:2pt 0;font-weight:bold;font-size:12pt;">${inlineHtml(s.title)}</p>
        ${author}${body}`;
    })
    .join("");

  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(r.title)}</title></head>
    <body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a;">
      <p style="font-size:9pt;color:#888;letter-spacing:1px;text-transform:uppercase;margin:0;">Sistema de Marketing — Conteúdo para post</p>
      <h1 style="color:#04202f;font-size:16pt;margin:6pt 0 12pt;">${esc(r.title)}</h1>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:10pt;margin-bottom:16pt;width:100%;">
        <tr><td style="background:#f3f4f6;font-weight:bold;width:170px;">Área</td><td style="border-bottom:1px solid #eee;">${esc(r.area)}</td></tr>
        <tr><td style="background:#f3f4f6;font-weight:bold;">Link da notícia</td><td style="border-bottom:1px solid #eee;">${esc(r.link ?? "—")}</td></tr>
        <tr><td style="background:#f3f4f6;font-weight:bold;">Texto alterado?</td><td style="border-bottom:1px solid #eee;">${editedInfo}</td></tr>
        <tr><td style="background:#f3f4f6;font-weight:bold;">Responsável</td><td style="border-bottom:1px solid #eee;">${esc(r.authorName ?? "—")}${r.authorRole ? ` (${esc(r.authorRole)})` : ""}</td></tr>
      </table>
      <h2 style="color:#04202f;font-size:13pt;border-bottom:2px solid #04202f;padding-bottom:4pt;">Post em carrossel</h2>
      ${slidesHtml}
      ${
        r.hasAlterations && r.originalPost
          ? `<h2 style="color:#888;font-size:11pt;margin-top:24pt;">Versão original gerada pela IA (referência)</h2>
             <div style="color:#777;font-size:9.5pt;white-space:pre-wrap;">${esc(r.originalPost)}</div>`
          : ""
      }
      <p style="margin-top:24pt;font-size:8.5pt;color:#aaa;">Gerado pelo Sistema de Marketing em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.</p>
    </body></html>`;
}

/** Sufixo de arquivo a partir do título. */
export function roteiroWordSlug(title: string): string {
  return (
    (title || "post")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .toLowerCase() || "conteudo"
  );
}

export const CONTENT_ROTEIRO_WORD_PATH = "/api/content-roteiros/word";

/** Caminho same-origin para o Word — usa o host em que o usuário está logado. */
export function contentRoteiroWordHref(id: string): string {
  return `${CONTENT_ROTEIRO_WORD_PATH}?id=${encodeURIComponent(id)}`;
}

/** URL canônica gravada no card do Planner (sempre o domínio público). */
export function contentRoteiroWordPublicUrl(id: string): string {
  return `${PUBLIC_APP_ORIGIN.replace(/\/$/, "")}${contentRoteiroWordHref(id)}`;
}

/** Extrai o id do roteiro de um link Word, mesmo se o host estiver errado (Vercel, www, etc.). */
export function parseContentRoteiroWordId(link: string | null | undefined): string | null {
  if (!link?.trim()) return null;
  try {
    const url = new URL(link.trim(), PUBLIC_APP_ORIGIN);
    const path = url.pathname.replace(/\/+$/, "");
    if (!path.endsWith(CONTENT_ROTEIRO_WORD_PATH)) return null;
    const id = url.searchParams.get("id")?.trim();
    return id || null;
  } catch {
    return null;
  }
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      return utf[1];
    }
  }
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const plain = header.match(/filename=([^;]+)/i);
  return plain?.[1]?.trim().replace(/^["']|["']$/g, "") || null;
}

/** Baixa o Word no domínio atual, com a sessão do Planner — evita 401 por host antigo. */
export async function downloadContentRoteiroWord(id: string): Promise<void> {
  const response = await fetch(contentRoteiroWordHref(id), { credentials: "same-origin" });
  if (!response.ok) {
    const message = (await response.text()).trim();
    if (response.status === 401) {
      throw new Error("Faça login para baixar o Word deste post.");
    }
    if (response.status === 404) {
      throw new Error("Conteúdo de post não encontrado.");
    }
    throw new Error(message || "Não foi possível baixar o Word.");
  }

  const blob = await response.blob();
  const filename =
    filenameFromContentDisposition(response.headers.get("content-disposition")) ??
    `post-${id.slice(0, 8)}.doc`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
