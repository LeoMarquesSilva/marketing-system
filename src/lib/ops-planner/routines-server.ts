import "server-only";

import { z } from "zod";
import { buildRoutineGeneratedNotifications, type AlertContext } from "./alerts";
import { loadEhDiaUtil } from "./business-days-server";
import { addDays, canManageSpace, canViewSpace, dateInSaoPaulo, finishedOnTime, todayInSaoPaulo } from "./domain";
import { insertNotifications } from "./notifications-server";
import { nextOccurrences, occurrencesToGenerate, validateRule, type EhDiaUtil } from "./recurrence";
import { dbFail, getOpsDb, loadPeople, loadSpaceManagers, OpsPlannerHttpError, plannerMemberIds, type OpsActor } from "./server";
import { TASK_SELECT } from "./tasks-server";
import {
  OPS_FREQUENCIES,
  OPS_MONTHLY_MODES,
  OPS_PRIORITIES,
  OPS_SHIFTS,
  OPS_TIPOS,
  type OpsRecurrenceRule,
  type OpsRoutine,
  type OpsRoutineSummary,
  type OpsTask,
} from "./types";

const ROUTINE_SELECT =
  "id, space_id, list_id, title, description, priority, tipo, assignee_ids, checklist, due_time, frequency, every_n, weekdays, only_business_days, monthly_mode, month_day, business_day_n, week_of_month, weekday, month, shift_non_business, lead_days, starts_on, ends_on, active, last_occurrence_date, created_by, created_at, updated_at";

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "Identificador inválido.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

