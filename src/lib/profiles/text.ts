/**
 * Formatação de textos de perfil (nome público, cargo, área).
 */

const SMALL_WORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "para",
  "por",
  "com",
  "del",
  "la",
  "y",
]);

function capitalizeToken(token: string): string {
  if (!token) return token;
  return token
    .split("-")
    .map((part) => {
      if (!part) return part;
      const lower = part.toLocaleLowerCase("pt-BR");
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join("-");
}

/**
 * Title Case em português: primeira letra de cada palavra,
 * mantendo partículas (de, da, do…) em minúsculas — exceto no início.
 */
export function toTitleCasePt(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  const words = raw.split(/\s+/).filter(Boolean);
  return words
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      // Partículas só ficam minúsculas no meio do nome
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      // Siglas conhecidas
      if (/^(oab|mba|fgv|puc|esa|epd|ebradi|trf|trt|stf|stj)$/i.test(word)) {
        return word.toLocaleUpperCase("pt-BR");
      }
      return capitalizeToken(word);
    })
    .join(" ");
}
