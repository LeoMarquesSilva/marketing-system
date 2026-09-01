/** Título normalizado para dedupe/histórico — mesma ideia do pipeline institucional. */
export function normalizeTitleKey(title: string): string {
  return (title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+[-–|]\s+[^-–|]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 12)
    .join(" ");
}
