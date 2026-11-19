"use client";

import type { ReactNode } from "react";
import { EventTaskAssignees } from "@/components/eventos/event-task-assignees";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  OPS_PRIORITIES,
  OPS_PRIORITY_LABEL,
  OPS_STATUS_LABEL,
  OPS_TASK_STATUSES,
  OPS_TIPO_LABEL,
  OPS_TIPOS,
  type OpsPlannerContext,
  type OpsPriority,
  type OpsTask,
  type OpsTaskStatus,
  type OpsTipo,
} from "@/lib/ops-planner/types";
import type { User } from "@/lib/users";

const NO_LIST = "__sem_lista";

export interface TaskDraft {
  space_id: string;
  list_id: string | null;
  title: string;
  description: string;
  status: OpsTaskStatus;
  priority: OpsPriority;
  tipo: OpsTipo;
  assignee_ids: string[];
  start_date: string;
  due_date: string;
  due_time: string;
  next_step: string;
  waiting_on: string;
  reschedule_reason: string;
}

export function emptyDraft(spaceId: string, options: { listId?: string | null; assigneeId?: string; parentDue?: string } = {}): TaskDraft {
  return {
    space_id: spaceId,
    list_id: options.listId ?? null,
    title: "",
    description: "",
    status: "a_fazer",
    priority: "media",
    tipo: "operacional",
    assignee_ids: options.assigneeId ? [options.assigneeId] : [],
    start_date: "",
    due_date: options.parentDue ?? "",
    due_time: "",
    next_step: "",
    waiting_on: "",
    reschedule_reason: "",
  };
}

export function draftFromTask(task: OpsTask): TaskDraft {
  return {
    space_id: task.space_id,
    list_id: task.list_id,
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    tipo: task.tipo,
    assignee_ids: task.assignee_ids,
    start_date: task.start_date ?? "",
    due_date: task.due_date ?? "",
    due_time: task.due_time?.slice(0, 5) ?? "",
    next_step: task.next_step ?? "",
    waiting_on: task.waiting_on ?? "",
    reschedule_reason: "",
  };
}

/** Problema que impede salvar (mostrado antes de chamar a API). */
export function draftProblem(draft: TaskDraft): string | null {
  if (!draft.title.trim()) return "Informe o título.";
  if (draft.status === "aguardando" && !draft.waiting_on.trim()) return "Informe quem a tarefa está aguardando.";
  return null;
}

export function createPayload(draft: TaskDraft, parentTaskId?: string | null): Record<string, unknown> {
  return {
    space_id: draft.space_id,
    list_id: draft.list_id,
    parent_task_id: parentTaskId ?? null,
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    status: draft.status,
    priority: draft.priority,
    tipo: draft.tipo,
    assignee_ids: draft.assignee_ids,
    start_date: draft.start_date || null,
    due_date: draft.due_date || null,
    due_time: draft.due_time || null,
    next_step: draft.next_step.trim() || null,
    waiting_on: draft.status === "aguardando" ? draft.waiting_on.trim() : null,
  };
}

/** Só o que mudou em relação à tarefa salva. */
export function updatePayload(draft: TaskDraft, task: OpsTask): Record<string, unknown> {
  const original = draftFromTask(task);
  const next = createPayload(draft);
  const before = createPayload(original);
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next)) {
    if (key === "parent_task_id" || key === "status" || key === "waiting_on") continue;
    if (JSON.stringify(next[key]) !== JSON.stringify(before[key])) patch[key] = next[key];
  }
  if (patch.due_date !== undefined && draft.reschedule_reason.trim()) patch.reschedule_reason = draft.reschedule_reason.trim();
  if (task.status === "aguardando" && draft.waiting_on.trim() !== (task.waiting_on ?? "")) patch.waiting_on = draft.waiting_on.trim();
  return patch;
}

