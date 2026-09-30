import type { EventTask, EventTaskPhase, EventTaskStatus } from "@/lib/eventos";

export const TASK_PHASES: { value: EventTaskPhase | "sem_etapa"; label: string }[] = [
  { value: "pre_evento", label: "Pré-evento" },
  { value: "dia_evento", label: "Dia do evento" },
  { value: "pos_evento", label: "Pós-evento" },
  { value: "sem_etapa", label: "Sem etapa" },
];

export type EventTaskDraft = Pick<EventTask, "title" | "description" | "assigneeId" | "dueDate" | "status" | "phase">;
export type TaskFilters = {
  search: string;
  status: EventTaskStatus | "all" | "overdue";
  assignee: string;
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function filterEventTasks(tasks: EventTask[], filters: TaskFilters, today: string): EventTask[] {
  const query = normalize(filters.search.trim());
  return tasks.filter((task) => {
    if (query && !normalize([task.title, task.description, task.assigneeName].filter(Boolean).join(" ")).includes(query)) return false;
    if (filters.status === "overdue" && (task.status === "concluida" || !task.dueDate || task.dueDate >= today)) return false;
    if (filters.status !== "all" && filters.status !== "overdue" && task.status !== filters.status) return false;
    if (filters.assignee === "unassigned" && task.assigneeId) return false;
    if (filters.assignee !== "all" && filters.assignee !== "unassigned" && task.assigneeId !== filters.assignee) return false;
    return true;
  }).sort((a, b) => {
    if ((a.status === "concluida") !== (b.status === "concluida")) return a.status === "concluida" ? 1 : -1;
    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || a.sortOrder - b.sortOrder;
  });
}

export function groupEventTasks(tasks: EventTask[]) {
  return TASK_PHASES.map((phase) => ({ ...phase, tasks: tasks.filter((task) => (task.phase ?? "sem_etapa") === phase.value) })).filter((group) => group.tasks.length > 0);
}

export function taskDateLabel(date: string | null): string {
  if (!date) return "Sem prazo";
  return date.split("-").reverse().join("/");
}
