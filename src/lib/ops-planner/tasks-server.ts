import "server-only";

import { z } from "zod";
import { newlyAssigned } from "./alerts";
import {
  canArchiveTask,
  canEditTask,
  canManageSpace,
  canViewSpace,
  isReschedule,
  todayInSaoPaulo,
} from "./domain";
import { insertNotifications } from "./notifications-server";
import { dbFail, getOpsDb, OpsPlannerHttpError, plannerMemberIds, type OpsActor } from "./server";
import {
  OPS_FILE_MAX_BYTES,
  OPS_FILES_BUCKET,
  OPS_PRIORITIES,
  OPS_STATUS_LABEL,
  OPS_TASK_STATUSES,
  OPS_TIPOS,
  type OpsActivity,
  type OpsAttachment,
  type OpsChecklistItem,
  type OpsComment,
  type OpsSpaceCounters,
  type OpsTask,
  type OpsTaskDetail,
  type OpsTaskStatus,
  type OpsTaskSummary,
} from "./types";

export const TASK_SELECT =
  "id, space_id, list_id, parent_task_id, routine_id, occurrence_date, title, description, status, priority, tipo, assignee_ids, requested_by, start_date, due_date, due_time, next_step, waiting_on, waiting_since, reschedule_count, sort_order, completed_at, completed_by, created_by, created_at, updated_at";

const OPEN_STATUSES: OpsTaskStatus[] = ["a_fazer", "em_andamento", "aguardando"];
/** Concluídas e canceladas ficam no quadro por este tempo. */
const DONE_WINDOW_DAYS = 45;

/* ------------------------------------------------------------ validação */

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "Identificador inválido.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horário inválido.");
const optionalText = (max: number) =>
  z
    .string()
    .max(max, "Texto muito longo.")
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value?.trim() ? value.trim() : null));

const taskFields = {
  list_id: id.nullable().optional(),
  title: z.string().trim().min(1, "Informe o título.").max(300, "Título muito longo."),
  description: optionalText(10000),
  status: z.enum(OPS_TASK_STATUSES).optional(),
  priority: z.enum(OPS_PRIORITIES).optional(),
  tipo: z.enum(OPS_TIPOS).optional(),
  assignee_ids: z.array(id).max(20, "No máximo 20 responsáveis.").optional(),
  requested_by: id.nullable().optional(),
  start_date: isoDate.nullable().optional(),
  due_date: isoDate.nullable().optional(),
  due_time: time.nullable().optional(),
  next_step: optionalText(1000),
  waiting_on: optionalText(200),
};

const createSchema = z.object({
  ...taskFields,
  space_id: id,
  parent_task_id: id.nullable().optional(),
  checklist: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
});

const updateSchema = z
  .object({
    ...taskFields,
    title: taskFields.title.optional(),
    space_id: id.optional(),
    sort_order: z.number().finite().optional(),
    reschedule_reason: z.string().trim().max(500).optional(),
  })
  .strict();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new OpsPlannerHttpError(result.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID");
  }
  return result.data;
}

/* ------------------------------------------------------------ leitura */

