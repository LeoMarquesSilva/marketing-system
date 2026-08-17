import { departmentMatchesAreaFilter } from "@/lib/ferias/filters";

export interface QualificationRequirementTarget {
  department: string | null | undefined;
  position: string | null | undefined;
}

export interface QualificationRequirementScope {
  area: string;
  positions: string[];
}

export interface QualificationRequirementSelection {
  scopes: QualificationRequirementScope[];
}

export type QualificationRequirementAction = "activated" | "deactivated";

export interface QualificationRequirementHistoryItem {
  id: string;
  action: QualificationRequirementAction;
  scopes: QualificationRequirementScope[];
  selected_count: number;
  affected_count: number;
  already_complete_count: number;
  performed_by: string | null;
  performed_by_name: string;
  created_at: string;
}

function normalizePosition(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cada área possui sua própria seleção de cargos. Isso evita cruzamentos
 * indevidos entre os cargos escolhidos para equipes diferentes.
 */
export function matchesQualificationRequirementTarget(
  target: QualificationRequirementTarget,
  selection: QualificationRequirementSelection
): boolean {
  const position = normalizePosition(target.position ?? "");
  return selection.scopes.some(
    (scope) =>
      scope.positions.length > 0 &&
      departmentMatchesAreaFilter(target.department, scope.area) &&
      scope.positions.some(
        (selected) => normalizePosition(selected) === position
      )
  );
}

export function listQualificationPositionsForArea(
  items: QualificationRequirementTarget[],
  area: string
): string[] {
  const positions = new Set<string>();
  for (const item of items) {
    if (!departmentMatchesAreaFilter(item.department, area)) continue;
    const position = item.position?.trim();
    if (position) positions.add(position);
  }
  return [...positions].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
