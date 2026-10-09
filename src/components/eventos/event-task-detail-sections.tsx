"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Clock3, ExternalLink, FileText, FolderOpen, Loader2, MessageSquare, Paperclip, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { EventPerson } from "./event-person";
import { EventTaskFollowUpResponsible } from "./event-task-followup-responsible";
import { TASK_PHASES, taskDateLabel } from "@/lib/event-task-list";
import { followUpResponsibleNames } from "@/lib/event-followup-responsibles";
import type { EventAttachment, EventBudgetItem, EventHistoryItem, EventTask, OrgEvent } from "@/lib/eventos";
import type { User } from "@/lib/users";

export type EventTaskContext = {
  isBusy?: boolean;
  event?: Pick<OrgEvent, "id" | "name" | "eventDate" | "endDate" | "location">;
  history?: EventHistoryItem[];
  budgetItems?: EventBudgetItem[];
  onAddFollowUp?: (taskId: string, input: EventTaskFollowUpInput) => Promise<boolean>;
  onEditFollowUp?: (taskId: string, historyId: string, input: EventTaskFollowUpInput) => Promise<boolean>;
  onDeleteFollowUp?: (taskId: string, historyId: string) => Promise<boolean>;
  onToggleFollowUp?: (taskId: string, historyId: string, status: "planejado" | "realizado") => Promise<boolean>;
  onLinkAttachment?: (taskId: string, attachmentId: string) => Promise<boolean>;
};

export type EventTaskFollowUpInput = {
  text: string;
  date: string;
  time: string | null;
  responsibleNames: string[];
  status: "planejado" | "realizado";
};

export function taskTimestamp(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(date) : "Não registrado";
}