async function loadTask(taskId: string): Promise<OpsTask> {
  const { data, error } = await getOpsDb()
    .from("ops_tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) dbFail("carregar a tarefa", error);
  if (!data) throw new OpsPlannerHttpError("Tarefa não encontrada.", 404, "NOT_FOUND");
  return data as OpsTask;
}

async function loadEditableTask(actor: OpsActor, taskId: string): Promise<OpsTask> {
  const task = await loadTask(taskId);
  if (!canEditTask(actor, task)) throw new OpsPlannerHttpError("Você não tem acesso a esta tarefa.", 403, "FORBIDDEN");
  return task;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Subtarefas, checklist e comentários de cada tarefa (contadores do cartão). */
export async function attachCounters(tasks: OpsTask[]): Promise<OpsTaskSummary[]> {
  const db = getOpsDb();
  const counters = new Map<string, Omit<OpsTaskSummary, keyof OpsTask>>();
  for (const task of tasks) {
    counters.set(task.id, { subtask_count: 0, subtask_done_count: 0, checklist_count: 0, checklist_done_count: 0, comment_count: 0 });
  }
  for (const ids of chunk(tasks.map((task) => task.id), 200)) {
    const [subtasks, checklist, comments] = await Promise.all([
      db.from("ops_tasks").select("parent_task_id, status").in("parent_task_id", ids).is("archived_at", null),
      db.from("ops_task_checklist_items").select("task_id, done_at").in("task_id", ids),
      db.from("ops_task_comments").select("task_id").in("task_id", ids),
    ]);
    if (subtasks.error) dbFail("contar as subtarefas", subtasks.error);
    if (checklist.error) dbFail("contar o checklist", checklist.error);
    if (comments.error) dbFail("contar os comentários", comments.error);
    for (const row of subtasks.data ?? []) {
      const counter = counters.get(row.parent_task_id as string);
      if (!counter) continue;
      counter.subtask_count += 1;
      if (row.status === "concluida") counter.subtask_done_count += 1;
    }
    for (const row of checklist.data ?? []) {
      const counter = counters.get(row.task_id as string);
      if (!counter) continue;
      counter.checklist_count += 1;
      if (row.done_at) counter.checklist_done_count += 1;
    }
    for (const row of comments.data ?? []) {
      const counter = counters.get(row.task_id as string);
      if (counter) counter.comment_count += 1;
    }
  }
  return tasks.map((task) => ({ ...task, ...(counters.get(task.id) as Omit<OpsTaskSummary, keyof OpsTask>) }));
}

export interface TaskQuery {
  spaceId?: string;
  mine?: boolean;
  includeDone?: boolean;
}

export async function listTasks(actor: OpsActor, query: TaskQuery): Promise<OpsTaskSummary[]> {
  if (!query.spaceId && !query.mine) throw new OpsPlannerHttpError("Informe o espaço.", 400, "INVALID");
  if (query.spaceId && !canViewSpace(actor, query.spaceId)) {
    throw new OpsPlannerHttpError("Você não participa deste espaço.", 403, "FORBIDDEN");
  }
  let request = getOpsDb().from("ops_tasks").select(TASK_SELECT).is("archived_at", null);
  if (query.spaceId) request = request.eq("space_id", query.spaceId).is("parent_task_id", null);
  if (query.mine) request = request.contains("assignee_ids", [actor.userId]);
  if (query.includeDone) {
    const since = new Date(Date.now() - DONE_WINDOW_DAYS * 86_400_000).toISOString();
    request = request.or(`status.in.(${OPEN_STATUSES.join(",")}),updated_at.gte.${since}`);
  } else {
    request = request.in("status", OPEN_STATUSES);
  }
  const { data, error } = await request.order("sort_order").order("created_at").limit(2000);
  if (error) dbFail("carregar as tarefas", error);
  return attachCounters((data ?? []) as OpsTask[]);
}

/** Abertas, atrasadas, de hoje e aguardando por espaço (tela Espaços). */
export async function listSpaceCounters(spaceIds: string[], today: string): Promise<Record<string, OpsSpaceCounters>> {
  const counters: Record<string, OpsSpaceCounters> = {};
  for (const spaceId of spaceIds) counters[spaceId] = { open: 0, overdue: 0, today: 0, waiting: 0 };
  if (spaceIds.length === 0) return counters;
  const { data, error } = await getOpsDb()
    .from("ops_tasks")
    .select("space_id, status, due_date")
    .in("space_id", spaceIds)
    .is("archived_at", null)
    .is("parent_task_id", null)
    .in("status", OPEN_STATUSES)
    .limit(10000);
  if (error) dbFail("contar as tarefas dos espaços", error);
  for (const row of data ?? []) {
    const counter = counters[row.space_id as string];
    if (!counter) continue;
    counter.open += 1;
    if (row.status === "aguardando") counter.waiting += 1;
    if (row.due_date && (row.due_date as string) < today) counter.overdue += 1;
    else if (row.due_date === today) counter.today += 1;
  }
  return counters;
}

export async function getTaskDetail(actor: OpsActor, taskId: string): Promise<OpsTaskDetail> {
  const task = await loadEditableTask(actor, taskId);
  const db = getOpsDb();
  const [subtasks, checklist, comments, activity, attachments, routine] = await Promise.all([
    db.from("ops_tasks").select(TASK_SELECT).eq("parent_task_id", taskId).is("archived_at", null).order("sort_order").order("created_at"),
    db.from("ops_task_checklist_items").select("id, task_id, label, sort_order, done_at, done_by").eq("task_id", taskId).order("sort_order").order("created_at"),
    db.from("ops_task_comments").select("id, task_id, user_id, body, created_at, edited_at").eq("task_id", taskId).order("created_at"),
    db.from("ops_task_activity").select("id, task_id, user_id, action, from_value, to_value, note, created_at").eq("task_id", taskId).order("created_at", { ascending: false }).limit(200),
    db.from("ops_task_attachments").select("id, task_id, kind, name, url, storage_path, content_type, size_bytes, created_by, created_at").eq("task_id", taskId).order("created_at"),
    task.routine_id
      ? db.from("ops_routines").select("id, title").eq("id", task.routine_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const result of [subtasks, checklist, comments, activity, attachments, routine]) {
    if (result.error) dbFail("carregar a tarefa", result.error);
  }
  return {
    task,
    subtasks: (subtasks.data ?? []) as OpsTask[],
    checklist: (checklist.data ?? []) as OpsChecklistItem[],
    comments: (comments.data ?? []) as OpsComment[],
    activity: (activity.data ?? []) as OpsActivity[],
    attachments: (attachments.data ?? []) as OpsAttachment[],
    routine: (routine.data as { id: string; title: string } | null) ?? null,
  };
}

/* ------------------------------------------------------------ escrita */

type ActivityRow = Omit<OpsActivity, "id" | "created_at">;

async function logActivity(rows: ActivityRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await getOpsDb().from("ops_task_activity").insert(rows);
  if (error) console.error("[ops-planner] histórico", error.message);
}

async function assertList(listId: string | null | undefined, spaceId: string): Promise<void> {
  if (!listId) return;
  const { data, error } = await getOpsDb().from("ops_lists").select("space_id").eq("id", listId).is("archived_at", null).maybeSingle();
  if (error) dbFail("validar a lista", error);
  if (!data || data.space_id !== spaceId) throw new OpsPlannerHttpError("A lista não é deste espaço.", 400, "INVALID_LIST");
}

async function assertAssignees(ids: string[] | undefined): Promise<void> {
  if (!ids || ids.length === 0) return;
  const members = await plannerMemberIds();
  if (ids.some((userId) => !members.has(userId))) {
    throw new OpsPlannerHttpError("Responsável precisa participar de algum espaço do Planner.", 400, "INVALID_ASSIGNEE");
  }
}

async function notifyAssigned(actor: OpsActor, task: OpsTask, recipients: string[]): Promise<void> {
  if (recipients.length === 0) return;
  await insertNotifications(
    recipients.map((recipient) => ({
      recipient_id: recipient,
      task_id: task.id,
      routine_id: task.routine_id,
      kind: "atribuida" as const,
      title: `${actor.name.split(" ")[0]} atribuiu a você: ${task.title}`,
      body: task.due_date ? `Vence em ${task.due_date.slice(8, 10)}/${task.due_date.slice(5, 7)}` : null,
      dedupe_key: null,
    }))
  ).catch((error) => console.error("[ops-planner] aviso de atribuição", error));
}

export async function createTask(actor: OpsActor, input: unknown): Promise<OpsTaskSummary> {
  const body = parse(createSchema, input);
  if (!canViewSpace(actor, body.space_id)) throw new OpsPlannerHttpError("Você não participa deste espaço.", 403, "FORBIDDEN");
  await assertList(body.list_id, body.space_id);
  await assertAssignees(body.assignee_ids);
  if (body.parent_task_id) {
    const parent = await loadTask(body.parent_task_id);
    if (parent.space_id !== body.space_id) throw new OpsPlannerHttpError("A tarefa principal é de outro espaço.", 400, "INVALID");
    if (parent.parent_task_id) throw new OpsPlannerHttpError("Subtarefa não pode ter subtarefas.", 400, "INVALID");
  }
  const status = body.status ?? "a_fazer";
  if (status === "aguardando" && !body.waiting_on) {
    throw new OpsPlannerHttpError("Informe quem a tarefa está aguardando.", 400, "WAITING_ON_REQUIRED");
  }
  const now = new Date().toISOString();
  const { data, error } = await getOpsDb()
    .from("ops_tasks")
    .insert({
      space_id: body.space_id,
      list_id: body.list_id ?? null,
      parent_task_id: body.parent_task_id ?? null,
      title: body.title,
      description: body.description ?? null,
      status,
      priority: body.priority ?? "media",
      tipo: body.tipo ?? "operacional",
      assignee_ids: [...new Set(body.assignee_ids ?? [])],
      requested_by: body.requested_by ?? null,
      start_date: body.start_date ?? null,
      due_date: body.due_date ?? null,
      due_time: body.due_time ?? null,
      next_step: body.next_step ?? null,
      waiting_on: status === "aguardando" ? body.waiting_on : null,
      waiting_since: status === "aguardando" ? todayInSaoPaulo() : null,
      completed_at: status === "concluida" ? now : null,
      completed_by: status === "concluida" ? actor.userId : null,
      // Tarefa nova vai para o fim da coluna.
      sort_order: Date.now() / 1000,
      created_by: actor.userId,
    })
    .select(TASK_SELECT)
    .single();
  if (error || !data) dbFail("criar a tarefa", error);
  const task = data as OpsTask;
  if (body.checklist?.length) {
    const { error: checklistError } = await getOpsDb()
      .from("ops_task_checklist_items")
      .insert(body.checklist.map((label, index) => ({ task_id: task.id, label, sort_order: index })));
    if (checklistError) console.error("[ops-planner] checklist inicial", checklistError.message);
  }
  await logActivity([{ task_id: task.id, user_id: actor.userId, action: "criada", from_value: null, to_value: null, note: null }]);
  await notifyAssigned(actor, task, newlyAssigned([], task.assignee_ids, actor.userId));
  const [summary] = await attachCounters([task]);
  return summary;
}

export async function updateTask(actor: OpsActor, taskId: string, input: unknown): Promise<OpsTaskSummary> {
  const body = parse(updateSchema, input);
  const current = await loadEditableTask(actor, taskId);
  const patch: Record<string, unknown> = {};
  const activity: ActivityRow[] = [];
  const log = (action: string, from: unknown, to: unknown, note: string | null = null) =>
    activity.push({
      task_id: taskId,
      user_id: actor.userId,
      action,
      from_value: from === null || from === undefined ? null : String(from),
      to_value: to === null || to === undefined ? null : String(to),
      note,
    });

  const spaceId = body.space_id ?? current.space_id;
  if (body.space_id && body.space_id !== current.space_id) {
    if (!canViewSpace(actor, body.space_id)) throw new OpsPlannerHttpError("Você não participa do espaço de destino.", 403, "FORBIDDEN");
    if (current.parent_task_id) throw new OpsPlannerHttpError("Mova a tarefa principal, não a subtarefa.", 400, "INVALID");
    patch.space_id = body.space_id;
    // A lista é do espaço antigo: sem lista nova, fica sem lista.
    if (body.list_id === undefined) patch.list_id = null;
    log("espaco", current.space_id, body.space_id);
  }
  if (body.list_id !== undefined && body.list_id !== current.list_id) {
    await assertList(body.list_id, spaceId);
    patch.list_id = body.list_id;
    log("lista", current.list_id, body.list_id);
  }
  if (body.title !== undefined && body.title !== current.title) {
    patch.title = body.title;
    log("titulo", current.title, body.title);
  }
  if (body.description !== undefined && body.description !== current.description) {
    patch.description = body.description;
    log("descricao", null, null);
  }
  if (body.priority !== undefined && body.priority !== current.priority) {
    patch.priority = body.priority;
    log("prioridade", current.priority, body.priority);
  }
  if (body.tipo !== undefined && body.tipo !== current.tipo) {
    patch.tipo = body.tipo;
    log("tipo", current.tipo, body.tipo);
  }
  if (body.next_step !== undefined && body.next_step !== current.next_step) {
    patch.next_step = body.next_step;
    log("proximo_passo", current.next_step, body.next_step);
  }
  if (body.requested_by !== undefined && body.requested_by !== current.requested_by) {
    patch.requested_by = body.requested_by;
    log("solicitante", current.requested_by, body.requested_by);
  }
  if (body.start_date !== undefined && body.start_date !== current.start_date) {
    patch.start_date = body.start_date;
    log("inicio", current.start_date, body.start_date);
  }
  if (body.due_time !== undefined && (body.due_time ?? null) !== (current.due_time?.slice(0, 5) ?? null)) {
    patch.due_time = body.due_time;
    log("horario", current.due_time?.slice(0, 5) ?? null, body.due_time);
  }
  if (body.due_date !== undefined && body.due_date !== current.due_date) {
    patch.due_date = body.due_date;
    if (isReschedule(current.due_date, body.due_date)) {
      patch.reschedule_count = current.reschedule_count + 1;
      log("reprogramada", current.due_date, body.due_date, body.reschedule_reason?.trim() || null);
    } else {
      log("prazo", current.due_date, body.due_date);
    }
  }
  if (body.assignee_ids !== undefined) {
    const next = [...new Set(body.assignee_ids)];
    const changed = next.length !== current.assignee_ids.length || next.some((userId) => !current.assignee_ids.includes(userId));
    if (changed) {
      await assertAssignees(next.filter((userId) => !current.assignee_ids.includes(userId)));
      patch.assignee_ids = next;
      log("responsaveis", current.assignee_ids.join(","), next.join(","));
    }
  }

  const nextStatus = body.status ?? current.status;
  if (body.status !== undefined && body.status !== current.status) {
    patch.status = body.status;
    log("status", OPS_STATUS_LABEL[current.status], OPS_STATUS_LABEL[body.status]);
    if (body.status === "concluida") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = actor.userId;
    } else if (current.status === "concluida") {
      patch.completed_at = null;
      patch.completed_by = null;
    }
  }
  if (nextStatus === "aguardando") {
    const waitingOn = body.waiting_on !== undefined ? body.waiting_on : current.waiting_on;
    if (!waitingOn) throw new OpsPlannerHttpError("Informe quem a tarefa está aguardando.", 400, "WAITING_ON_REQUIRED");
    if (current.status !== "aguardando") patch.waiting_since = todayInSaoPaulo();
    if (waitingOn !== current.waiting_on) {
      patch.waiting_on = waitingOn;
      log("aguardando", current.waiting_on, waitingOn);
    }
  } else if (current.status === "aguardando" && body.status !== undefined) {
    patch.waiting_on = null;
    patch.waiting_since = null;
  }
  if (body.sort_order !== undefined && body.sort_order !== current.sort_order) patch.sort_order = body.sort_order;

  if (Object.keys(patch).length === 0) {
    const [summary] = await attachCounters([current]);
    return summary;
  }
  const { data, error } = await getOpsDb().from("ops_tasks").update(patch).eq("id", taskId).select(TASK_SELECT).single();
  if (error || !data) dbFail("salvar a tarefa", error);
  const task = data as OpsTask;
  await logActivity(activity);
  if (patch.assignee_ids) await notifyAssigned(actor, task, newlyAssigned(current.assignee_ids, task.assignee_ids, actor.userId));
  const [summary] = await attachCounters([task]);
  return summary;
}

export async function archiveTask(actor: OpsActor, taskId: string): Promise<void> {
  const task = await loadTask(taskId);
  if (!canArchiveTask(actor, task)) {
    throw new OpsPlannerHttpError("Só quem criou a tarefa ou a liderança do espaço pode excluir.", 403, "FORBIDDEN");
  }
  const now = new Date().toISOString();
  const db = getOpsDb();
  const { error } = await db.from("ops_tasks").update({ archived_at: now }).or(`id.eq.${taskId},parent_task_id.eq.${taskId}`);
  if (error) dbFail("excluir a tarefa", error);
  await logActivity([{ task_id: taskId, user_id: actor.userId, action: "excluida", from_value: null, to_value: null, note: null }]);
}

/* ------------------------------------------------------------ checklist */

const labelSchema = z.string().trim().min(1, "Escreva o item.").max(300, "Item muito longo.");

export async function addChecklistItem(actor: OpsActor, taskId: string, input: unknown): Promise<OpsChecklistItem> {
  await loadEditableTask(actor, taskId);
  const label = parse(z.object({ label: labelSchema }), input).label;
  const db = getOpsDb();
  const { data: last } = await db
    .from("ops_task_checklist_items")
    .select("sort_order")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("ops_task_checklist_items")
    .insert({ task_id: taskId, label, sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 })
    .select("id, task_id, label, sort_order, done_at, done_by")
    .single();
  if (error || !data) dbFail("adicionar o item", error);
  return data as OpsChecklistItem;
}

async function loadChecklistItem(actor: OpsActor, itemId: string): Promise<OpsChecklistItem> {
  const { data, error } = await getOpsDb()
    .from("ops_task_checklist_items")
    .select("id, task_id, label, sort_order, done_at, done_by")
    .eq("id", itemId)
    .maybeSingle();
  if (error) dbFail("carregar o item", error);
  if (!data) throw new OpsPlannerHttpError("Item não encontrado.", 404, "NOT_FOUND");
  await loadEditableTask(actor, data.task_id as string);
  return data as OpsChecklistItem;
}

export async function updateChecklistItem(actor: OpsActor, itemId: string, input: unknown): Promise<OpsChecklistItem> {
  const item = await loadChecklistItem(actor, itemId);
  const body = parse(z.object({ label: labelSchema.optional(), done: z.boolean().optional() }).strict(), input);
  const patch: Record<string, unknown> = {};
  if (body.label !== undefined) patch.label = body.label;
  if (body.done !== undefined) {
    patch.done_at = body.done ? new Date().toISOString() : null;
    patch.done_by = body.done ? actor.userId : null;
  }
  if (Object.keys(patch).length === 0) return item;
  const { data, error } = await getOpsDb()
    .from("ops_task_checklist_items")
    .update(patch)
    .eq("id", itemId)
    .select("id, task_id, label, sort_order, done_at, done_by")
    .single();
  if (error || !data) dbFail("salvar o item", error);
  return data as OpsChecklistItem;
}

export async function deleteChecklistItem(actor: OpsActor, itemId: string): Promise<void> {
  await loadChecklistItem(actor, itemId);
  const { error } = await getOpsDb().from("ops_task_checklist_items").delete().eq("id", itemId);
  if (error) dbFail("excluir o item", error);
}

/* ------------------------------------------------------------ comentários */

export async function addComment(actor: OpsActor, taskId: string, input: unknown): Promise<OpsComment> {
  const task = await loadEditableTask(actor, taskId);
  const body = parse(z.object({ body: z.string().trim().min(1, "Escreva o comentário.").max(5000, "Comentário muito longo.") }), input).body;
  const { data, error } = await getOpsDb()
    .from("ops_task_comments")
    .insert({ task_id: taskId, user_id: actor.userId, body })
    .select("id, task_id, user_id, body, created_at, edited_at")
    .single();
  if (error || !data) dbFail("salvar o comentário", error);
  const recipients = task.assignee_ids.filter((userId) => userId !== actor.userId);
  if (recipients.length > 0) {
    await insertNotifications(
      recipients.map((recipient) => ({
        recipient_id: recipient,
        task_id: task.id,
        routine_id: task.routine_id,
        kind: "comentario" as const,
        title: `${actor.name.split(" ")[0]} comentou: ${task.title}`,
        body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
        dedupe_key: null,
      }))
    ).catch((cause) => console.error("[ops-planner] aviso de comentário", cause));
  }
  return data as OpsComment;
}

export async function deleteComment(actor: OpsActor, commentId: string): Promise<void> {
  const db = getOpsDb();
  const { data, error } = await db.from("ops_task_comments").select("id, task_id, user_id").eq("id", commentId).maybeSingle();
  if (error) dbFail("carregar o comentário", error);
  if (!data) throw new OpsPlannerHttpError("Comentário não encontrado.", 404, "NOT_FOUND");
  const task = await loadEditableTask(actor, data.task_id as string);
  if (data.user_id !== actor.userId && !canManageSpace(actor, task.space_id)) {
    throw new OpsPlannerHttpError("Só quem escreveu pode apagar o comentário.", 403, "FORBIDDEN");
  }
  const { error: deleteError } = await db.from("ops_task_comments").delete().eq("id", commentId);
  if (deleteError) dbFail("apagar o comentário", deleteError);
}

/* ------------------------------------------------------------ anexos */

function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const clean =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "arquivo";
  return ext ? `${clean}.${ext}` : clean;
}

const uploadSchema = z.object({
  file_name: z.string().trim().min(1).max(200),
  content_type: z.string().trim().max(150).optional(),
  size_bytes: z.number().int().positive().max(OPS_FILE_MAX_BYTES, "O arquivo passa de 50 MB."),
});

/** URL assinada para o navegador subir o arquivo direto no bucket privado. */
export async function createAttachmentUpload(
  actor: OpsActor,
  taskId: string,
  input: unknown
): Promise<{ path: string; token: string }> {
  await loadEditableTask(actor, taskId);
  const body = parse(uploadSchema, input);
  const path = `tasks/${taskId}/${Date.now()}-${sanitizeFileName(body.file_name)}`;
  const { data, error } = await getOpsDb().storage.from(OPS_FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) dbFail("preparar o envio do arquivo", error);
  return { path: data.path, token: data.token };
}

const attachmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("link"),
    name: z.string().trim().max(200).optional(),
    url: z.string().trim().url("Link inválido.").max(2000).refine((value) => /^https?:\/\//i.test(value), "Use um link http(s)."),
  }),
  z.object({
    kind: z.literal("file"),
    name: z.string().trim().min(1).max(200),
    storage_path: z.string().trim().min(1).max(500),
    content_type: z.string().trim().max(150).nullable().optional(),
    size_bytes: z.number().int().nonnegative().nullable().optional(),
  }),
]);

