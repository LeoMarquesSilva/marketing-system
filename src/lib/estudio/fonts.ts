/**
 * Fontes do Estúdio. Os modelos chamam as fontes licenciadas por nomes próprios
 * ("Estudio Gotham" peso 400…); cada lugar desses é preenchido pelo arquivo da pasta
 * src/lib/estudio/assets/fonts ou por um arquivo enviado na tela Fontes. Sem nenhum
 * dos dois, o CSS do modelo cai na reserva (Montserrat).
 */

export interface StudioFontSlot {
  key: string;
  family: string;
  weight: number;
  label: string;
  /** Palavras que aparecem no nome do arquivo/fonte, para sugerir o lugar ao enviar. */
  match: RegExp;
}

export const STUDIO_FONT_SLOTS: StudioFontSlot[] = [
  { key: "titulo", family: "Estudio Neulis", weight: 700, label: "Neulis Neue Bold · títulos da OAB", match: /neulis/i },
  { key: "apoio", family: "Estudio Century Gothic", weight: 400, label: "Century Gothic · textos de apoio da OAB", match: /century\s*gothic/i },
  { key: "gobold", family: "Estudio Gobold", weight: 400, label: "Gobold · títulos dos posts do escritório", match: /gobold/i },
  { key: "gotham-book", family: "Estudio Gotham", weight: 400, label: "Gotham Book · texto dos posts do escritório", match: /gotham/i },
  { key: "gotham-medium", family: "Estudio Gotham", weight: 500, label: "Gotham Medium · posts do escritório", match: /gotham/i },
  { key: "gotham-bold", family: "Estudio Gotham", weight: 700, label: "Gotham Bold · destaques dos posts do escritório", match: /gotham/i },
];

export const FONT_FORMATS = ["otf", "ttf", "woff", "woff2"] as const;
export type FontFormat = (typeof FONT_FORMATS)[number];

export const FONT_MIME: Record<FontFormat, string> = { otf: "font/otf", ttf: "font/ttf", woff: "font/woff", woff2: "font/woff2" };
const CSS_FORMAT: Record<FontFormat, string> = { otf: "opentype", ttf: "truetype", woff: "woff", woff2: "woff2" };

export const FONT_MAX_BYTES = 5 * 1024 * 1024;

/** Nome de família seguro para ir dentro de aspas no CSS. */
export const FONT_FAMILY_RE = /^[A-Za-zÀ-ÿ0-9 ._-]{2,60}$/;

/** Formato pelo começo do arquivo (a extensão sozinha não basta). */
export function sniffFontFormat(bytes: Uint8Array): FontFormat | null {
  if (bytes.length < 4) return null;
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (tag === "OTTO") return "otf";
  if (tag === "wOFF") return "woff";
  if (tag === "wOF2") return "woff2";
  if (tag === "true" || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) return "ttf";
  return null;
}

export function fontFaceRule(input: { family: string; weight: number; style: string; url: string; format?: FontFormat }): string {
  const format = input.format ? ` format("${CSS_FORMAT[input.format]}")` : "";
  return `@font-face{font-family:"${input.family}";src:url("${input.url}")${format};font-weight:${input.weight};font-style:${input.style};font-display:block;}`;
}

/** Lugar provável de um arquivo enviado (pelo nome da fonte e pelo peso). */
export function suggestSlot(name: string, weight: number): StudioFontSlot | null {
  const candidates = STUDIO_FONT_SLOTS.filter((s) => s.match.test(name));
  if (candidates.length === 0) return null;
  // Gotham: "Book" é 400 mesmo quando o arquivo diz 300/350
  const byName = /\bbook\b/i.test(name) ? 400 : /\bmedium\b/i.test(name) ? 500 : /\bbold\b/i.test(name) ? 700 : null;
  const target = byName ?? weight;
  return candidates.reduce((best, s) => (Math.abs(s.weight - target) < Math.abs(best.weight - target) ? s : best));
}

export interface StudioFontRow {
  id: string;
  familia: string;
  peso: number;
  estilo: "normal" | "italic";
  formato: FontFormat;
  nome_original: string;
  postscript: string | null;
  created_at: string;
}
