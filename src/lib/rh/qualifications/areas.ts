import {
  departmentMatchesAreaFilter,
  resolveAreaFilterLabel,
  resolveCanonicalAreaLabel,
} from "@/lib/ferias/filters";
import type { QualificationListItem } from "@/lib/rh/qualifications/types";

/** Mesmo rótulo canônico usado pelo módulo de Férias. */
export function qualificationAreaLabel(
  department: string | null | undefined
): string {
  return resolveCanonicalAreaLabel(department) ?? "Sem área";
}

/** Lista de filtros já agrupada conforme a regra global de áreas do sistema. */
export function listQualificationAreas(
  items: QualificationListItem[]
): string[] {
  const areas = new Set<string>();
  for (const item of items) {
    const area = resolveAreaFilterLabel(item.department);
    if (area) areas.add(area);
  }
  return [...areas].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function qualificationMatchesArea(
  item: Pick<QualificationListItem, "department">,
  area: string
): boolean {
  return departmentMatchesAreaFilter(item.department, area);
}