const ATTACHMENT_SELECT = "id, task_id, kind, name, url, storage_path, content_type, size_bytes, created_by, created_at";

export async function addAttachment(actor: OpsActor, taskId: string, input: unknown): Promise<OpsAttachment> {
  await loadEditableTask(actor, taskId);
  const body = parse(attachmentSchema, input);
  const row =
    body.kind === "link"
      ? { task_id: taskId, kind: "link", name: body.name?.trim() || new URL(body.url).hostname, url: body.url, created_by: actor.userId }
      : (() => {
          if (!body.storage_path.startsWith(`tasks/${taskId}/`)) {
            throw new OpsPlannerHttpError("Arquivo inválido para esta tarefa.", 400, "INVALID");
          }
          return {
            task_id: taskId,
            kind: "file",
            name: body.name,
            storage_path: body.storage_path,
            content_type: body.content_type ?? null,
            size_bytes: body.size_bytes ?? null,
            created_by: actor.userId,
          };
        })();
  const { data, error } = await getOpsDb().from("ops_task_attachments").insert(row).select(ATTACHMENT_SELECT).single();
  if (error || !data) dbFail("registrar o anexo", error);
  await logActivity([{ task_id: taskId, user_id: actor.userId, action: "anexo", from_value: null, to_value: row.name, note: null }]);
  return data as OpsAttachment;
}

