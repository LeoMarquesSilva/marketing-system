"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronDown, ListChecks, Pencil, Plus, Search, Send, Trash2, SlidersHorizontal, Columns3, RefreshCw } from "lucide-react";
import { EventTaskPeople } from "./event-task-people";
import { EventoTaskBoard } from "@/components/eventos/evento-task-board";
import { EventoTaskCalendar } from "@/components/eventos/evento-task-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventoTaskEditor } from "@/components/eventos/evento-task-editor";
import { EVENT_TASK_STATUS_LABEL, type EventTask, type EventTaskStatus, type EventAttachment } from "@/lib/eventos";
import { TASK_PHASES, filterEventTasks, groupEventTasks, taskAssigneeIds, taskDateLabel, type EventTaskDraft, type TaskFilters } from "@/lib/event-task-list";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";

export function EventoTarefasTab({ tasks, users, newTaskTitle, setNewTaskTitle, onAddTask, onUpdateTask, onDeleteTask, onSendPlanner, isBusy = false, eventNames, eventDates, attachments = [], canCreate = true, onRefresh, initialTaskId }: {
  initialTaskId?: string | null;
  tasks: EventTask[];
  users: User[];
  newTaskTitle: string;
  setNewTaskTitle: (value: string) => void;
  onAddTask: (draft?: EventTaskDraft) => Promise<boolean>;
  onUpdateTask: (taskId: string, partial: Record<string, unknown>) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<boolean>;
  onSendPlanner?: (task: EventTask) => void;
  isBusy?: boolean;
  eventNames?: Record<string, string>;
  eventDates?: { date: string; name: string; id: string }[];
  attachments?: EventAttachment[];
  canCreate?: boolean;
  onRefresh?: () => Promise<void>;
}) {
  const [view, setView] = useState<"quadro" | "lista" | "calendario">("quadro");
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>({ search: "", status: "all", assignee: "all" });
  const [editor, setEditor] = useState<{ task: EventTask | null; status?: EventTaskStatus } | null>(() => { const task = tasks.find(task => task.id === initialTaskId); return task ? {task} : null; });
  const [deleting, setDeleting] = useState<EventTask | null>(null);
  const [error, setError] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const resolvedTasks = tasks.map(task => {
    const assignees = taskAssigneeIds(task).map(id => {
      const user = users.find(user => user.id === id);
      return { id, name: user?.name ?? (id === task.assigneeId ? task.assigneeName : null) ?? "Pessoa indisponível", avatar: user?.avatar_url ?? (id === task.assigneeId ? task.assigneeAvatar : null) ?? null };
    });
    return { ...task, assignees, assigneeName: assignees[0]?.name ?? null, assigneeAvatar: assignees[0]?.avatar ?? null };
  });
  const visible = filterEventTasks(resolvedTasks, filters, today);
  const activeFilters = [filters.status !== "all", filters.assignee !== "all", Boolean(filters.phase && filters.phase !== "all")].filter(Boolean).length;
  const completed = tasks.filter((task) => task.status === "concluida").length;
  const overdue = tasks.filter((task) => task.status !== "concluida" && task.dueDate && task.dueDate < today).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const assigned = Array.from(new Set(tasks.flatMap(taskAssigneeIds)));
  const selectClass = "h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm";

  async function move(task: EventTask, status: EventTaskStatus) {
    if (isBusy || task.status === status) return;
    setError("");
    try { if (!await onUpdateTask(task.id, { status })) setError("Não foi possível mover a tarefa. Ela permanece no status anterior."); }
    catch { setError("Não foi possível mover a tarefa. Ela permanece no status anterior."); }
  }
  async function refresh() {
    if (!onRefresh || refreshing || isBusy || editor) return;
    setRefreshing(true); setError("");
    try { await onRefresh(); } catch { setError("Não foi possível atualizar as tarefas. Tente novamente."); }
    finally { setRefreshing(false); }
  }

  async function toggleComplete(task: EventTask) {
    setError("");
    try {
      if (!await onUpdateTask(task.id, { status: task.status === "concluida" ? "pendente" : "concluida" })) setError("Não foi possível atualizar a tarefa. Tente novamente.");
    } catch { setError("Não foi possível atualizar a tarefa. Tente novamente."); }
  }
  async function remove() {
    if (!deleting || isBusy) return;
    setError("");
    try {
      if (await onDeleteTask(deleting.id)) setDeleting(null);
      else setError("Não foi possível excluir a tarefa. Tente novamente.");
    } catch { setError("Não foi possível excluir a tarefa. Tente novamente."); }
  }

  return (
    <div className="space-y-5" aria-busy={isBusy}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold tracking-tight">Planner do evento</h2><div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span>{completed} de {tasks.length} concluídas</span><div role="progressbar" aria-label="Progresso das tarefas" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{width: `${progress}%`}} /></div>{overdue > 0 && <span className="text-red-600">{overdue} atrasadas</span>}</div></div>
        <div className="flex gap-2">{onRefresh && <Button variant="ghost" size="icon" aria-label="Atualizar tarefas" disabled={isBusy || refreshing || Boolean(editor)} onClick={() => void refresh()}><RefreshCw className={cn("size-4", refreshing && "animate-spin")} /></Button>}<Button disabled={isBusy || !canCreate} onClick={() => setEditor({task: null})}><Plus className="size-4" />Nova tarefa</Button></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div role="group" aria-label="Visualização do Planner" className="flex gap-1 rounded-lg bg-muted/70 p-1">
          {([{id: "quadro", label: "Quadro", icon: Columns3}, {id: "lista", label: "Lista", icon: ListChecks}, {id: "calendario", label: "Calendário", icon: CalendarDays}] as const).map(item => <Button key={item.id} size="sm" variant="ghost" className={cn("text-xs", view === item.id ? "bg-card text-primary shadow-xs hover:bg-card" : "text-muted-foreground")} aria-pressed={view === item.id} onClick={() => setView(item.id)}><item.icon className="size-3.5" />{item.label}</Button>)}
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1 sm:max-w-md"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Buscar tarefas" className="h-9 bg-card pl-9 text-xs" value={filters.search} onChange={e => setFilters(current => ({...current, search: e.target.value}))} placeholder="Buscar tarefa ou detalhe…" /></div><Button size="sm" variant={showFilters || activeFilters ? "secondary" : "ghost"} aria-expanded={showFilters} aria-controls="event-task-filters" onClick={() => setShowFilters(value => !value)}><SlidersHorizontal className="size-3.5" />Filtros{activeFilters > 0 && <span className="text-xs">{activeFilters}</span>}</Button></div>
      </div>
      {showFilters && <div id="event-task-filters" className="grid gap-2 sm:grid-cols-3">
        <select aria-label="Filtrar por status" className={selectClass} value={filters.status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value as TaskFilters["status"] }))}>
          <option value="all">Todos os status</option>
          {Object.entries(EVENT_TASK_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          <option value="overdue">Atrasadas</option>
        </select>
        <select aria-label="Filtrar por responsável" className={selectClass} value={filters.assignee} onChange={(e) => setFilters((current) => ({ ...current, assignee: e.target.value }))}>
          <option value="all">Todos os responsáveis</option><option value="unassigned">Sem responsável</option>
          {assigned.map((id) => <option key={id} value={id}>{users.find((user) => user.id === id)?.name ?? tasks.find((task) => task.assigneeId === id)?.assigneeName ?? "Responsável indisponível"}</option>)}
        </select>
        <select aria-label="Filtrar por etapa" className={selectClass} value={filters.phase ?? "all"} onChange={e => setFilters(current => ({ ...current, phase: e.target.value as TaskFilters["phase"] }))}><option value="all">Todas as etapas</option>{TASK_PHASES.map(phase => <option key={phase.value} value={phase.value}>{phase.label}</option>)}</select>
      </div>}
      {canCreate && view === "lista" && <form className="flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || isBusy) return;
        setError("");
        try { if (!await onAddTask()) setError("Não foi possível criar a tarefa. Tente novamente."); }
        catch { setError("Não foi possível criar a tarefa. Tente novamente."); }
      }}>
        <Input aria-label="Título da tarefa rápida" placeholder="Adicionar uma tarefa rápida…" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} disabled={isBusy} />
        <Button variant="outline" type="submit" disabled={isBusy || !newTaskTitle.trim()}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Adicionar</span><span className="sr-only sm:hidden">Adicionar tarefa rápida</span></Button>
      </form>}
      {!canCreate && <p className="text-xs text-muted-foreground">Selecione um evento para criar tarefas.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {visible.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center">
        <ListChecks className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{tasks.length ? "Nenhuma tarefa corresponde aos filtros." : "Comece adicionando as próximas ações do evento."}</p>
        {tasks.length > 0 && <Button variant="link" onClick={() => setFilters({ search: "", status: "all", assignee: "all" })}>Limpar filtros</Button>}
      </div>}
      {view === "quadro" && <EventoTaskBoard tasks={visible} today={today} disabled={isBusy} eventNames={eventNames} attachments={attachments} onCreate={canCreate ? status => setEditor({task: null, status}) : undefined} onOpen={task => setEditor({ task })} onMove={(task, status) => void move(task, status)} />}
      {view === "calendario" && <EventoTaskCalendar tasks={visible} today={today} eventDates={eventDates} eventNames={eventNames} onOpen={task => setEditor({ task })} />}
      {view === "lista" && groupEventTasks(visible).map((group) => <section key={group.value} aria-label={group.label} className="space-y-2">
        <div className="flex items-center gap-2 px-1"><h4 className="text-sm font-semibold">{group.label}</h4><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{group.tasks.length}</span></div>
        <div className="divide-y rounded-xl border border-border/60 bg-card">
          {group.tasks.map((task) => {
            const done = task.status === "concluida";
            const late = !done && Boolean(task.dueDate && task.dueDate < today);
            return <div key={task.id} className="flex items-start gap-2 p-3 sm:gap-3 sm:p-4">
              <button type="button" aria-label={(done ? "Reabrir tarefa: " : "Concluir tarefa: ") + task.title} aria-pressed={done} disabled={isBusy} onClick={() => void toggleComplete(task)} className={cn("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347796] disabled:opacity-50", done ? "border-emerald-600 bg-emerald-600 text-white" : "border-border text-muted-foreground hover:border-[#347796] hover:text-[#347796]")}>
                {done && <Check className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <details className="group/task">
                  <summary className="flex cursor-pointer list-none items-start gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-[#347796] [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1">
                      <p className={cn("break-words text-sm font-medium leading-6", done && "text-muted-foreground")}>{task.title}</p>
                      {eventNames?.[task.eventId] && <p className="text-xs text-primary">{eventNames[task.eventId]}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span className={cn("inline-flex items-center gap-1", late && "text-red-600")}><CalendarDays className="h-3.5 w-3.5" />{taskDateLabel(task.dueDate)}{late && " · atrasada"}</span>
                        <EventTaskPeople task={task} />
                        <span className={cn("rounded-full px-2 py-0.5", done ? "bg-emerald-50 text-emerald-700" : task.status === "em_andamento" ? "bg-blue-50 text-blue-700" : "bg-muted")}>{EVENT_TASK_STATUS_LABEL[task.status]}</span>
                      </div>
                    </div>
                    <ChevronDown aria-hidden className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/task:rotate-180" /><span className="sr-only">Abrir detalhes</span>
                  </summary>
                  <div className="mt-4 border-t border-border/60 pt-4">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{task.description || "Sem detalhes registrados. Edite a tarefa para adicionar o objetivo e o acompanhamento."}</p>
                    <Button size="sm" variant="link" className="mt-2 px-0" disabled={isBusy} onClick={() => setEditor({ task })}><Pencil className="h-3.5 w-3.5" />Editar detalhes</Button>
                  </div>
                </details>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => setEditor({ task })}><Pencil className="h-3.5 w-3.5" />Editar</Button>
                  {task.marketingRequestId ? <Link href={"/solicitacoes?id=" + task.marketingRequestId} className="inline-flex items-center px-2 text-xs text-[#347796] hover:underline">Abrir solicitação de marketing</Link> : onSendPlanner && <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onSendPlanner(task)}><Send className="h-3.5 w-3.5" />Solicitar marketing</Button>}
                  <Button variant="ghost" size="sm" disabled={isBusy} aria-label={"Excluir tarefa: " + task.title} onClick={() => { setError(""); setDeleting(task); }}><Trash2 className="h-3.5 w-3.5 text-red-500" /><span className="sr-only">Excluir</span></Button>
                </div>
              </div>
            </div>;
          })}
        </div>
      </section>)}
      {editor && <EventoTaskEditor key={editor.task?.id ?? "new"} task={editor.task} initialStatus={editor.status} users={users} attachments={attachments} onClose={() => setEditor(null)} onSave={(draft) => editor.task ? onUpdateTask(editor.task.id, draft) : onAddTask(draft)} />}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !isBusy) setDeleting(null); }}>
        <DialogContent showCloseButton={!isBusy}>
          <DialogHeader><DialogTitle>Excluir tarefa?</DialogTitle><DialogDescription>A tarefa “{deleting?.title}” será removida do evento. Essa ação não pode ser desfeita.</DialogDescription></DialogHeader>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <DialogFooter><Button variant="outline" disabled={isBusy} onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={isBusy} onClick={() => void remove()}>Excluir tarefa</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
