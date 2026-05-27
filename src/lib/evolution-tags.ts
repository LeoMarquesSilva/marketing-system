/** Tags WhatsApp — seguro para Client Components. */

export const WHATSAPP_TAG_PRESETS = [
  "Tráfego pago",
  "Lead quente",
  "Follow-up",
  "CONFIARA",
  "Malha fina",
  "Orçamento",
  "Qualificado",
  "Perdido",
] as const;

export function normalizeWhatsappTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const value = tag.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}
