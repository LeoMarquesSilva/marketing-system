import type { EventTask, EventTaskPhase, EventTaskStatus } from "@/lib/eventos";

export const TASK_PHASES: { value: EventTaskPhase | "sem_etapa"; label: string }[] = [
  { value: "pre_evento", label: "Pré-evento" },
  { value: "dia_evento", label: "Dia do evento" },
  { value: "pos_evento", label: "Pós-evento" },
  { value: "sem_etapa", label: "Sem etapa" },
];

export type EventTaskDraft = Pick<EventTask, "title" | "description" | "assigneeId" | "dueDate" | "status" | "phase"> & { assigneeIds: string[] };
export type TaskFilters = {
  search: string;
  status: EventTaskStatus | "all" | "overdue";
  assignee: string;
  phase?: EventTaskPhase | "all" | "sem_etapa";
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function taskAssigneeIds(task: Pick<EventTask, "assigneeId" | "assigneeIds">): string[] {
  return task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [];
}

export function filterEventTasks(tasks: EventTask[], filters: TaskFilters, today: string): EventTask[] {
  const query = normalize(filters.search.trim());
  return tasks.filter((task) => {
    if (filters.phase && filters.phase !== "all" && (task.phase ?? "sem_etapa") !== filters.phase) return false;
    if (query && !normalize([task.title, task.description, task.assigneeName, ...(task.assignees?.map(person => person.name) ?? [])].filter(Boolean).join(" ")).includes(query)) return false;
    if (filters.status === "overdue" && (task.status === "concluida" || !task.dueDate || task.dueDate >= today)) return false;
    if (filters.status !== "all" && filters.status !== "overdue" && task.status !== filters.status) return false;
    const assigneeIds = taskAssigneeIds(task);
    if (filters.assignee === "unassigned" && assigneeIds.length) return false;
    if (filters.assignee !== "all" && filters.assignee !== "unassigned" && !assigneeIds.includes(filters.assignee)) return false;
    return true;
  }).sort((a, b) => {
    if ((a.status === "concluida") !== (b.status === "concluida")) return a.status === "concluida" ? 1 : -1;
    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || a.sortOrder - b.sortOrder;
  });
}

/** Calendar dates are civil dates, never UTC instants. */
export function eventCalendarDays(month: string): (string | null)[] {
  const [year, number] = month.split("-").map(Number);
  const offset = new Date(year, number - 1, 1, 12).getDay();
  const count = new Date(year, number, 0, 12).getDate();
  const days: (string | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= count; day++) days.push(`${month}-${String(day).padStart(2, "0")}`);
  while (days.length % 7) days.push(null);
  return days;
}

export function shiftEventMonth(month: string, offset: number): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year, number - 1 + offset, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function groupEventTasks(tasks: EventTask[]) {
  return TASK_PHASES.map((phase) => ({ ...phase, tasks: tasks.filter((task) => (task.phase ?? "sem_etapa") === phase.value) })).filter((group) => group.tasks.length > 0);
}

export function taskDateLabel(date: string | null): string {
  if (!date) return "Sem prazo";
  return date.split("-").reverse().join("/");
}
