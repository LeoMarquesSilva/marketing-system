import type { EventBudgetItem, EventHistoryItem, EventTask } from "@/lib/eventos";
import { taskAssigneeIds } from "@/lib/event-task-list";
import { followUpResponsibleNames } from "@/lib/event-followup-responsibles";

export const CHECKLIST_CATEGORIES = ["Decoração", "Locação", "Buffet / Catering", "Brindes", "Fornecedores", "Outros"];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/_/g, " ").trim().replace(/\s+/g, " ");
const labels: Record<string, string> = { decoracao: "Decoração", locacao: "Locação", catering: "Buffet / Catering", buffet: "Buffet / Catering", "buffet / catering": "Buffet / Catering", brindes: "Brindes", fornecedor: "Fornecedores", fornecedores: "Fornecedores", outros: "Outros" };

export function checklistCategoryLabel(category?: string | null): string {
  const key = normalize(category ?? "");
  return !key ? "Sem categoria" : labels[key] ?? category!.trim().replace(/\s+/g, " ");
}
export function checklistCategoryKey(category?: string | null): string {
  return normalize(checklistCategoryLabel(category));
}
export type ChecklistFilters = { search: string; status: "all" | "pending" | "done"; category: string; assignee: string };

export function filterChecklistTasks(tasks: EventTask[], filters: ChecklistFilters): EventTask[] {
  const query = normalize(filters.search);
  return tasks.filter(task => {
    const ids = taskAssigneeIds(task);
    return (filters.status === "all" || (task.status === "concluida") === (filters.status === "done"))
      && (filters.category === "all" || checklistCategoryKey(task.category) === filters.category)
      && (filters.assignee === "all" || (filters.assignee === "unassigned" ? !ids.length && !task.externalResponsibleName : filters.assignee.startsWith("external:") ? normalize(task.externalResponsibleName ?? "") === filters.assignee.slice(9) : ids.includes(filters.assignee)))
      && (!query || normalize([task.title, task.description, checklistCategoryLabel(task.category), task.assigneeName, task.externalResponsibleName, ...(task.assignees?.map(person => person.name) ?? [])].filter(Boolean).join(" ")).includes(query));
  }).sort((a, b) => Number(a.status === "concluida") - Number(b.status === "concluida") || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.sortOrder - b.sortOrder);
}

export function groupChecklistTasks(tasks: EventTask[]) {
  const groups = new Map<string, { key: string; label: string; tasks: EventTask[]; completed: number }>();
  for (const task of tasks) {
    const key = checklistCategoryKey(task.category);
    const group = groups.get(key) ?? { key, label: checklistCategoryLabel(task.category), tasks: [], completed: 0 };
    group.tasks.push(task);
    if (task.status === "concluida") group.completed++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key === "sem categoria" ? 1 : b.key === "sem categoria" ? -1 : a.label.localeCompare(b.label, "pt-BR"));
}

export function availableChecklistBudget(eventId: string, items: EventBudgetItem[], tasks: EventTask[]) {
  const linked = new Set(tasks.filter(task => task.eventId === eventId).map(task => task.budgetItemId).filter(Boolean));
  return items.filter(item => item.eventId === eventId && !linked.has(item.id));
}

export function nextChecklistFollowUp(task: EventTask, history: EventHistoryItem[]) {
  const item = history.filter(entry => entry.eventId === task.eventId && entry.payload?.taskId === task.id && entry.payload?.followUpStatus === "planejado" && typeof entry.payload.followUpDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.payload.followUpDate)).sort((a, b) => String(a.payload?.followUpDate).localeCompare(String(b.payload?.followUpDate)) || String(a.payload?.followUpTime ?? "").localeCompare(String(b.payload?.followUpTime ?? "")))[0];
  return item ? { date: String(item.payload?.followUpDate), time: typeof item.payload?.followUpTime === "string" ? item.payload.followUpTime : null, responsibleName: followUpResponsibleNames(item.payload).join(", ") || null } : null;
}