export function EventTaskFollowUps({ task, history = [], users, onAdd, onEdit, onDelete, onToggle, disabled }: {
  task: EventTask; history?: EventHistoryItem[]; users: User[];
  onAdd?: EventTaskContext["onAddFollowUp"];
  onEdit?: EventTaskContext["onEditFollowUp"];
  onDelete?: EventTaskContext["onDeleteFollowUp"];
  onToggle?: EventTaskContext["onToggleFollowUp"];
  disabled: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const [time, setTime] = useState("");
  const [responsibleNames, setResponsibleNames] = useState<string[]>(task.externalResponsibleName ? [task.externalResponsibleName] : []);
  const [status, setStatus] = useState<"planejado" | "realizado">("planejado");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<EventTaskFollowUpInput>({ text: "", date: "", time: null, responsibleNames: [], status: "planejado" });
  const fieldId = useId();
  const externalNames = [task.externalResponsibleName, ...history.flatMap(item => item.eventId === task.eventId && item.payload?.taskId === task.id ? followUpResponsibleNames(item.payload) : [])].filter((name): name is string => Boolean(name));
  const notes = history.filter(item => item.eventId === task.eventId && item.payload?.taskId === task.id && (typeof item.payload.followUpText === "string" || typeof item.payload.observation === "string")).sort((a, b) => {
    const aPlanned = a.payload?.followUpStatus === "planejado";
    const bPlanned = b.payload?.followUpStatus === "planejado";
    if (aPlanned !== bPlanned) return aPlanned ? -1 : 1;
    return String(a.payload?.followUpDate ?? a.createdAt).localeCompare(String(b.payload?.followUpDate ?? b.createdAt)) * (aPlanned ? 1 : -1);
  });
  async function add() {
    if (!onAdd || !text.trim() || !date || saving || disabled) return;
    setSaving(true); setError("");
    try {
      if (await onAdd(task.id, { text: text.trim(), date, time: time || null, responsibleNames, status })) { setAdding(false); setText(""); setTime(""); }
      else setError("Não foi possível salvar o follow-up. Seus dados foram mantidos.");
    } catch { setError("Não foi possível salvar o follow-up. Seus dados foram mantidos."); }
    finally { setSaving(false); }
  }
  async function toggle(note: EventHistoryItem) {
    if (!onToggle || saving || disabled) return;
    setSaving(true); setError("");
    try {
      if (!await onToggle(task.id, note.id, note.payload?.followUpStatus === "realizado" ? "planejado" : "realizado")) setError("Não foi possível atualizar o follow-up.");
    } catch { setError("Não foi possível atualizar o follow-up."); }
    finally { setSaving(false); }
  }
  function startEdit(note: EventHistoryItem) {
    setAdding(false); setDeletingId(null); setError(""); setEditingId(note.id);
    setEditValue({
      text: String(note.payload?.followUpText ?? note.payload?.observation ?? ""),
      date: typeof note.payload?.followUpDate === "string" ? note.payload.followUpDate : "",
      time: typeof note.payload?.followUpTime === "string" ? note.payload.followUpTime : null,
      responsibleNames: followUpResponsibleNames(note.payload),
      status: note.payload?.followUpStatus === "realizado" || typeof note.payload?.followUpText !== "string" ? "realizado" : "planejado",
    });
  }
  async function saveEdit() {
    if (!onEdit || !editingId || !editValue.text.trim() || saving || disabled) return;
    setSaving(true); setError("");
    try {
      if (await onEdit(task.id, editingId, editValue)) setEditingId(null);
      else setError("Não foi possível editar o follow-up. Seus dados foram mantidos.");
    } catch { setError("Não foi possível editar o follow-up. Seus dados foram mantidos."); }
    finally { setSaving(false); }
  }
  async function remove(historyId: string) {
    if (!onDelete || saving || disabled) return;
    setSaving(true); setError("");
    try {
      if (await onDelete(task.id, historyId)) setDeletingId(null);
      else setError("Não foi possível excluir o follow-up. Tente novamente.");
    } catch { setError("Não foi possível excluir o follow-up. Tente novamente."); }
    finally { setSaving(false); }
  }
  return <section className="rounded-xl border border-border/60 bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4 text-primary" />Follow-ups <span className="text-xs font-normal text-muted-foreground">{notes.length}</span></h3><p className="mt-1 text-xs text-muted-foreground">Contatos, retornos e próximos passos com data.</p></div>{onAdd && <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs shadow-none" disabled={saving || disabled} onClick={() => { setEditingId(null); setDeletingId(null); setError(""); setAdding(value => !value); }}><Plus className="size-3.5" />Novo follow-up</Button>}</div>
    {adding && <div className="mt-4 space-y-3 rounded-lg bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3"><label className="col-span-2 min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">Data<DatePickerField value={date} onChange={setDate} disabled={saving || disabled} /></label><label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">Horário<Input type="time" value={time} onChange={event => setTime(event.target.value)} disabled={saving || disabled} className="min-w-0 bg-card" /></label><label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">Situação<select value={status} onChange={event => setStatus(event.target.value as "planejado" | "realizado")} disabled={saving || disabled} className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground"><option value="planejado">Planejado</option><option value="realizado">Realizado</option></select></label></div>
      <div className="min-w-0 space-y-1.5"><p className="text-xs font-medium text-muted-foreground">Responsáveis</p><EventTaskFollowUpResponsible users={users} externalNames={externalNames} value={responsibleNames} onChange={setResponsibleNames} disabled={saving || disabled} /></div>
      <label htmlFor={fieldId} className="block text-xs font-medium text-muted-foreground">O que foi feito ou precisa acontecer?</label>
      <Textarea id={fieldId} rows={3} maxLength={5000} disabled={saving || disabled} value={text} onChange={event => setText(event.target.value)} placeholder="Ex.: Confirmar retorno sobre a proposta e registrar a decisão" className="bg-card" />
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => { setAdding(false); setError(""); }}>Cancelar</Button><Button type="button" size="sm" disabled={saving || disabled || !text.trim() || !date} onClick={() => void add()}>{saving && <Loader2 className="size-3.5 animate-spin" />}Salvar follow-up</Button></div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>}
    {!adding && error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <ol className="mt-3 space-y-2">{notes.map(note => {
      const author = users.find(user => user.id === note.actorUserId);
      const followUpDate = typeof note.payload?.followUpDate === "string" ? note.payload.followUpDate : null;
      const followUpTime = typeof note.payload?.followUpTime === "string" ? note.payload.followUpTime : null;
      const responsibles = followUpResponsibleNames(note.payload);
      const isStructured = typeof note.payload?.followUpText === "string";
      const realized = note.payload?.followUpStatus === "realizado";
      return <li key={note.id} className="flex min-w-0 items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
        {isStructured && onToggle ? <button type="button" disabled={saving || disabled} onClick={() => void toggle(note)} aria-label={`${realized ? "Reabrir" : "Marcar como realizado"} follow-up de ${followUpDate?.split("-").reverse().join("/") ?? "data indefinida"}`} className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors ${realized ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-card text-transparent hover:border-primary"}`}><Check className="size-4" /></button> : <Clock3 className="mt-1 size-4 shrink-0 text-primary" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {followUpDate ? <time dateTime={followUpDate} className="font-semibold tabular-nums text-foreground">{followUpDate.split("-").reverse().join("/")}{followUpTime && ` às ${followUpTime}`}</time> : <span className="font-semibold text-foreground">{isStructured ? "Data do contato não informada" : `Registrado em ${taskTimestamp(note.createdAt)}`}</span>}
            <span className={`rounded-full px-2 py-0.5 font-medium ${realized ? "bg-emerald-500/10 text-emerald-700" : isStructured ? "bg-amber-500/10 text-amber-700" : "bg-muted text-muted-foreground"}`}>{realized ? "Realizado" : isStructured ? "Planejado" : "Registro anterior"}</span>
            {(onEdit || onDelete) && <div className="ml-auto flex items-center gap-1">
              {onEdit && <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Editar follow-up de ${followUpDate?.split("-").reverse().join("/") ?? "data indefinida"}`} disabled={saving || disabled} onClick={() => startEdit(note)}><Pencil className="size-3.5" /></Button>}
              {onDelete && <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" aria-label={`Excluir follow-up de ${followUpDate?.split("-").reverse().join("/") ?? "data indefinida"}`} disabled={saving || disabled} onClick={() => { setEditingId(null); setAdding(false); setError(""); setDeletingId(note.id); }}><Trash2 className="size-3.5" /></Button>}
            </div>}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-foreground [overflow-wrap:anywhere]">{String(note.payload?.followUpText ?? note.payload?.observation)}</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-2 text-xs text-muted-foreground">{responsibles.length ? responsibles.map(name => <span key={name} className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-card py-0.5 pl-0.5 pr-2"><EventPerson name={name} avatar={users.find(user => user.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0)?.avatar_url} compact className="shrink-0" /><span className="min-w-0 break-words font-medium text-foreground">{name}</span></span>) : <span>Sem responsável</span>}<span className="ml-1 break-words">Registrado por {author?.name ?? note.actorUserName ?? "Equipe do evento"}</span></div>
          {editingId === note.id && <div className="mt-3 space-y-3 rounded-lg border border-primary/20 bg-card p-3">
            <p className="text-sm font-semibold">Editar follow-up</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">Data<DatePickerField value={editValue.date} onChange={value => setEditValue(current => ({ ...current, date: value }))} disabled={saving || disabled} /></label>
              <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">Horário<Input type="time" value={editValue.time ?? ""} onChange={event => setEditValue(current => ({ ...current, time: event.target.value || null }))} disabled={saving || disabled} className="min-w-0 bg-card" /></label>
              <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">Situação<select value={editValue.status} onChange={event => setEditValue(current => ({ ...current, status: event.target.value as "planejado" | "realizado" }))} disabled={saving || disabled} className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground"><option value="planejado">Planejado</option><option value="realizado">Realizado</option></select></label>
            </div>
            <div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">Responsáveis</p><EventTaskFollowUpResponsible users={users} externalNames={externalNames} value={editValue.responsibleNames} onChange={value => setEditValue(current => ({ ...current, responsibleNames: value }))} disabled={saving || disabled} /></div>
            <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">Descrição do follow-up<Textarea aria-label="Descrição do follow-up" rows={3} maxLength={5000} value={editValue.text} onChange={event => setEditValue(current => ({ ...current, text: event.target.value }))} disabled={saving || disabled} className="bg-card" /></label>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => { setEditingId(null); setError(""); }}>Cancelar</Button><Button type="button" size="sm" disabled={saving || disabled || !editValue.text.trim()} onClick={() => void saveEdit()}>{saving && <Loader2 className="size-3.5 animate-spin" />}Salvar alterações</Button></div>
          </div>}
          {deletingId === note.id && <div role="alertdialog" aria-label="Confirmar exclusão do follow-up" className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3"><p className="text-sm font-medium">Excluir este follow-up?</p><p className="mt-1 text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p><div className="mt-3 flex justify-end gap-2"><Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setDeletingId(null)}>Cancelar</Button><Button type="button" variant="destructive" size="sm" disabled={saving || disabled} onClick={() => void remove(note.id)}>{saving && <Loader2 className="size-3.5 animate-spin" />}Excluir follow-up</Button></div></div>}
        </div>
      </li>;
    })}</ol>
    {!notes.length && !adding && <p className="mt-3 text-sm leading-6 text-muted-foreground">Nenhum follow-up registrado. Adicione o próximo contato ou uma atualização já realizada.</p>}
  </section>;
}

export function EventTaskFiles({ task, attachments, onLink, disabled }: { task: EventTask; attachments: EventAttachment[]; onLink?: EventTaskContext["onLinkAttachment"]; disabled: boolean }) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const files = attachments.filter(file => file.eventId === task.eventId && file.relatedId === task.id);
  const available = attachments.filter(file => file.eventId === task.eventId && !file.relatedId);
  async function link() {
    if (!onLink || !selected || saving || disabled) return;
    setSaving(true); setError("");
    try {
      if (await onLink(task.id, selected)) { setSelected(""); setAdding(false); }
      else setError("Não foi possível vincular o arquivo. Tente novamente.");
    } catch { setError("Não foi possível vincular o arquivo. Tente novamente."); }
    finally { setSaving(false); }
  }
  return <section className="rounded-xl border border-border/60 bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Paperclip className="size-4 text-primary" />Arquivos vinculados <span className="text-xs font-normal text-muted-foreground">{files.length}</span></h3>{onLink && <Button type="button" variant="outline" size="sm" disabled={saving || disabled} className="rounded-lg text-xs shadow-none" onClick={() => setAdding(value => !value)}><Plus className="size-3.5" />Vincular arquivo</Button>}</div>
    {adding && <div className="mt-3 space-y-3 rounded-lg bg-muted/30 p-3">
      {available.length ? <><select aria-label="Arquivo do evento para vincular" disabled={saving || disabled} value={selected} onChange={event => setSelected(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border bg-card px-3 text-sm"><option value="">Escolha um arquivo do evento</option>{available.map(file => <option key={file.id} value={file.id}>{file.title}</option>)}</select><div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setAdding(false)}>Cancelar vínculo</Button><Button type="button" size="sm" disabled={!selected || saving || disabled} onClick={() => void link()}>{saving && <Loader2 className="size-3.5 animate-spin" />}Vincular</Button></div></> : <p className="text-sm text-muted-foreground">Envie um arquivo na aba Arquivos do evento para vinculá-lo aqui.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{files.map(file => <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary"><FileText className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold" title={file.title}>{file.title}</p><p className="mt-1 text-xs text-muted-foreground">{taskTimestamp(file.createdAt).split(",")[0]}</p></div><ExternalLink className="size-3.5 shrink-0 text-muted-foreground" /></a>)}</div>
    {!files.length && <p className="mt-3 text-sm text-muted-foreground">Nenhum arquivo vinculado a esta tarefa.</p>}
    <Link href={`/eventos/${task.eventId}?tab=arquivos`} className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><FolderOpen className="size-3.5" />Abrir arquivos do evento</Link>
  </section>;
}

export function EventTaskInformation({ task, context }: { task: EventTask; context?: EventTaskContext }) {
  return <aside className="rounded-xl border border-border/60 bg-muted/25 p-4">
    <h3 className="border-b border-border/60 pb-3 text-sm font-semibold">Informações da tarefa</h3>
    <dl className="space-y-5 pt-4">
      <div className="flex gap-3"><CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" /><div><dt className="text-xs text-muted-foreground">Criada em</dt><dd className="mt-1 text-sm">{taskTimestamp(task.createdAt)}</dd></div></div>
      <div className="flex gap-3"><RefreshCw className="mt-0.5 size-4 shrink-0 text-primary" /><div><dt className="text-xs text-muted-foreground">Última atualização</dt><dd className="mt-1 text-sm">{taskTimestamp(task.updatedAt)}</dd></div></div>
      <div className="flex gap-3"><FolderOpen className="mt-0.5 size-4 shrink-0 text-primary" /><div><dt className="text-xs text-muted-foreground">Etapa</dt><dd className="mt-1 text-sm">{TASK_PHASES.find(phase => phase.value === (task.phase ?? "sem_etapa"))?.label}</dd></div></div>
      <div className="flex gap-3"><CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><dt className="text-xs text-muted-foreground">Evento vinculado</dt><dd className="mt-2"><Link href={`/eventos/${task.eventId}`} className="block text-sm font-medium leading-5 text-primary hover:underline">{context?.event?.name ?? "Abrir evento"}</Link>{context?.event && <><p className="mt-1 text-xs text-muted-foreground">{context.event.eventDate ? taskDateLabel(context.event.eventDate) : "Data a definir"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{context.event.location || "Local a definir"}</p></>}</dd></div></div>
    </dl>
  </aside>;
}
