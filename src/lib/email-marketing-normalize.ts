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

/** Partículas de nome que permanecem em minúsculas (exceto no início). */
const NAME_PARTICLES = new Set(["de", "da", "do", "dos", "das", "e"]);

function titleCaseToken(token: string, capitalize: boolean): string {
  if (!token) return token;
  const lower = token.toLocaleLowerCase("pt-BR");
  if (!capitalize && NAME_PARTICLES.has(lower)) return lower;
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

function titleCaseWord(word: string, isFirstWord: boolean): string {
  return word
    .split("-")
    .map((part, i) => titleCaseToken(part, isFirstWord && i === 0))
    .join("-");
}

/** Primeira letra de cada palavra em maiúscula (ex.: ANDRE → Andre). */
export function formatPersonDisplayName(value: string | null | undefined): string | null {
  const base = normalizePersonName(value);
  if (!base) return null;
  return base
    .split(" ")
    .map((word, i) => titleCaseWord(word, i === 0))
    .join(" ");
}

export function normalizePersonName(value: string | null | undefined): string | null {
  const fixed = fixMojibake(value);
  if (!fixed) return null;
  return collapseWhitespace(fixed);
}

/** Chave para deduplicar pessoas RD × SIOE (ignora maiúsculas e acentos). */
export function personNameKey(value: string | null | undefined): string {
  const normalized = normalizePersonName(value);
  if (!normalized) return "";
  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Mesma pessoa no grupo: e-mail igual ou nome equivalente (RD × SIOE). */
export function inviteTwinMatches(
  a: { name?: string | null; email?: string | null },
  b: { name?: string | null; email?: string | null }
): boolean {
  const emailA = a.email?.trim().toLowerCase();
  const emailB = b.email?.trim().toLowerCase();
  if (emailA && emailB && emailA === emailB) return true;
  const nameA = personNameKey(a.name);
  const nameB = personNameKey(b.name);
  return Boolean(nameA && nameA === nameB);
}

/** "Elaine Louzada" casa com "Elaine Louzada Castilho"; exige ao menos dois tokens. */
export function isPersonNamePrefix(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const tokensA = personNameKey(a).split(" ").filter(Boolean);
  const tokensB = personNameKey(b).split(" ").filter(Boolean);
  if (tokensA.length < 2 || tokensB.length < 2) return false;
  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  if (shorter.length === longer.length) return false;
  return shorter.every((token, index) => longer[index] === token);
}

type InviteTwinIdentity = { id: string; name?: string | null; email?: string | null };

/**
 * Gêmeos no mesmo grupo: e-mail/nome exato; senão prefixo único, desde que o
 * outro lado ainda não tenha um par exato (evita juntar Valter Ribeiro e Filho).
 */
export function findInviteTwinsInGroup<T extends InviteTwinIdentity>(
  source: InviteTwinIdentity,
  candidates: T[],
  counterpartPool: InviteTwinIdentity[] = []
): T[] {
  const others = candidates.filter((item) => item.id !== source.id);
  const exact = others.filter((item) => inviteTwinMatches(source, item));
  if (exact.length > 0) return exact;

  const alreadyPaired = new Set(
    others
      .filter((item) => counterpartPool.some((row) => inviteTwinMatches(item, row)))
      .map((item) => item.id)
  );
  const prefixed = others.filter(
    (item) => !alreadyPaired.has(item.id) && isPersonNamePrefix(source.name, item.name)
  );
  return prefixed.length === 1 ? prefixed : [];
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

/** Apenas dígitos — CNPJ/CPF para comparação. */
export function normalizeDocumentDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length >= 11 ? digits : null;
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
