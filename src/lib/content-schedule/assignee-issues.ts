import { normalizeScheduleArea } from "./domain";
import type { ContentScheduleAssigneeIssue, ContentScheduleAssigneeIssueReason } from "./types";

export interface AssigneeIssueSlotInput {
  id: string;
  area: string;
  sourceName: string;
  dueDate: string;
  cancelled: boolean;
}

export interface AssigneeIssuePersonInput {
  id: string;
  name: string;
  department: string | null;
  isActive: boolean;
  avatarUrl: string | null;
}

const NAME_PARTICLES = new Set(["da", "das", "de", "do", "dos", "e"]);

function normalizeName(value: string): string {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(value: string): string[] {
  return normalizeName(value).split(" ").filter((part) => part && !NAME_PARTICLES.has(part));
}

function tokenMatches(source: string, candidate: string): boolean {
  if (source.length === 1) return candidate.startsWith(source);
  if (source === candidate) return true;
  return source.length >= 3 && candidate.length >= 3 && (source.startsWith(candidate) || candidate.startsWith(source));
}

export function likelySamePerson(sourceName: string, candidateName: string): boolean {
  const source = nameTokens(sourceName);
  const candidate = nameTokens(candidateName);
  if (!source.length || !candidate.length || !tokenMatches(source[0], candidate[0])) return false;
  let cursor = 0;
  return source.every((part) => {
    const index = candidate.findIndex((candidatePart, at) => at >= cursor && tokenMatches(part, candidatePart));
    if (index < 0) return false;
    cursor = index + 1;
    return true;
  });
}

function isPlaceholder(value: string): boolean {
  const normalized = normalizeName(value);
  return normalized.includes("a definir") || normalized.includes("novo profissional") || normalized.includes("adv novo");
}

export function classifyScheduleAssigneeIssues({ slots, people, today }: {
  slots: AssigneeIssueSlotInput[];
  people: AssigneeIssuePersonInput[];
  today: string;
}): ContentScheduleAssigneeIssue[] {
  const groups = new Map<string, AssigneeIssueSlotInput[]>();
  for (const slot of slots) {
    if (slot.cancelled || !slot.sourceName.trim()) continue;
    const key = `${normalizeScheduleArea(slot.area) ?? slot.area}::${normalizeName(slot.sourceName)}`;
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }

  return [...groups.entries()].map(([key, grouped]) => {
    const first = grouped[0];
    const matched = people.filter((person) => likelySamePerson(first.sourceName, person.name));
    const sameArea = matched.filter((person) => normalizeScheduleArea(person.department) === normalizeScheduleArea(first.area));
    const activeSameArea = sameArea.filter((person) => person.isActive);
    const inactiveSameArea = sameArea.filter((person) => !person.isActive);
    const activeOtherArea = matched.filter((person) => person.isActive && normalizeScheduleArea(person.department) !== normalizeScheduleArea(first.area));

    let reason: ContentScheduleAssigneeIssueReason;
    let mode: ContentScheduleAssigneeIssue["mode"] = "future_replacement";
    let suggested: AssigneeIssuePersonInput | null = null;
    if (isPlaceholder(first.sourceName)) {
      reason = "placeholder";
    } else if (activeSameArea.length === 1) {
      reason = "abbreviated";
      mode = "identity";
      suggested = activeSameArea[0];
    } else if (activeSameArea.length > 1) {
      reason = "ambiguous";
      mode = "identity";
    } else if (inactiveSameArea.length > 0) {
      reason = "inactive";
    } else if (activeOtherArea.length === 1) {
      reason = "moved_area";
    } else {
      reason = "unmatched";
    }

    const dates = grouped.map((slot) => slot.dueDate).sort();
    const pastSlotCount = dates.filter((date) => date < today).length;
    const futureSlotCount = dates.filter((date) => date >= today).length;
    return {
      key,
      area: first.area,
      sourceName: first.sourceName,
      reason,
      mode,
      slotCount: dates.length,
      pastSlotCount,
      futureSlotCount,
      affectedSlotCount: mode === "identity" ? dates.length : futureSlotCount,
      dates,
      suggestedCollaboratorId: suggested?.id ?? null,
      suggestedCollaboratorName: suggested?.name ?? null,
      suggestedCollaboratorAvatarUrl: suggested?.avatarUrl ?? null,
    };
  }).sort((a, b) => a.area.localeCompare(b.area, "pt-BR") || a.sourceName.localeCompare(b.sourceName, "pt-BR"));
}