function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-[#315f73]">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function TaskForm({
  draft,
  onChange,
  context,
  assignable,
  original,
  showStatus,
  lockSpace = false,
}: {
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
  context: OpsPlannerContext;
  assignable: User[];
  /** Tarefa salva (modo edição): mostra o motivo da reprogramação quando o prazo muda. */
  original?: OpsTask;
  showStatus: boolean;
  lockSpace?: boolean;
}) {
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => onChange({ ...draft, [key]: value });
  const lists = context.lists.filter((list) => list.space_id === draft.space_id);
  const rescheduling = Boolean(original?.due_date) && draft.due_date !== (original?.due_date ?? "");

  return (
    <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
      <Field label="Título" htmlFor="ops-task-title" className="sm:col-span-2">
        <Input
          id="ops-task-title"
          autoFocus={!original}
          value={draft.title}
          maxLength={300}
          placeholder="Verbo + objeto (ex.: Conferir a folha de outubro)"
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>

      <Field label="Espaço">
        <Select
          value={draft.space_id}
          disabled={lockSpace}
          onValueChange={(value) => onChange({ ...draft, space_id: value, list_id: null })}
        >
          <SelectTrigger aria-label="Espaço" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {context.spaces.map((space) => (
              <SelectItem key={space.id} value={space.id}>
                {space.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Lista">
        <Select value={draft.list_id ?? NO_LIST} onValueChange={(value) => set("list_id", value === NO_LIST ? null : value)}>
          <SelectTrigger aria-label="Lista" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_LIST}>Sem lista</SelectItem>
            {lists.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {showStatus && (
        <Field label="Status">
          <Select value={draft.status} onValueChange={(value) => set("status", value as OpsTaskStatus)}>
            <SelectTrigger aria-label="Status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS_TASK_STATUSES.filter((status) => status !== "cancelada").map((status) => (
                <SelectItem key={status} value={status}>
                  {OPS_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label="Prioridade">
        <Select value={draft.priority} onValueChange={(value) => set("priority", value as OpsPriority)}>
          <SelectTrigger aria-label="Prioridade" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPS_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {OPS_PRIORITY_LABEL[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Tipo">
        <Select value={draft.tipo} onValueChange={(value) => set("tipo", value as OpsTipo)}>
          <SelectTrigger aria-label="Tipo" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPS_TIPOS.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {OPS_TIPO_LABEL[tipo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {draft.status === "aguardando" && (
        <Field label="Aguardando quem?" htmlFor="ops-task-waiting" className={showStatus ? "" : "sm:col-span-2"}>
          <Input
            id="ops-task-waiting"
            value={draft.waiting_on}
            maxLength={200}
            placeholder="Pessoa, área ou fornecedor"
            onChange={(event) => set("waiting_on", event.target.value)}
          />
        </Field>
      )}

      <Field label="Responsáveis" className="sm:col-span-2">
        <EventTaskAssignees users={assignable} value={draft.assignee_ids} onChange={(ids) => set("assignee_ids", ids)} />
      </Field>

      <Field label="Prazo">
        <DatePickerField value={draft.due_date} onChange={(value) => set("due_date", value)} />
      </Field>

      <Field label="Horário (opcional)" htmlFor="ops-task-time">
        <Input id="ops-task-time" type="time" value={draft.due_time} onChange={(event) => set("due_time", event.target.value)} />
      </Field>

      {rescheduling && (
        <Field label={`Motivo da reprogramação (${(original?.reschedule_count ?? 0) + 1}ª)`} htmlFor="ops-task-reason" className="sm:col-span-2">
          <Input
            id="ops-task-reason"
            value={draft.reschedule_reason}
            maxLength={500}
            placeholder="Por que o prazo mudou? Fica no histórico."
            onChange={(event) => set("reschedule_reason", event.target.value)}
          />
        </Field>
      )}

      <Field label="Início (opcional)">
        <DatePickerField value={draft.start_date} onChange={(value) => set("start_date", value)} />
      </Field>

      <Field label="Próximo passo" htmlFor="ops-task-next">
        <Input
          id="ops-task-next"
          value={draft.next_step}
          maxLength={1000}
          placeholder="O que precisa acontecer agora"
          onChange={(event) => set("next_step", event.target.value)}
        />
      </Field>

      <Field label="Descrição" htmlFor="ops-task-description" className="sm:col-span-2">
        <Textarea
          id="ops-task-description"
          rows={4}
          value={draft.description}
          maxLength={10000}
          placeholder="Contexto, links e combinados"
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>
    </div>
  );
}