async function loadAttachment(actor: OpsActor, attachmentId: string): Promise<{ attachment: OpsAttachment; task: OpsTask }> {
  const { data, error } = await getOpsDb().from("ops_task_attachments").select(ATTACHMENT_SELECT).eq("id", attachmentId).maybeSingle();
  if (error) dbFail("carregar o anexo", error);
  if (!data) throw new OpsPlannerHttpError("Anexo não encontrado.", 404, "NOT_FOUND");
  const task = await loadEditableTask(actor, data.task_id as string);
  return { attachment: data as OpsAttachment, task };
}

/** Link do anexo: o próprio link ou uma URL assinada de 5 minutos para baixar o arquivo. */
export async function getAttachmentUrl(actor: OpsActor, attachmentId: string): Promise<string> {
  const { attachment } = await loadAttachment(actor, attachmentId);
  if (attachment.kind === "link" && attachment.url) return attachment.url;
  const { data, error } = await getOpsDb()
    .storage.from(OPS_FILES_BUCKET)
    .createSignedUrl(attachment.storage_path as string, 300, { download: attachment.name });
  if (error || !data) dbFail("abrir o arquivo", error);
  return data.signedUrl;
}

export async function deleteAttachment(actor: OpsActor, attachmentId: string): Promise<void> {
  const { attachment, task } = await loadAttachment(actor, attachmentId);
  if (attachment.created_by !== actor.userId && !canManageSpace(actor, task.space_id)) {
    throw new OpsPlannerHttpError("Só quem anexou pode remover.", 403, "FORBIDDEN");
  }
  const db = getOpsDb();
  if (attachment.storage_path) {
    const { error } = await db.storage.from(OPS_FILES_BUCKET).remove([attachment.storage_path]);
    if (error) console.error("[ops-planner] remover arquivo", error.message);
  }
  const { error } = await db.from("ops_task_attachments").delete().eq("id", attachmentId);
  if (error) dbFail("remover o anexo", error);
}
