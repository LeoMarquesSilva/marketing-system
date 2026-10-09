"use client";

import { useId, useState, type FormEvent } from "react";
import { CalendarDays, Check, CheckCircle2, Circle, Copy, FileText, FolderOpen, Loader2, Pencil, Save, Trash2, UserRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { EventTaskAssignees } from "./event-task-assignees";
import { EventTaskPeople } from "./event-task-people";
import { EventTaskFiles, EventTaskFollowUps, EventTaskInformation, type EventTaskContext } from "./event-task-detail-sections";
import { EVENT_TASK_STATUS_LABEL, formatBrl, type EventTask, type EventTaskStatus, type EventTaskPhase, type EventAttachment } from "@/lib/eventos";
import { TASK_PHASES, taskAssigneeIds, taskDateLabel, type EventTaskDraft } from "@/lib/event-task-list";
import type { User } from "@/lib/users";
import { CHECKLIST_CATEGORIES, checklistCategoryLabel } from "@/lib/event-checklist";
import { cn } from "@/lib/utils";

export function EventoTaskEditor({ task, users, onClose, onSave, onDuplicate, onRequestDelete, attachments = [], initialStatus = "pendente", initialCategory, categories = [], context = "task", taskContext }: {
  context?: "task" | "checklist";
  taskContext?: EventTaskContext;
  initialCategory?: string;
  categories?: string[];
  initialStatus?: EventTaskStatus;
  task: EventTask | null;
  users: User[];
  onClose: () => void;
  onSave: (draft: EventTaskDraft) => Promise<boolean>;
  onDuplicate?: (draft: EventTaskDraft) => Promise<boolean>;
  onRequestDelete?: () => void;
  attachments?: EventAttachment[];
}) {
  function originalDraft(): EventTaskDraft {
    return { title: task?.title ?? "", description: task?.description ?? "", category: task?.category ? checklistCategoryLabel(task.category) : initialCategory ?? "", assigneeId: task?.assigneeId ?? null, assigneeIds: task ? taskAssigneeIds(task) : [], externalResponsibleName: task?.externalResponsibleName ?? "", dueDate: task?.dueDate ?? null, status: task?.status ?? initialStatus, phase: task ? task.phase : "pre_evento" };
  }
  const [draft, setDraft] = useState<EventTaskDraft>(originalDraft);
  const [editing, setEditing] = useState(!task);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const blocked = saving || Boolean(taskContext?.isBusy);
  const categoryListId = useId();
  const titleId = useId();
  const formId = useId();
  const dateId = useId();
  const descriptionId = useId();
  const statusId = useId();
  const phaseId = useId();
  const current = editing || !task ? draft : { ...draft, ...task };
  const done = current.status === "concluida";
  const expense = task?.budgetItemId ? taskContext?.budgetItems?.find(item => item.id === task.budgetItemId && item.eventId === task.eventId) : undefined;
  const people = taskAssigneeIds({ assigneeId: current.assigneeId, assigneeIds: current.assigneeIds }).map(id => {
    const user = users.find(person => person.id === id);
    const known = task?.assignees?.find(person => person.id === id);
    return { id, name: user?.name ?? known?.name ?? (id === task?.assigneeId ? task.assigneeName : null) ?? "Pessoa indisponível", avatar: user?.avatar_url ?? known?.avatar ?? null };
  });
  const category = current.category ? checklistCategoryLabel(current.category) : "Sem categoria";
  const selectClass = "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20";
  function change<K extends keyof EventTaskDraft>(key: K, value: EventTaskDraft[K]) { setDraft(previous => ({ ...previous, [key]: value })); }
  function edit() { setDraft(originalDraft()); setError(""); setEditing(true); }
  async function persist(event: FormEvent) {
    event.preventDefault();
    if (!editing || !draft.title.trim() || saving) return;
    setSaving(true); setError("");
    try {
      const ok = await onSave({ ...draft, title: draft.title.trim(), description: draft.description?.trim() || null, category: draft.category?.trim() || null });
      if (ok) onClose(); else setError("Não foi possível salvar. Seus dados foram mantidos; tente novamente.");
    } catch { setError("Não foi possível salvar. Seus dados foram mantidos; tente novamente."); }
    finally { setSaving(false); }
  }
  async function toggleComplete() {
    if (!task || saving) return;
    const status: EventTaskStatus = done ? "pendente" : "concluida";
    setSaving(true); setError("");
    try {
      if (await onSave({ ...originalDraft(), status })) change("status", status);
      else setError("Não foi possível atualizar o status. Tente novamente.");
    } catch { setError("Não foi possível atualizar o status. Tente novamente."); }
    finally { setSaving(false); }
  }
  async function duplicate() {
    if (!onDuplicate || saving) return;
    setSaving(true); setError("");
    try {
      if (await onDuplicate({ ...originalDraft(), title: `${task?.title ?? draft.title} (cópia)`, status: "pendente" })) onClose();
      else setError("Não foi possível duplicar a tarefa. Tente novamente.");
    } catch { setError("Não foi possível duplicar a tarefa. Tente novamente."); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !blocked) onClose(); }}>
    <DialogContent overlayClassName="z-[90]" className="z-[91] flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col gap-0 rounded-2xl border-border/70 p-0 font-sans sm:max-w-[960px]" showCloseButton={!blocked}>
      <DialogHeader className="shrink-0 px-4 pb-4 pt-5 text-left sm:px-6 sm:pt-6">
        {editing && task ? <><DialogTitle className="sr-only">Editar tarefa: {task.title}</DialogTitle><Label htmlFor={titleId} className="text-xs font-medium text-muted-foreground">Nome da tarefa</Label><Input id={titleId} form={formId} autoFocus required maxLength={500} value={draft.title} onChange={event => change("title", event.target.value)} className="h-12 rounded-lg bg-card pr-10 text-lg font-semibold" /></> : <div className="flex items-start gap-2 pr-8"><DialogTitle className="min-w-0 flex-1 break-words text-xl font-semibold leading-7 [overflow-wrap:anywhere] sm:text-2xl sm:leading-8">{task ? task.title : context === "checklist" ? "Novo item do checklist" : "Nova tarefa"}</DialogTitle>{task && <Button type="button" variant="outline" size="sm" disabled={blocked} className="mt-0.5 shrink-0 rounded-lg text-xs shadow-none" onClick={edit}><Pencil className="size-3.5" />Editar nome</Button>}</div>}
        <DialogDescription>{editing ? "Organize a entrega e salve as alterações ao finalizar." : "Detalhes da tarefa"}</DialogDescription>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium", done ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-primary/8 text-primary")}>{done ? <CheckCircle2 className="size-4" /> : <Circle className="size-3.5" />}{EVENT_TASK_STATUS_LABEL[current.status]}</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground"><FolderOpen className="size-3.5" />{category}</span>
          {expense && <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium"><Wallet className="size-3.5 text-primary" />{formatBrl(expense.amountPlanned)}</span>}
        </div>
      </DialogHeader>
      <form id={formId} onSubmit={persist} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6">
          <fieldset disabled={blocked} className="min-w-0 space-y-4">
            {editing && !task && <div className="space-y-2"><Label htmlFor={titleId}>Nome da tarefa</Label><Input id={titleId} autoFocus required maxLength={500} value={draft.title} onChange={event => change("title", event.target.value)} placeholder="Ex.: Conferir montagem da decoração" className="rounded-lg" /></div>}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-primary/10 bg-muted/25 p-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
              <div className="col-span-2 min-w-0 space-y-2 sm:col-span-3 lg:col-span-1"><p className="flex items-center gap-2 text-xs text-muted-foreground"><UserRound className="size-4 shrink-0 text-primary" />Responsáveis</p>{editing ? <EventTaskAssignees users={users} value={draft.assigneeIds} onChange={ids => setDraft(previous => ({ ...previous, assigneeIds: ids, assigneeId: ids[0] ?? null }))} disabled={blocked} /> : <EventTaskPeople task={{ ...task!, assignees: people }} />}</div>
              <div className="min-w-0 space-y-2"><Label htmlFor={dateId} className="flex items-center gap-2 text-xs font-normal text-muted-foreground"><CalendarDays className="size-4 text-primary" />Prazo</Label>{editing ? <DatePickerField id={dateId} value={draft.dueDate ?? ""} onChange={value => change("dueDate", value || null)} disabled={blocked} /> : <p className="text-sm font-medium">{taskDateLabel(current.dueDate)}</p>}</div>
              <div className="min-w-0 space-y-2"><Label htmlFor={categoryListId} className="flex items-center gap-2 text-xs font-normal text-muted-foreground"><FolderOpen className="size-4 text-primary" />Categoria</Label>{editing ? <Input id={categoryListId} list={`${categoryListId}-options`} maxLength={120} value={draft.category ?? ""} onChange={event => change("category", event.target.value)} placeholder="Escolha ou digite" className="rounded-lg bg-card" /> : <p className="break-words text-sm font-medium">{category}</p>}<datalist id={`${categoryListId}-options`}>{Array.from(new Set([...CHECKLIST_CATEGORIES, ...categories])).map(value => <option key={value} value={value} />)}</datalist></div>
              <div className="min-w-0 space-y-2"><Label htmlFor={statusId} className="flex items-center gap-2 text-xs font-normal text-muted-foreground"><CheckCircle2 className={cn("size-4 text-primary", done && "text-emerald-600")} />Status</Label>{editing ? <select id={statusId} className={selectClass} value={draft.status} onChange={event => change("status", event.target.value as EventTaskStatus)}>{Object.entries(EVENT_TASK_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <p className="text-sm font-medium">{EVENT_TASK_STATUS_LABEL[current.status]}</p>}</div>
            </div>
            {editing && <div className="grid gap-2 rounded-xl border border-border/60 bg-card p-4 sm:grid-cols-[180px_1fr] sm:items-center"><Label htmlFor={`${titleId}-external`} className="text-xs text-muted-foreground">Responsável externo</Label><Input id={`${titleId}-external`} maxLength={120} value={draft.externalResponsibleName ?? ""} onChange={event => change("externalResponsibleName", event.target.value)} placeholder="Ex.: Marcele (M. Tetti)" className="rounded-lg" /><p className="text-xs text-muted-foreground sm:col-start-2">Para fornecedores ou parceiros sem acesso ao sistema.</p></div>}
            {editing && <div role="group" aria-label="Categorias sugeridas" className="flex flex-wrap gap-1.5">{CHECKLIST_CATEGORIES.map(value => <button key={value} type="button" aria-pressed={draft.category === value} onClick={() => change("category", value)} className={cn("min-h-8 rounded-lg border px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary", draft.category === value ? "border-primary/25 bg-primary/10 font-medium text-primary" : "border-border/70 text-muted-foreground hover:border-primary/25 hover:text-primary")}>{value}</button>)}</div>}
            <div className={cn("grid items-start gap-4", task && "lg:grid-cols-[minmax(0,1fr)_240px]")}>
              <div className="min-w-0 space-y-3">
                <section className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-primary" />Descrição</h3>{!editing && <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs shadow-none" disabled={blocked} onClick={edit}><Pencil className="size-3.5" />Editar</Button>}</div>
                  {editing ? <><Label htmlFor={descriptionId} className="sr-only">Descrição da tarefa</Label><Textarea id={descriptionId} rows={5} value={draft.description ?? ""} onChange={event => change("description", event.target.value)} placeholder="Informações necessárias para executar esta tarefa…" className="resize-y rounded-lg leading-6" /></> : <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{current.description || "Adicione uma descrição para orientar a execução desta tarefa."}</p>}
                </section>
                {task && <><EventTaskFollowUps task={task} history={taskContext?.history} users={users} onAdd={taskContext?.onAddFollowUp} onEdit={taskContext?.onEditFollowUp} onDelete={taskContext?.onDeleteFollowUp} onToggle={taskContext?.onToggleFollowUp} disabled={blocked} /><EventTaskFiles task={task} attachments={attachments} onLink={taskContext?.onLinkAttachment} disabled={blocked} /></>}
                {editing && <div className="flex items-center gap-3 rounded-xl border border-border/60 p-4"><Label htmlFor={phaseId} className="shrink-0 text-xs text-muted-foreground">Etapa do evento</Label><select id={phaseId} className={selectClass} value={draft.phase ?? "sem_etapa"} onChange={event => change("phase", event.target.value === "sem_etapa" ? null : event.target.value as EventTaskPhase)}>{TASK_PHASES.map(phase => <option key={phase.value} value={phase.value}>{phase.label}</option>)}</select></div>}
              </div>
              {task && <EventTaskInformation task={task} context={taskContext} />}
            </div>
          </fieldset>
        </div>
        <div className="shrink-0 border-t border-border/60 bg-card px-4 py-3 sm:px-6">
          {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <DialogFooter className="grid grid-cols-1 items-center gap-2 min-[380px]:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 items-center gap-2">{editing ? <Button type="button" variant="outline" disabled={blocked} className="rounded-lg shadow-none" onClick={() => { if (task) { setDraft(originalDraft()); setEditing(false); setError(""); } else onClose(); }}>Cancelar</Button> : <><Button type="button" variant="outline" disabled={blocked} className="rounded-lg shadow-none" onClick={edit}><Pencil className="size-4" />Editar tarefa</Button>{onDuplicate && <Button type="button" variant="outline" disabled={blocked} className="rounded-lg shadow-none" onClick={() => void duplicate()}><Copy className="size-4" /><span className="hidden sm:inline">Duplicar</span><span className="sr-only sm:hidden">Duplicar tarefa</span></Button>}{onRequestDelete && <Button type="button" variant="ghost" disabled={blocked} className="rounded-lg text-destructive hover:text-destructive" onClick={onRequestDelete}><Trash2 className="size-4" /><span className="hidden sm:inline">Excluir</span><span className="sr-only sm:hidden">Excluir tarefa</span></Button>}</>}</div>
            {editing ? <Button type="submit" className="rounded-lg" disabled={blocked || !draft.title.trim()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{task ? "Salvar alterações" : "Criar tarefa"}</Button> : <Button type="button" className={cn("rounded-lg shadow-none", done && "border-emerald-500/10 bg-emerald-500/10 text-emerald-700 hover:border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-800")} disabled={blocked} onClick={() => void toggleComplete()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{done ? "Reabrir tarefa" : "Concluir tarefa"}</Button>}
          </DialogFooter>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
