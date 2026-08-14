import type { PhotoUsageType } from "@/lib/collaborator-photos/types";

export function slugifyUsageLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function assertUsageTypeCanDelete(type: PhotoUsageType): void {
  if (type.isOfficial || type.isSystem) {
    throw new Error("O uso Oficial não pode ser apagado.");
  }
}

export function assertUsageTypeCanDeactivate(type: PhotoUsageType): void {
  if (type.isOfficial || type.isSystem) {
    throw new Error("O uso Oficial não pode ser desativado.");
  }
}

export function withCreatedUsageType(
  current: PhotoUsageType[],
  input: { id: string; label: string }
): PhotoUsageType[] {
  const maxOrder = current.reduce((max, item) => Math.max(max, item.sortOrder), -1);
  return [
    ...current,
    {
      id: input.id,
      slug: slugifyUsageLabel(input.label),
      label: input.label.trim(),
      isOfficial: false,
      isSystem: false,
      isActive: true,
      sortOrder: maxOrder + 1,
    },
  ];
}
