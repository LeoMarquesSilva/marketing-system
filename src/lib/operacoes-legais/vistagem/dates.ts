export function formatDateBR(value?: string | Date | null) {
  if (!value) return "—";
  const d =
    typeof value === "string" ? new Date(value + (value.length === 10 ? "T12:00:00" : "")) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}
