import { ICONIFY_SETS } from "./fields";

/**
 * Ícones da Iconify (api.iconify.design, sem chave). O corpo SVG vem de fora e entra
 * na arte por innerHTML, então só passam tags e atributos de desenho.
 */

export const ICONIFY_API = "https://api.iconify.design";

export interface IconData {
  body: string;
  width: number;
  height: number;
}

const TAGS = new Set([
  "g",
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
  "defs",
  "mask",
  "clipPath",
  "linearGradient",
  "radialGradient",
  "stop",
]);

const ATTRS = new Set([
  "d",
  "fill",
  "fill-rule",
  "fill-opacity",
  "clip-rule",
  "clip-path",
  "mask",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
  "transform",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "points",
  "id",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "maskUnits",
  "clipPathUnits",
  "vector-effect",
  "color",
]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * Remonta o corpo só com o que é desenho; qualquer coisa fora disso (texto solto, tag
 * desconhecida) recusa o ícone. Os ids ganham prefixo para dois ícones na mesma arte
 * não trocarem máscaras.
 */
export function sanitizeIconBody(body: string, idPrefix: string): string | null {
  const out: string[] = [];
  let last = 0;
  for (const match of body.matchAll(TAG_RE)) {
    if (body.slice(last, match.index).trim()) return null;
    last = match.index + match[0].length;
    const [, closing, tag, rawAttrs, selfClose] = match;
    if (!TAGS.has(tag)) return null;
    if (closing) {
      out.push(`</${tag}>`);
      continue;
    }
    const attrs: string[] = [];
    for (const attr of rawAttrs.matchAll(ATTR_RE)) {
      const name = attr[1];
      let value = attr[2] ?? attr[3] ?? "";
      if (!ATTRS.has(name) || /[<>"]|javascript:|expression\(/i.test(value)) continue;
      if (/url\(/i.test(value)) {
        if (!/^url\(#[\w-]+\)$/.test(value)) continue;
        value = value.replace(/^url\(#([\w-]+)\)$/, `url(#${idPrefix}-$1)`);
      }
      if (name === "id") value = `${idPrefix}-${value.replace(/[^\w-]/g, "")}`;
      attrs.push(` ${name}="${value}"`);
    }
    out.push(`<${tag}${attrs.join("")}${selfClose ? "/" : ""}>`);
  }
  if (body.slice(last).trim()) return null;
  return out.join("");
}

interface IconifyIcon {
  body?: string;
  width?: number;
  height?: number;
}

interface IconifyJson {
  width?: number;
  height?: number;
  icons?: Record<string, IconifyIcon>;
  aliases?: Record<string, { parent?: string }>;
}

/** Tira o ícone pedido da resposta de /<prefixo>.json?icons=<nome>, seguindo apelidos. */
export function iconFromJson(json: unknown, prefix: string, name: string): IconData | null {
  if (!json || typeof json !== "object") return null;
  const data = json as IconifyJson;
  let current = name;
  for (let hops = 0; hops < 3; hops++) {
    const icon = data.icons?.[current];
    if (icon?.body) {
      const body = sanitizeIconBody(icon.body, `${prefix}-${name}`);
      if (!body) return null;
      return { body, width: icon.width ?? data.width ?? 16, height: icon.height ?? data.height ?? 16 };
    }
    const parent = data.aliases?.[current]?.parent;
    if (!parent) return null;
    current = parent;
  }
  return null;
}

/** Nomes "prefixo:nome" vindos da busca, só dos conjuntos liberados. */
export function searchResults(json: unknown): string[] {
  const icons = json && typeof json === "object" ? (json as { icons?: unknown }).icons : null;
  if (!Array.isArray(icons)) return [];
  return icons.filter(
    (id): id is string => typeof id === "string" && (ICONIFY_SETS as readonly string[]).includes(id.split(":")[0]) && /^[a-z0-9-]+:[a-z0-9-]+$/.test(id)
  );
}
