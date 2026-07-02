function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

/** Busca tolerante a acentos e pequenos erros de digitação (ex.: giovana → giovanna). */
export function userMatchesSearch(haystack: string, query: string): boolean {
  const q = normalizeForSearch(query.trim());
  if (!q) return true;

  const hay = normalizeForSearch(haystack);
  if (hay.includes(q)) return true;
  if (q.length < 4) return false;

  const words = hay.split(/\s+/).filter(Boolean);
  return words.some((word) => {
    if (word.includes(q) || q.includes(word)) return true;
    const maxDistance = q.length >= 7 ? 2 : 1;
    return levenshtein(word, q) <= maxDistance;
  });
}
