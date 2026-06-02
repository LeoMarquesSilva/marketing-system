/**
 * Construção e parsing de queries RSS do Google News compartilhados entre o
 * admin de temas (client) e o pipeline de busca (server).
 *
 * Formato gerado: ("termo1" OR "termo2") -"ruido1" -"ruido2"
 * - termos positivos entre aspas, unidos por OR e agrupados em parênteses;
 * - termos de exclusão prefixados com `-` (operador do Google News).
 */

function splitTerms(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Converte palavras-chave (e exclusões) em query RSS do Google News. */
export function keywordsToRssQuery(keywords: string, excludeKeywords = ""): string {
  const include = splitTerms(keywords);
  const exclude = splitTerms(excludeKeywords);

  if (include.length === 0 && exclude.length === 0) return "";

  const positive =
    include.length > 1
      ? `(${include.map((t) => `"${t}"`).join(" OR ")})`
      : include.map((t) => `"${t}"`).join("");

  const negative = exclude.map((t) => `-"${t}"`).join(" ");

  return [positive, negative].filter(Boolean).join(" ").trim();
}

/** Extrai os termos positivos (não prefixados por `-`) de uma query salva. */
export function rssQueryToKeywords(rssQuery: string): string {
  if (!rssQuery.trim()) return "";
  // Remove os trechos de exclusão para não capturá-los como positivos.
  const withoutExclusions = rssQuery.replace(/-"[^"]+"/g, " ");
  const matches = withoutExclusions.match(/"([^"]+)"/g);
  if (!matches) return rssQuery.replace(/-"[^"]+"/g, "").trim();
  return matches.map((m) => m.slice(1, -1)).join(", ");
}

/** Extrai os termos de exclusão (prefixados por `-`) de uma query salva. */
export function rssQueryToExcludeKeywords(rssQuery: string): string {
  if (!rssQuery.trim()) return "";
  const matches = rssQuery.match(/-"([^"]+)"/g);
  if (!matches) return "";
  return matches.map((m) => m.slice(2, -1)).join(", ");
}

/**
 * Operador de recência do Google News derivado de months_back.
 * Ex.: months_back=2 -> "when:60d". Limita a janela ao máx. de exibição.
 */
export function monthsBackToWhen(monthsBack: number | null | undefined): string {
  const months = Math.min(12, Math.max(1, Math.round(monthsBack ?? 4)));
  const days = months * 30;
  return `when:${days}d`;
}

/** Anexa o operador de recência à query (sem persistir no banco). */
export function buildRssQueryWithRecency(
  rssQuery: string,
  monthsBack: number | null | undefined
): string {
  const base = rssQuery.trim();
  if (!base) return base;
  if (/\bwhen:/i.test(base)) return base; // já tem operador explícito
  return `${base} ${monthsBackToWhen(monthsBack)}`;
}
