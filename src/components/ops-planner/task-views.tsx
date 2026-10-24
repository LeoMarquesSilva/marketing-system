"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventCalendarDays, shiftEventMonth } from "@/lib/event-task-list";
import {
  OPS_BOARD_STATUSES,
  OPS_PRIORITIES,
  OPS_STATUS_LABEL,
  OPS_TASK_STATUSES,
  type OpsList,
  type OpsPerson,
  type OpsTaskStatus,
  type OpsTaskSummary,
} from "@/lib/ops-planner/types";
import { cn } from "@/lib/utils";
import { StatusDot } from "./ops-ui";
import { TaskCard, TaskRow } from "./task-items";

const PRIORITY_RANK = new Map(OPS_PRIORITIES.map((priority, index) => [priority, index]));

/** Prazo mais próximo primeiro (sem prazo no fim), depois a prioridade. */
export function sortTasks(tasks: OpsTaskSummary[]): OpsTaskSummary[] {
  return [...tasks].sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      (PRIORITY_RANK.get(a.priority) ?? 9) - (PRIORITY_RANK.get(b.priority) ?? 9) ||
      a.created_at.localeCompare(b.created_at)
  );
}

interface ViewProps {
  tasks: OpsTaskSummary[];
  lists: Map<string, OpsList>;
  people: Map<string, OpsPerson>;
  today: string;
  onOpen: (task: OpsTaskSummary) => void;
}

/* ------------------------------------------------------------ quadro */

function DraggableCard({ task, ...props }: ViewProps & { task: OpsTaskSummary }) {
  // Sem os atributos de botão do dnd-kit: o cartão já tem o botão que abre a tarefa,
  // e pelo teclado o status muda no detalhe.
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-40")}>
      <TaskCard task={task} list={task.list_id ? props.lists.get(task.list_id) : undefined} people={props.people} today={props.today} onOpen={() => props.onOpen(task)} />
    </div>
  );
}

function BoardColumn({
  status,
  tasks,
  onCreate,
  ...props
}: ViewProps & { status: OpsTaskStatus; onCreate?: (status: OpsTaskStatus) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [limit, setLimit] = useState(status === "concluida" ? 20 : 200);
  const sorted = status === "concluida" ? [...tasks].sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")) : sortTasks(tasks);
  return (
    <section
      ref={setNodeRef}
      aria-label={`${OPS_STATUS_LABEL[status]}: ${tasks.length}`}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-[#dce9eb] bg-[#f6fafb] transition-colors lg:w-auto lg:min-w-0 lg:flex-1",
        isOver && "border-[#47cdd0] bg-[#e8f8f8]"
      )}
    >
      <header className="flex min-h-13 items-center justify-between gap-2 px-3 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <StatusDot status={status} />
          {OPS_STATUS_LABEL[status]}
          <span className="text-xs font-normal tabular-nums text-muted-foreground">{tasks.length}</span>
        </h3>
        {onCreate && status !== "concluida" && (
          <Button type="button" size="icon-xs" variant="ghost" aria-label={`Nova tarefa em ${OPS_STATUS_LABEL[status]}`} onClick={() => onCreate(status)}>
            <Plus />
          </Button>
        )}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {sorted.slice(0, limit).map((task) => (
          <DraggableCard key={task.id} task={task} tasks={tasks} {...props} />
        ))}
        {sorted.length > limit && (
          <Button type="button" size="xs" variant="ghost" onClick={() => setLimit((value) => value + 20)}>
            Ver mais {sorted.length - limit}
          </Button>
        )}
        {tasks.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Arraste uma tarefa para cá</p>}
      </div>
    </section>
  );
}

