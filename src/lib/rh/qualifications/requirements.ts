import { departmentMatchesAreaFilter } from "@/lib/ferias/filters";

export interface QualificationRequirementTarget {
  user_id?: string;
  department: string | null | undefined;
  position: string | null | undefined;
}

export interface QualificationRequirementPerson {
  user_id: string;
  name: string;
  position: string | null;
}

export interface QualificationRequirementScope {
  area: string;
  people: QualificationRequirementPerson[];
  /** Mantido para registros antigos do histórico. */
  positions?: string[];
}

export interface QualificationRequirementSelection {
  user_ids: string[];
  scopes?: QualificationRequirementScope[];
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

export function matchesQualificationRequirementTarget(
  target: QualificationRequirementTarget,
  selection: QualificationRequirementSelection
): boolean {
  if (!target.user_id || selection.user_ids.length === 0) return false;
  return selection.user_ids.includes(target.user_id);
}

export function listQualificationPeopleForArea<
  T extends { user_id: string; user_name: string; department: string | null },
>(items: T[], area: string): T[] {
  return items
    .filter((item) => departmentMatchesAreaFilter(item.department, area))
    .sort((a, b) => a.user_name.localeCompare(b.user_name, "pt-BR"));
}
