const key = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");

export function normalizeFollowUpResponsibleNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    const normalized = key(name);
    if (!name || seen.has(normalized)) continue;
    seen.add(normalized);
    names.push(name);
  }
  return names;
}

export function followUpResponsibleNames(payload?: Record<string, unknown> | null): string[] {
  if (Array.isArray(payload?.responsibleNames)) return normalizeFollowUpResponsibleNames(payload.responsibleNames);
  return normalizeFollowUpResponsibleNames([payload?.responsibleName]);
}