const ruleShape = {
  frequency: z.enum(OPS_FREQUENCIES),
  every_n: z.number().int().min(1).max(36).default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  only_business_days: z.boolean().default(false),
  monthly_mode: z.enum(OPS_MONTHLY_MODES).nullable().default(null),
  month_day: z.number().int().min(-1).max(31).refine((value) => value !== 0).nullable().default(null),
  business_day_n: z.number().int().min(-1).max(23).refine((value) => value !== 0).nullable().default(null),
  week_of_month: z.union([z.literal(-1), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable().default(null),
  weekday: z.number().int().min(0).max(6).nullable().default(null),
  month: z.number().int().min(1).max(12).nullable().default(null),
  shift_non_business: z.enum(OPS_SHIFTS).default("manter"),
  starts_on: isoDate,
  ends_on: isoDate.nullable().default(null),
};

const ruleSchema = z.object(ruleShape);

const routineSchema = z.object({
  ...ruleShape,
  space_id: id,
  list_id: id.nullable().default(null),
  title: z.string().trim().min(1, "Informe o título.").max(300, "Título muito longo."),
  description: z.string().max(10000).nullable().default(null),
  priority: z.enum(OPS_PRIORITIES).default("media"),
  tipo: z.enum(OPS_TIPOS).default("operacional"),
  assignee_ids: z.array(id).max(20).default([]),
  checklist: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horário inválido.").nullable().default(null),
  lead_days: z.number().int().min(0).max(60).default(0),
  active: z.boolean().default(true),
});

type RoutineInput = z.infer<typeof routineSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new OpsPlannerHttpError(result.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID");
  }
  return result.data;
}

function cleanRule(rule: OpsRecurrenceRule): OpsRecurrenceRule {
  // Guarda só os campos que valem para a frequência escolhida.
  const monthly = rule.frequency === "mensal" || rule.frequency === "anual";
  const mode = monthly ? rule.monthly_mode : null;
  return {
    ...rule,
    weekdays: rule.frequency === "semanal" ? [...new Set(rule.weekdays)].sort((a, b) => a - b) : [],
    only_business_days: rule.frequency === "diaria" ? rule.only_business_days : false,
    monthly_mode: mode,
    month_day: mode === "dia_do_mes" ? rule.month_day : null,
    business_day_n: mode === "dia_util" ? rule.business_day_n : null,
    week_of_month: mode === "semana_do_mes" ? rule.week_of_month : null,
    weekday: mode === "semana_do_mes" ? rule.weekday : null,
    month: rule.frequency === "anual" ? rule.month : null,
    shift_non_business: rule.frequency === "diaria" || mode === "dia_util" ? "manter" : rule.shift_non_business,
  };
}

function toRoutine(row: Record<string, unknown>): OpsRoutine {
  return { ...(row as unknown as OpsRoutine), checklist: Array.isArray(row.checklist) ? (row.checklist as string[]) : [] };
}

/* ------------------------------------------------------------ geração */

/**
 * Cria as tarefas das ocorrências que já entraram na antecedência e avisa os
 * responsáveis. Idempotente: (routine_id, occurrence_date) é único.
 */
export async function generateRoutineTasks(
  routines: OpsRoutine[],
  options: { today: string; ehDiaUtil: EhDiaUtil; dryRun?: boolean; alert?: AlertContext }
): Promise<OpsTask[]> {
  const db = getOpsDb();
  const created: OpsTask[] = [];
  for (const routine of routines) {
    const createdOn = dateInSaoPaulo(routine.created_at) ?? options.today;
    const dates = occurrencesToGenerate(routine, options.today, createdOn, options.ehDiaUtil);
    if (dates.length === 0) continue;
    if (options.dryRun) {
      created.push(
        ...dates.map(
          (date) =>
            ({
              id: `dry-${routine.id}-${date}`,
              space_id: routine.space_id,
              title: routine.title,
              due_date: date,
              assignee_ids: routine.assignee_ids,
              routine_id: routine.id,
              occurrence_date: date,
              status: "a_fazer",
            }) as OpsTask
        )
      );
      continue;
    }
    const rows = dates.map((date) => ({
      space_id: routine.space_id,
      list_id: routine.list_id,
      routine_id: routine.id,
      occurrence_date: date,
      title: routine.title,
      description: routine.description,
      priority: routine.priority,
      tipo: routine.tipo,
      assignee_ids: routine.assignee_ids,
      due_date: date,
      due_time: routine.due_time,
      sort_order: Date.now() / 1000,
      created_by: routine.created_by,
    }));
    const { data, error } = await db
      .from("ops_tasks")
      .upsert(rows, { onConflict: "routine_id,occurrence_date", ignoreDuplicates: true })
      .select(TASK_SELECT);
    if (error) {
      console.error("[ops-planner] gerar rotina", routine.id, error.message);
      continue;
    }
    const tasks = (data ?? []) as OpsTask[];
    if (routine.checklist.length > 0 && tasks.length > 0) {
      const items = tasks.flatMap((task) => routine.checklist.map((label, index) => ({ task_id: task.id, label, sort_order: index })));
      const { error: checklistError } = await db.from("ops_task_checklist_items").insert(items);
      if (checklistError) console.error("[ops-planner] checklist da rotina", checklistError.message);
    }
    if (tasks.length > 0) {
      await db.from("ops_task_activity").insert(
        tasks.map((task) => ({ task_id: task.id, user_id: null, action: "gerada_rotina", from_value: null, to_value: routine.title, note: null }))
      );
    }
    const last = dates.at(-1) as string;
    if (!routine.last_occurrence_date || last > routine.last_occurrence_date) {
      await db.from("ops_routines").update({ last_occurrence_date: last }).eq("id", routine.id);
    }
    created.push(...tasks);
  }
  if (!options.dryRun && options.alert && created.length > 0) {
    await insertNotifications(buildRoutineGeneratedNotifications(created, options.alert));
  }
  return created;
}

/** Nomes de espaços e pessoas e a liderança de cada espaço, para os textos dos avisos. */
export async function buildAlertContext(today: string, ehDiaUtil: EhDiaUtil): Promise<AlertContext> {
  const [people, managers, spaces] = await Promise.all([
    loadPeople(),
    loadSpaceManagers(),
    getOpsDb().from("ops_spaces").select("id, name"),
  ]);
  const names = new Map(people.map((person) => [person.id, person.name.split(" ")[0]]));
  const spaceNames = new Map((spaces.data ?? []).map((space) => [space.id as string, space.name as string]));
  return {
    today,
    ehDiaUtil,
    spaceName: (spaceId) => spaceNames.get(spaceId) ?? "Planner",
    spaceManagers: (spaceId) => managers.get(spaceId) ?? [],
    personName: (userId) => names.get(userId) ?? "Alguém",
  };
}

/** Gera na hora a ocorrência da rotina recém-salva, sem esperar o cron. */
async function generateNow(routine: OpsRoutine): Promise<void> {
  const today = todayInSaoPaulo();
  const ehDiaUtil = await loadEhDiaUtil();
  await generateRoutineTasks([routine], { today, ehDiaUtil, alert: await buildAlertContext(today, ehDiaUtil) });
}

/* ------------------------------------------------------------ leitura */

export async function listRoutines(actor: OpsActor, spaceIds: string[]): Promise<OpsRoutineSummary[]> {
  const visible = spaceIds.filter((spaceId) => canViewSpace(actor, spaceId));
  if (visible.length === 0) return [];
  const db = getOpsDb();
  const { data, error } = await db
    .from("ops_routines")
    .select(ROUTINE_SELECT)
    .in("space_id", visible)
    .is("archived_at", null)
    .order("title");
  if (error) dbFail("carregar as rotinas", error);
  const routines = (data ?? []).map((row) => toRoutine(row as Record<string, unknown>));
  if (routines.length === 0) return [];

  const today = todayInSaoPaulo();
  const ehDiaUtil = await loadEhDiaUtil();
  const { data: recentRows, error: recentError } = await db
    .from("ops_tasks")
    .select("id, routine_id, occurrence_date, status, due_date, completed_at")
    .in("routine_id", routines.map((routine) => routine.id))
    .gte("occurrence_date", addDays(today, -120))
    .is("archived_at", null)
    .order("occurrence_date", { ascending: false });
  if (recentError) dbFail("carregar as últimas ocorrências", recentError);

  return routines.map((routine) => ({
    ...routine,
    next_dates: routine.active ? nextOccurrences(routine, addDays(today, 1), 3, ehDiaUtil) : [],
    recent: (recentRows ?? [])
      .filter((row) => row.routine_id === routine.id)
      .slice(0, 6)
      .map((row) => ({
        task_id: row.id as string,
        occurrence_date: row.occurrence_date as string,
        status: row.status as OpsTask["status"],
        on_time: finishedOnTime(row as Pick<OpsTask, "status" | "due_date" | "completed_at">),
      })),
  }));
}

/** Prévia das próximas datas no editor (considera os feriados). */
export async function previewRule(input: unknown): Promise<{ dates: string[]; error: string | null }> {
  const rule = cleanRule(parse(ruleSchema, input) as OpsRecurrenceRule);
  const problem = validateRule(rule);
  if (problem) return { dates: [], error: problem };
  const today = todayInSaoPaulo();
  const ehDiaUtil = await loadEhDiaUtil();
  const from = rule.starts_on > today ? rule.starts_on : today;
  return { dates: nextOccurrences(rule, from, 5, ehDiaUtil), error: null };
}

/* ------------------------------------------------------------ escrita */

async function assertRoutineRefs(body: RoutineInput): Promise<void> {
  const db = getOpsDb();
  if (body.list_id) {
    const { data } = await db.from("ops_lists").select("space_id").eq("id", body.list_id).maybeSingle();
    if (!data || data.space_id !== body.space_id) throw new OpsPlannerHttpError("A lista não é deste espaço.", 400, "INVALID_LIST");
  }
  if (body.assignee_ids.length > 0) {
    const members = await plannerMemberIds();
    if (body.assignee_ids.some((userId) => !members.has(userId))) {
      throw new OpsPlannerHttpError("Responsável precisa participar de algum espaço do Planner.", 400, "INVALID_ASSIGNEE");
    }
  }
}

function routineRow(body: RoutineInput) {
  const rule = cleanRule(body as unknown as OpsRecurrenceRule);
  const problem = validateRule(rule);
  if (problem) throw new OpsPlannerHttpError(problem, 400, "INVALID_RULE");
  return {
    ...rule,
    space_id: body.space_id,
    list_id: body.list_id,
    title: body.title,
    description: body.description?.trim() || null,
    priority: body.priority,
    tipo: body.tipo,
    assignee_ids: [...new Set(body.assignee_ids)],
    checklist: body.checklist,
    due_time: body.due_time,
    lead_days: body.lead_days,
    active: body.active,
  };
}

export async function createRoutine(actor: OpsActor, input: unknown): Promise<OpsRoutine> {
  const body = parse(routineSchema, input);
  if (!canViewSpace(actor, body.space_id)) throw new OpsPlannerHttpError("Você não participa deste espaço.", 403, "FORBIDDEN");
  await assertRoutineRefs(body);
  const { data, error } = await getOpsDb()
    .from("ops_routines")
    .insert({ ...routineRow(body), created_by: actor.userId, updated_by: actor.userId })
    .select(ROUTINE_SELECT)
    .single();
  if (error || !data) dbFail("criar a rotina", error);
  const routine = toRoutine(data as Record<string, unknown>);
  await generateNow(routine).catch((cause) => console.error("[ops-planner] gerar na criação", cause));
  return routine;
}

async function loadManageableRoutine(actor: OpsActor, routineId: string): Promise<OpsRoutine> {
  const { data, error } = await getOpsDb()
    .from("ops_routines")
    .select(ROUTINE_SELECT)
    .eq("id", routineId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) dbFail("carregar a rotina", error);
  if (!data) throw new OpsPlannerHttpError("Rotina não encontrada.", 404, "NOT_FOUND");
  const routine = toRoutine(data as Record<string, unknown>);
  if (!canManageSpace(actor, routine.space_id) && routine.created_by !== actor.userId) {
    throw new OpsPlannerHttpError("Só quem criou a rotina ou a liderança do espaço pode alterar.", 403, "FORBIDDEN");
  }
  return routine;
}

/** Editar muda só as próximas ocorrências; as tarefas já geradas ficam como estão. */
export async function updateRoutine(actor: OpsActor, routineId: string, input: unknown): Promise<OpsRoutine> {
  const current = await loadManageableRoutine(actor, routineId);
  const body = parse(routineSchema, { ...current, ...(input as object) });
  if (body.space_id !== current.space_id && !canViewSpace(actor, body.space_id)) {
    throw new OpsPlannerHttpError("Você não participa do espaço de destino.", 403, "FORBIDDEN");
  }
  await assertRoutineRefs(body);
  const row: Record<string, unknown> = { ...routineRow(body), updated_by: actor.userId };
  // Reativar não recupera o que venceu enquanto estava pausada.
  if (body.active && !current.active) {
    const yesterday = addDays(todayInSaoPaulo(), -1);
    if (!current.last_occurrence_date || current.last_occurrence_date < yesterday) row.last_occurrence_date = yesterday;
  }
  const { data, error } = await getOpsDb().from("ops_routines").update(row).eq("id", routineId).select(ROUTINE_SELECT).single();
  if (error || !data) dbFail("salvar a rotina", error);
  const routine = toRoutine(data as Record<string, unknown>);
  await generateNow(routine).catch((cause) => console.error("[ops-planner] gerar na edição", cause));
  return routine;
}

export async function archiveRoutine(actor: OpsActor, routineId: string): Promise<void> {
  await loadManageableRoutine(actor, routineId);
  const { error } = await getOpsDb()
    .from("ops_routines")
    .update({ archived_at: new Date().toISOString(), active: false, updated_by: actor.userId })
    .eq("id", routineId);
  if (error) dbFail("excluir a rotina", error);
}

/** Rotinas ativas de todos os espaços (cron). */
export async function listActiveRoutines(): Promise<OpsRoutine[]> {
  const { data, error } = await getOpsDb()
    .from("ops_routines")
    .select(ROUTINE_SELECT)
    .eq("active", true)
    .is("archived_at", null);
  if (error) dbFail("carregar as rotinas ativas", error);
  return (data ?? []).map((row) => toRoutine(row as Record<string, unknown>));
}
