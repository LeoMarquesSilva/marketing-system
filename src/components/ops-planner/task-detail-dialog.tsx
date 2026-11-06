"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Loader2, PencilLine, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canArchiveTask, canManageSpace, diffDays, type OpsAccess } from "@/lib/ops-planner/domain";
import {
  OPS_STATUS_LABEL,
  OPS_TASK_STATUSES,
  OPS_TIPO_LABEL,
  type OpsPerson,
  type OpsPlannerContext,
  type OpsTask,
  type OpsTaskDetail,
  type OpsTaskStatus,
} from "@/lib/ops-planner/types";
import type { User } from "@/lib/users";
import { errorMessage, opsApi } from "./ops-client";
import { AvatarStack, DueLabel, formatDate, PriorityLabel, SpaceChip, StatusDot } from "./ops-ui";
import {
  ActivitySection,
  AttachmentsSection,
  ChecklistSection,
  CommentsSection,
  Section,
  SubtasksSection,
} from "./task-detail-sections";
import { draftFromTask, draftProblem, TaskForm, updatePayload, type TaskDraft } from "./task-form";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-[#315f73]">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function TaskDetailDialog({
  taskId,
  context,
  people,
  assignable,
  onClose,
  onChanged,
  onArchived,
}: {
  taskId: string;
  context: OpsPlannerContext;
  people: Map<string, OpsPerson>;
  assignable: User[];
  onClose: () => void;
  /** Tarefa salva (inclusive subtarefas): a tela atualiza a própria lista. */
  onChanged: (task: OpsTask) => void;
  onArchived: (taskId: string) => void;
}) {
  // Abrir uma subtarefa troca o conteúdo do mesmo modal; "Voltar" desempilha.
  const [stack, setStack] = useState<string[]>([taskId]);
  const currentId = stack[stack.length - 1];
  const [detail, setDetail] = useState<OpsTaskDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [waitingOn, setWaitingOn] = useState<string | null>(null);

  const access: OpsAccess = { userId: context.me.id, isAdmin: context.is_admin, memberships: context.memberships };
  const spaces = new Map(context.spaces.map((space) => [space.id, space]));
  const lists = new Map(context.lists.map((list) => [list.id, list]));
  const lookups = {
    people,
    listName: (id: string | null) => (id ? lists.get(id)?.name ?? "removida" : "sem lista"),
    spaceName: (id: string | null) => (id ? spaces.get(id)?.name ?? "outro espaço" : ""),
  };

  const load = useCallback(async (id: string) => {
    setDetail(null);
    setLoadError(null);
    try {
      setDetail(await opsApi.get<OpsTaskDetail>(`/tasks/${id}`));
    } catch (cause) {
      setLoadError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    setMode("view");
    setConfirmArchive(false);
    setWaitingOn(null);
    setError(null);
    void load(currentId);
  }, [currentId, load]);

  const task = detail?.task;

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    if (!task) return false;
    setSaving(true);
    setError(null);
    try {
      const { task: saved } = await opsApi.patch<{ task: OpsTask }>(`/tasks/${task.id}`, body);
      setDetail((current) => (current ? { ...current, task: saved } : current));
      onChanged(saved);
      // Histórico novo vem do servidor.
      void opsApi.get<OpsTaskDetail>(`/tasks/${task.id}`).then((fresh) => setDetail(fresh)).catch(() => {});
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function changeStatus(status: OpsTaskStatus) {
    if (!task || status === task.status) return;
    if (status === "aguardando") {
      setWaitingOn(task.waiting_on ?? "");
      return;
    }
    void patch({ status });
  }

  async function saveEdit() {
    if (!task || !draft) return;
    const problem = draftProblem(draft);
    if (problem) return setError(problem);
    const body = updatePayload(draft, task);
    if (Object.keys(body).length === 0) return setMode("view");
    if (await patch(body)) setMode("view");
  }

  async function archive() {
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      await opsApi.del(`/tasks/${task.id}`);
      onArchived(task.id);
      if (stack.length > 1) {
        setStack((items) => items.slice(0, -1));
      } else {
        onClose();
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setConfirmArchive(false);
    } finally {
      setSaving(false);
    }
  }

  const space = task ? spaces.get(task.space_id) : undefined;
  const list = task?.list_id ? lists.get(task.list_id) : undefined;
  const canManage = task ? canManageSpace(access, task.space_id) : false;
  const canArchive = task ? canArchiveTask(access, task) : false;
  const waitingDays = task?.waiting_since ? Math.max(0, diffDays(task.waiting_since, context.today)) : 0;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader className="gap-2 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {stack.length > 1 && (
              <button
                type="button"
                onClick={() => setStack((items) => items.slice(0, -1))}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#285f7a] hover:underline"
              >
                <ArrowLeft className="size-3.5" />
                Tarefa principal
              </button>
            )}
            <SpaceChip space={space} />
            {list && <span className="text-xs text-muted-foreground">· {list.name}</span>}
          </div>
          <DialogTitle className="text-lg leading-snug">{task?.title ?? "Carregando tarefa"}</DialogTitle>
          <DialogDescription className="sr-only">Detalhe da tarefa do Planner de Operações Legais</DialogDescription>
          {task && mode === "view" && (
            <div className="flex flex-wrap items-center gap-3">
              <Select value={task.status} disabled={saving} onValueChange={(value) => changeStatus(value as OpsTaskStatus)}>
                <SelectTrigger aria-label="Status" className="h-9 w-auto min-w-40">
                  <span className="flex items-center gap-2">
                    <StatusDot status={task.status} />
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {OPS_TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {OPS_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PriorityLabel priority={task.priority} />
              <DueLabel due={task.due_date} time={task.due_time} status={task.status} today={context.today} className="text-sm" />
              {detail?.routine && (
                <span className="inline-flex items-center gap-1 text-xs text-[#48466e]">
                  <Repeat className="size-3.5" aria-hidden />
                  Rotina: {detail.routine.title}
                </span>
              )}
            </div>
          )}
          {waitingOn !== null && (
            <form
              className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 p-2 ring-1 ring-inset ring-amber-200"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!waitingOn.trim()) return setError("Informe quem a tarefa está aguardando.");
                if (await patch({ status: "aguardando", waiting_on: waitingOn.trim() })) setWaitingOn(null);
              }}
            >
              <label htmlFor="ops-waiting-on" className="text-sm font-medium text-amber-900">
                Aguardando quem?
              </label>
              <Input
                id="ops-waiting-on"
                autoFocus
                value={waitingOn}
                maxLength={200}
                placeholder="Pessoa, área ou fornecedor"
                onChange={(event) => setWaitingOn(event.target.value)}
                className="h-9 min-w-0 flex-1 bg-white"
              />
              <Button type="submit" size="sm" disabled={saving}>
                Confirmar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setWaitingOn(null)}>
                Cancelar
              </Button>
            </form>
          )}
        </DialogHeader>

        <div key={`${currentId}-${mode}`} className="relative min-h-0 flex-1 overflow-y-auto">
          {!detail && !loadError && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando
            </div>
          )}
          {loadError && (
            <p role="alert" className="m-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
              {loadError}
            </p>
          )}
          {detail && task && mode === "edit" && draft && (
            <TaskForm draft={draft} onChange={setDraft} context={context} assignable={assignable} original={task} showStatus={false} lockSpace={Boolean(task.parent_task_id)} />
          )}
          {detail && task && mode === "view" && (
            <>
              <Section title="Detalhes">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Fact label="Responsáveis">
                    <span className="flex flex-wrap items-center gap-2">
                      <AvatarStack ids={task.assignee_ids} people={people} max={5} />
                      {task.assignee_ids.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {task.assignee_ids.map((id) => people.get(id)?.name.split(" ")[0] ?? "Pessoa").join(", ")}
                        </span>
                      )}
                    </span>
                  </Fact>
                  <Fact label="Prazo">
                    {task.due_date ? formatDate(task.due_date, context.today) : "Sem prazo"}
                    {task.due_time && ` às ${task.due_time.slice(0, 5)}`}
                    {task.reschedule_count > 0 && (
                      <span className="ml-2 text-xs text-amber-700">
                        {task.reschedule_count} reprogramaç{task.reschedule_count === 1 ? "ão" : "ões"}
                      </span>
                    )}
                  </Fact>
                  {task.status === "aguardando" && (
                    <Fact label="Aguardando">
                      {task.waiting_on}
                      {task.waiting_since && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          desde {formatDate(task.waiting_since, context.today)} ({waitingDays} dia{waitingDays === 1 ? "" : "s"})
                        </span>
                      )}
                    </Fact>
                  )}
                  <Fact label="Próximo passo">{task.next_step || <span className="text-muted-foreground">Não definido</span>}</Fact>
                  <Fact label="Tipo">{OPS_TIPO_LABEL[task.tipo]}</Fact>
                  {task.start_date && <Fact label="Início">{formatDate(task.start_date, context.today)}</Fact>}
                </dl>
                {task.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm text-foreground">{task.description}</p>}
              </Section>
              <ChecklistSection
                taskId={task.id}
                items={detail.checklist}
                onChange={(checklist) => setDetail((current) => (current ? { ...current, checklist } : current))}
              />
              {!task.parent_task_id && (
                <SubtasksSection
                  task={task}
                  subtasks={detail.subtasks}
                  meId={context.me.id}
                  today={context.today}
                  people={people}
                  onOpen={(id) => setStack((items) => [...items, id])}
                  onChange={(subtasks) => {
                    setDetail((current) => (current ? { ...current, subtasks } : current));
                    onChanged(task);
                  }}
                />
              )}
              <AttachmentsSection
                taskId={task.id}
                attachments={detail.attachments}
                meId={context.me.id}
                canManage={canManage}
                onChange={(attachments) => setDetail((current) => (current ? { ...current, attachments } : current))}
              />
              <CommentsSection
                taskId={task.id}
                comments={detail.comments}
                meId={context.me.id}
                canManage={canManage}
                people={people}
                onChange={(comments) => {
                  setDetail((current) => (current ? { ...current, comments } : current));
                  onChanged(task);
                }}
              />
              <ActivitySection activity={detail.activity} lookups={lookups} />
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="mx-6 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}

        {task && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">
            <div>
              {canArchive &&
                mode === "view" &&
                (confirmArchive ? (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="destructive" disabled={saving} onClick={() => void archive()}>
                      {saving && <Loader2 className="size-4 animate-spin" />}
                      Confirmar exclusão
                    </Button>
                    <Button type="button" variant="ghost" disabled={saving} onClick={() => setConfirmArchive(false)}>
                      Manter
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Excluir tarefa"
                    className="gap-2 px-3 text-red-700 hover:bg-red-50 hover:text-red-800"
                    disabled={saving}
                    onClick={() => setConfirmArchive(true)}
                  >
                    <Trash2 className="size-4" />
                    <span className="hidden sm:inline">Excluir</span>
                  </Button>
                ))}
            </div>
            {mode === "view" ? (
              <Button
                type="button"
                className="gap-2"
                disabled={confirmArchive}
                onClick={() => {
                  setDraft(draftFromTask(task));
                  setError(null);
                  setMode("edit");
                }}
              >
                <PencilLine className="size-4" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={saving} onClick={() => setMode("view")}>
                  Cancelar
                </Button>
                <Button type="button" disabled={saving} onClick={() => void saveEdit()}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Salvar alterações
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