export function TaskBoardView({
  onMove,
  onCreate,
  tasks,
  ...rest
}: ViewProps & { onMove: (task: OpsTaskSummary, status: OpsTaskStatus) => void; onCreate?: (status: OpsTaskStatus) => void }) {
  const props = { ...rest, tasks };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? tasks.find((task) => task.id === activeId) : undefined;
  const byStatus = useMemo(() => {
    const map = new Map<OpsTaskStatus, OpsTaskSummary[]>(OPS_BOARD_STATUSES.map((status) => [status, []]));
    for (const task of tasks) map.get(task.status)?.push(task);
    return map;
  }, [tasks]);

  function start(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function end(event: DragEndEvent) {
    setActiveId(null);
    const task = tasks.find((item) => item.id === event.active.id);
    const status = event.over?.id as OpsTaskStatus | undefined;
    if (task && status && OPS_BOARD_STATUSES.includes(status) && task.status !== status) onMove(task, status);
  }

  return (
    <DndContext sensors={sensors} onDragStart={start} onDragEnd={end} onDragCancel={() => setActiveId(null)}>
      <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {OPS_BOARD_STATUSES.map((status) => (
          <BoardColumn key={status} status={status} {...props} tasks={byStatus.get(status) ?? []} onCreate={onCreate} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Arraste o cartão entre as colunas ou abra a tarefa para mudar o status.</p>
      <DragOverlay>
        {active && (
          <div className="w-72">
            <TaskCard task={active} list={active.list_id ? props.lists.get(active.list_id) : undefined} people={props.people} today={props.today} onOpen={() => {}} dragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/* ------------------------------------------------------------ lista */

export function TaskListView({ showDone, ...props }: ViewProps & { showDone: boolean }) {
  const [collapsed, setCollapsed] = useState<Set<OpsTaskStatus>>(() => new Set(["concluida", "cancelada"]));
  const statuses = OPS_TASK_STATUSES.filter((status) => showDone || (status !== "concluida" && status !== "cancelada"));
  const groups = statuses
    .map((status) => ({ status, tasks: sortTasks(props.tasks.filter((task) => task.status === status)) }))
    .filter((group) => group.tasks.length > 0);

  if (groups.length === 0) {
    return <p className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma tarefa com esses filtros.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map(({ status, tasks }) => {
        const isCollapsed = collapsed.has(status);
        return (
          <section key={status} className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(status)) next.delete(status);
                  else next.add(status);
                  return next;
                })
              }
              className="flex w-full items-center gap-2 border-b border-[#eef3f4] bg-[#f6fafb] px-3 py-2 text-left text-sm font-semibold"
            >
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
              <StatusDot status={status} />
              {OPS_STATUS_LABEL[status]}
              <span className="text-xs font-normal tabular-nums text-muted-foreground">{tasks.length}</span>
            </button>
            {!isCollapsed &&
              tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  list={task.list_id ? props.lists.get(task.list_id) : undefined}
                  people={props.people}
                  today={props.today}
                  onOpen={() => props.onOpen(task)}
                  showStatus={false}
                />
              ))}
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ calendário */

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function TaskCalendarView(props: ViewProps & { onCreateOn?: (date: string) => void }) {
  const [month, setMonth] = useState(() => props.today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const days = eventCalendarDays(month);
  const byDate = useMemo(() => {
    const map = new Map<string, OpsTaskSummary[]>();
    for (const task of props.tasks) {
      if (!task.due_date) continue;
      map.set(task.due_date, [...(map.get(task.due_date) ?? []), task]);
    }
    return map;
  }, [props.tasks]);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
  const day = selected?.startsWith(month) ? selected : null;
  const agenda = sortTasks(day ? byDate.get(day) ?? [] : props.tasks.filter((task) => task.due_date?.startsWith(month)));
  const undated = props.tasks.filter((task) => !task.due_date && task.status !== "concluida" && task.status !== "cancelada");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold capitalize" aria-live="polite">
          {monthLabel}
        </h3>
        <div className="flex gap-1">
          <Button size="icon-sm" variant="outline" aria-label="Mês anterior" onClick={() => setMonth(shiftEventMonth(month, -1))}>
            <ChevronLeft />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setMonth(props.today.slice(0, 7));
              setSelected(null);
            }}
          >
            Hoje
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Próximo mês" onClick={() => setMonth(shiftEventMonth(month, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
        <div className="grid grid-cols-7 border-b border-[#eef3f4] bg-[#f6fafb]">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="py-2 text-center text-xs font-semibold text-[#315f73]">
              {weekday}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date, index) => {
            const dayTasks = date ? sortTasks(byDate.get(date) ?? []) : [];
            const overdue = dayTasks.some((task) => date && date < props.today && task.status !== "concluida" && task.status !== "cancelada");
            return (
              <div
                key={date ?? `vazio-${index}`}
                className={cn("min-h-16 min-w-0 border-b border-r border-[#eef3f4] p-1 sm:min-h-28 sm:p-1.5", !date && "bg-slate-50/60", date === day && "bg-[#e8f8f8]")}
              >
                {date && (
                  <>
                    <button
                      type="button"
                      aria-label={`${date.split("-").reverse().join("/")}${dayTasks.length ? `, ${dayTasks.length} tarefas` : ""}`}
                      aria-pressed={day === date}
                      onClick={() => setSelected(date)}
                      className={cn(
                        "grid size-7 place-items-center rounded-full text-xs hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#47cdd0]",
                        date === props.today && "bg-[#347796] font-semibold text-white hover:bg-[#285f7a]"
                      )}
                    >
                      {Number(date.slice(-2))}
                    </button>
                    <div className="hidden space-y-1 sm:block">
                      {dayTasks.slice(0, 3).map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => props.onOpen(task)}
                          className={cn(
                            "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs hover:bg-[#e8f8f8]",
                            task.status === "concluida" && "text-muted-foreground line-through"
                          )}
                        >
                          <StatusDot status={task.status} />
                          <span className="truncate">{task.title}</span>
                        </button>
                      ))}
                      {dayTasks.length > 3 && (
                        <button type="button" className="px-1 text-xs text-[#285f7a] hover:underline" onClick={() => setSelected(date)}>
                          +{dayTasks.length - 3}
                        </button>
                      )}
                    </div>
                    {dayTasks.length > 0 && (
                      <span className={cn("mt-1 block text-center text-xs sm:hidden", overdue ? "text-red-700" : "text-[#285f7a]")}>{dayTasks.length}</span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-[#eef3f4] bg-[#f6fafb] px-3 py-2">
          <h4 className="text-sm font-semibold">{day ? `Tarefas de ${day.split("-").reverse().join("/")}` : "Agenda do mês"}</h4>
          <div className="flex gap-1">
            {day && props.onCreateOn && (
              <Button size="xs" variant="ghost" onClick={() => props.onCreateOn?.(day)}>
                <Plus />
                Tarefa neste dia
              </Button>
            )}
            {day && (
              <Button size="xs" variant="ghost" onClick={() => setSelected(null)}>
                Ver mês
              </Button>
            )}
          </div>
        </div>
        {agenda.map((task) => (
          <TaskRow key={task.id} task={task} list={task.list_id ? props.lists.get(task.list_id) : undefined} people={props.people} today={props.today} onOpen={() => props.onOpen(task)} />
        ))}
        {agenda.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma tarefa com prazo neste período.</p>}
      </div>
      {undated.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
          <h4 className="border-b border-[#eef3f4] bg-[#f6fafb] px-3 py-2 text-sm font-semibold">Sem prazo ({undated.length})</h4>
          {sortTasks(undated).map((task) => (
            <TaskRow key={task.id} task={task} people={props.people} today={props.today} onOpen={() => props.onOpen(task)} />
          ))}
        </div>
      )}
    </div>
  );
}
