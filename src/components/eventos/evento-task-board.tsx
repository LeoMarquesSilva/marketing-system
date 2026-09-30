"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVENT_TASK_STATUS_LABEL, type EventTask, type EventTaskStatus } from "@/lib/eventos";
import { TASK_PHASES, taskDateLabel } from "@/lib/event-task-list";
import { cn } from "@/lib/utils";

const statuses: EventTaskStatus[] = ["pendente", "em_andamento", "concluida"];

function TaskCard({ task, disabled, today, eventName, onOpen, onMove }: {
  task: EventTask; disabled: boolean; today: string; eventName?: string;
  onOpen: (task: EventTask) => void;
  onMove: (task: EventTask, status: EventTaskStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled });
  const late = task.status !== "concluida" && Boolean(task.dueDate && task.dueDate < today);
  return <article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={cn("relative rounded-lg border bg-card p-3 shadow-sm", isDragging && "z-30 opacity-70 shadow-lg")}>
    <div className="flex items-start gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-6 shrink-0 touch-none cursor-grab" aria-label={"Arrastar tarefa: " + task.title} disabled={disabled} {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></Button>
      <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 rounded text-left text-sm font-medium leading-6 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{task.title}</button>
    </div>
    {eventName && <p className="mt-2 text-xs font-medium text-primary">{eventName}</p>}
    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
      <p className={cn("flex items-center gap-1.5", late && "text-red-600")}><CalendarDays className="h-3.5 w-3.5" />{taskDateLabel(task.dueDate)}{late && " · atrasada"}</p>
      <p className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{task.assigneeName || "Sem responsável"}</p>
      <p>{TASK_PHASES.find(p => p.value === (task.phase ?? "sem_etapa"))?.label}</p>
    </div>
    <select aria-label={"Status da tarefa: " + task.title} disabled={disabled} value={task.status} onChange={e => onMove(task, e.target.value as EventTaskStatus)} className="mt-3 h-8 w-full rounded-md border bg-background px-2 text-xs">
      {statuses.map(status => <option key={status} value={status}>{EVENT_TASK_STATUS_LABEL[status]}</option>)}
    </select>
  </article>;
}

function Column({ status, tasks, ...props }: Omit<Parameters<typeof TaskCard>[0], "task" | "eventName"> & {
  status: EventTaskStatus; tasks: EventTask[]; eventNames?: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: props.disabled });
  return <section ref={setNodeRef} aria-label={EVENT_TASK_STATUS_LABEL[status]} className={cn("min-h-48 rounded-xl border border-border/60 bg-muted/35 p-3", isOver && "border-primary bg-primary/5")}>
    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><span className={cn("h-2 w-2 rounded-full", status === "concluida" ? "bg-emerald-500" : status === "em_andamento" ? "bg-blue-500" : "bg-amber-500")} />{EVENT_TASK_STATUS_LABEL[status]}<span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{tasks.length}</span></h4>
    <div className="space-y-3">{tasks.map(task => <TaskCard key={task.id} task={task} disabled={props.disabled} today={props.today} onOpen={props.onOpen} onMove={props.onMove} eventName={props.eventNames?.[task.eventId]} />)}</div>
    {!tasks.length && <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma tarefa nesta coluna.</p>}
  </section>;
}

export function EventoTaskBoard(props: {
  tasks: EventTask[]; today: string; disabled: boolean; eventNames?: Record<string, string>;
  onOpen: (task: EventTask) => void; onMove: (task: EventTask, status: EventTaskStatus) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  function drop(event: DragEndEvent) {
    const task = props.tasks.find(task => task.id === event.active.id);
    const status = event.over?.id as EventTaskStatus | undefined;
    if (task && status && statuses.includes(status) && task.status !== status && !props.disabled) props.onMove(task, status);
  }
  return <DndContext sensors={sensors} onDragEnd={drop}>
    <p className="mb-3 text-xs text-muted-foreground">Arraste pelo ícone do cartão ou selecione o status. Clique no título para abrir os detalhes.</p>
    <div className="grid items-start gap-4 lg:grid-cols-3">{statuses.map(status => <Column key={status} {...props} status={status} tasks={props.tasks.filter(task => task.status === status)} />)}</div>
  </DndContext>;
}
