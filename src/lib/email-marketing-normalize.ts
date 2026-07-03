/**
 * Normalização de texto importado do RD Station (mojibake, tags, nomes, empresas).
 */

const MOJIBAKE_HINT = /[ÃÂâ€™â€œâ€�]/;

/** Grupos de empresas que representam a mesma organização. */
const COMPANY_CANONICAL_GROUPS: { canonicalName: string; keys: string[] }[] = [
  {
    canonicalName: "Bismarchi Pires",
    keys: [
      "bismarchi pires",
      "grupo bismarchi pires",
      "bismarchi pires sociedade de advogados",
      "bismarchi | pires",
    ],
  },
];

const COMPANY_KEY_ALIASES = new Map<string, string>();
for (const group of COMPANY_CANONICAL_GROUPS) {
  const canonicalKey = group.canonicalName.toLowerCase();
  for (const key of group.keys) {
    COMPANY_KEY_ALIASES.set(key, canonicalKey);
  }
  COMPANY_KEY_ALIASES.set(canonicalKey, canonicalKey);
}

function decodeLatin1AsUtf8(text: string): string {
  const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
  return new TextDecoder("utf-8").decode(bytes).replace(/\uFFFD/g, "").trim();
}

function manualMojibakeFix(text: string): string {
  return text
    .replace(/Ã¡/g, "á")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã§/g, "ç")
    .replace(/Ã©/g, "é")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã�/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã"/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‡/g, "Ç")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/�/g, "");
}

/** Corrige texto UTF-8 lido erroneamente como Latin-1 (ex.: AraÃºjo → Araújo). */
export function fixMojibake(value: string | null | undefined): string | null {
  if (!value) return null;
  let text = String(value).replace(/\uFFFD/g, "").trim();
  if (!text) return null;

  for (let i = 0; i < 3; i++) {
    if (!MOJIBAKE_HINT.test(text)) break;
    const decoded = decodeLatin1AsUtf8(text);
    if (!decoded || decoded === text) break;
    text = decoded;
  }

  if (MOJIBAKE_HINT.test(text)) {
    text = manualMojibakeFix(text);
  }

  return text.trim() || null;
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizePersonName(value: string | null | undefined): string | null {
  const fixed = fixMojibake(value);
  if (!fixed) return null;
  return collapseWhitespace(fixed);
}

export function normalizeCompanyName(value: string | null | undefined): string | null {
  const fixed = fixMojibake(value);
  if (!fixed) return null;
  return collapseWhitespace(fixed);
}

function baseCompanyKey(value: string | null | undefined): string | null {
  const normalized = normalizeCompanyName(value);
  if (!normalized) return null;
  return normalized
    .toLowerCase()
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave canônica para deduplicar empresas equivalentes. */
export function companyNameKey(value: string | null | undefined): string | null {
  const base = baseCompanyKey(value);
  if (!base) return null;
  return COMPANY_KEY_ALIASES.get(base) ?? base;
}

/** Nome de exibição canônico quando há alias configurado. */
export function resolveCanonicalCompanyName(value: string | null | undefined): string | null {
  const normalized = normalizeCompanyName(value);
  if (!normalized) return null;
  const key = companyNameKey(normalized);
  if (!key) return normalized;

  for (const group of COMPANY_CANONICAL_GROUPS) {
    if (group.keys.some((k) => k === key) || group.canonicalName.toLowerCase() === key) {
      return group.canonicalName;
    }
  }
  return normalized;
}

export function normalizeTag(value: string | null | undefined): string | null {
  const fixed = fixMojibake(value);
  if (!fixed) return null;
  return collapseWhitespace(fixed);
}

export function normalizeTags(tags: string[] | null | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

/** Normaliza strings dentro de custom_fields (objeto json). */
export function normalizeCustomFields(
  fields: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!fields) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") {
      const fixed = fixMojibake(value);
      if (fixed) result[key] = fixed;
    } else if (value != null) {
      result[key] = value;
    }
  }
  return result;
}

export { COMPANY_CANONICAL_GROUPS };
