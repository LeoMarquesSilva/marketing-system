"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical, MoreHorizontal, Paperclip, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/eventos/event-menu";
import { EventPerson } from "./event-person";
import { EVENT_TASK_STATUS_LABEL, type EventTask, type EventTaskStatus, type EventAttachment } from "@/lib/eventos";
import { TASK_PHASES, taskDateLabel } from "@/lib/event-task-list";
import { cn } from "@/lib/utils";

const statuses: EventTaskStatus[] = ["pendente", "em_andamento", "concluida"];
const columnLabels = { pendente: "A fazer", em_andamento: "Em andamento", concluida: "Concluído" };

function TaskCard({ task, disabled, today, eventName, attachments, onOpen, onMove }: {
  task: EventTask; disabled: boolean; today: string; eventName?: string; attachments: EventAttachment[];
  onOpen: (task: EventTask) => void; onMove: (task: EventTask, status: EventTaskStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled });
  const late = task.status !== "concluida" && Boolean(task.dueDate && task.dueDate < today);
  const files = attachments.filter(file => file.eventId === task.eventId && file.relatedId === task.id);
  return <article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={cn("group/card relative rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-shadow hover:shadow-sm", isDragging && "z-30 opacity-70 shadow-lg")}>
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{TASK_PHASES.find(p => p.value === (task.phase ?? "sem_etapa"))?.label}</span>
      <div className="flex items-center"><Button variant="ghost" size="icon" className="size-8 shrink-0 touch-none cursor-grab text-muted-foreground" aria-label={"Arrastar tarefa: " + task.title} disabled={disabled} {...attributes} {...listeners}><GripVertical className="size-3.5" /></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={"Ações da tarefa: " + task.title} disabled={disabled}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onOpen(task)}>Editar tarefa</DropdownMenuItem><DropdownMenuLabel>Mover para</DropdownMenuLabel>{statuses.map(status => <DropdownMenuItem key={status} disabled={task.status === status} onSelect={() => onMove(task, status)}>{EVENT_TASK_STATUS_LABEL[status]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      </div>
    </div>
    <button type="button" onClick={() => onOpen(task)} className="block w-full rounded text-left text-sm font-semibold leading-[1.5] hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{task.title}</button>
    {task.description && <p className="mt-2 line-clamp-2 whitespace-pre-line break-words text-xs leading-5 text-muted-foreground">{task.description}</p>}
    {eventName && <p className="mt-2 text-xs font-medium text-primary">{eventName}</p>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
      <span className={cn("inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px]", late ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-muted/70 text-muted-foreground")}><CalendarDays className="size-3" />{taskDateLabel(task.dueDate)}{late && " · atrasada"}</span>
      <div className="flex items-center gap-2">{files.length > 0 && <span title={`${files.length} anexos`} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="size-3" />{files.length}</span>}{task.assigneeName ? <EventPerson name={task.assigneeName} avatar={task.assigneeAvatar} compact /> : <span title="Sem responsável" className="flex size-7 items-center justify-center rounded-full border border-dashed text-muted-foreground"><UserRound className="size-3.5" /><span className="sr-only">Sem responsável</span></span>}</div>
    </div>
  </article>;
}

function Column({ status, tasks, onCreate, ...props }: Omit<Parameters<typeof TaskCard>[0], "task" | "eventName"> & {
  status: EventTaskStatus; tasks: EventTask[]; eventNames?: Record<string, string>; onCreate?: (status: EventTaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: props.disabled });
  return <section ref={setNodeRef} aria-label={columnLabels[status]} className={cn("min-h-64 min-w-0 rounded-xl border border-transparent bg-muted/60 p-3", isOver && "border-primary bg-primary/10")}>
    <div className="mb-3 flex items-center gap-2 px-1"><span className={cn("size-2 rounded-full", status === "concluida" ? "bg-emerald-600" : status === "em_andamento" ? "bg-primary" : "bg-slate-400")} /><h3 className="text-xs font-semibold">{columnLabels[status]}</h3><span className="text-xs text-muted-foreground">{tasks.length}</span>{onCreate && <Button variant="ghost" size="icon" className="ml-auto size-8" disabled={props.disabled} aria-label={`Adicionar tarefa em ${columnLabels[status]}`} onClick={() => onCreate(status)}><Plus className="size-3.5" /></Button>}</div>
    <div className="space-y-3">{tasks.map(task => <TaskCard key={task.id} task={task} disabled={props.disabled} today={props.today} attachments={props.attachments} onOpen={props.onOpen} onMove={props.onMove} eventName={props.eventNames?.[task.eventId]} />)}</div>
    {!tasks.length && <div className="rounded-lg border border-dashed border-border px-3 py-10 text-center text-xs leading-5 text-muted-foreground">{status === "concluida" ? "As entregas concluídas aparecem aqui." : "Arraste uma tarefa para esta etapa."}</div>}
    {onCreate && <Button variant="ghost" className="mt-2 w-full justify-start text-xs text-muted-foreground" disabled={props.disabled} onClick={() => onCreate(status)}><Plus className="size-3.5" />Adicionar tarefa</Button>}
  </section>;
}

export function EventoTaskBoard(props: {
  tasks: EventTask[]; today: string; disabled: boolean; eventNames?: Record<string, string>; attachments?: EventAttachment[];
  onOpen: (task: EventTask) => void; onMove: (task: EventTask, status: EventTaskStatus) => void; onCreate?: (status: EventTaskStatus) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  function drop(event: DragEndEvent) {
    const task = props.tasks.find(task => task.id === event.active.id);
    const status = event.over?.id as EventTaskStatus | undefined;
    if (task && status && statuses.includes(status) && task.status !== status && !props.disabled) props.onMove(task, status);
  }
  return <DndContext sensors={sensors} onDragEnd={drop}><div className="grid items-start gap-4 lg:grid-cols-3">{statuses.map(status => <Column key={status} {...props} attachments={props.attachments ?? []} status={status} tasks={props.tasks.filter(task => task.status === status)} />)}</div><p className="mt-3 text-[11px] text-muted-foreground">Arraste pelo ícone do cartão ou use o menu de ações para mudar o status.</p></DndContext>;
}
