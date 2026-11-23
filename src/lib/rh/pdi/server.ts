import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { PDI_ADMIN_ONLY } from "@/lib/access-control";
import { employeeMatchesFeriasAccess, resolveFeriasAccess, type FeriasAccessMode } from "@/lib/ferias/access";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { hasHrAccess } from "@/lib/rh/access";
import { loadPeopleDirectory, type DirectoryPerson } from "@/lib/rh/people-directory";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import { collectReports, createsCycle, type EmployeeLink } from "./team";
import {
  averageProgress,
  clampProgress,
  countKinds,
  daysBetween,
  isActionOverdue,
  planDueState,
  planProgress,
  todayInBrasilia,
} from "./progress";
import type {
  PdiAction,
  PdiActivity,
  PdiActivityKind,
  PdiGoal,
  PdiLearningKind,
  PdiManagerRow,
  PdiOrigin,
  PdiOverview,
  PdiPermissions,
  PdiPerson,
  PdiPlanDetail,
  PdiPlanInput,
  PdiPlanSummary,
  PdiProgressInput,
  PdiStatus,
  PdiType,
} from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function createPdiAdminClient(): SupabaseClient {
  if (!serviceKey) throw new RhHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function failed(context: string, error: unknown): never {
  console.error(`[pdi] ${context}:`, error);
  throw new RhHttpError("Falha ao consultar o PDI.", 500, "QUERY_FAILED");
}

// ---------------------------------------------------------------------------
// Quem está usando: colaborador, gestor (equipe) e RH.
// ---------------------------------------------------------------------------

interface PdiActor {
  db: SupabaseClient;
  userId: string;
  name: string;
  isHr: boolean;
  employeeId: string | null;
  /** Quem a pessoa lidera: liderados diretos e indiretos + liderança da área. Nunca inclui ela mesma. */
  team: Set<string>;
  people: Map<string, PdiPerson>;
  links: Map<string, EmployeeLink>;
}

function toPerson(person: DirectoryPerson): PdiPerson {
  return {
    id: person.id,
    name: person.short_name,
    full_name: person.full_name,
    department: person.department,
    position: person.position,
    avatar_url: person.avatar_url,
    is_active: person.is_active,
  };
}

const UNKNOWN_PERSON: PdiPerson = {
  id: "",
  name: "Colaborador removido",
  full_name: "Colaborador removido",
  department: null,
  position: null,
  avatar_url: null,
  is_active: false,
};

async function resolveActor(): Promise<PdiActor> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new RhHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const db = createPdiAdminClient();
  const { data: profile, error: profileError } = await db
    .from("users")
    .select("id, name, role, permissions, ferias_access_mode, ferias_area_scope")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (profileError || !profile) throw new RhHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  if (PDI_ADMIN_ONLY && (profile.role as string | null)?.toLowerCase() !== "admin") {
    throw new RhHttpError("O PDI ainda está em teste e só abre para administradores.", 403, "FORBIDDEN");
  }

  const [directory, linksResult] = await Promise.all([
    loadPeopleDirectory(db, "pdi"),
    db.from("hr_employees").select("id, user_id, manager_employee_id, department, position, is_active, is_automation"),
  ]);
  if (linksResult.error) failed("vínculos", linksResult.error);

  const people = new Map(directory.map((person) => [person.id, toPerson(person)]));
  const links = new Map<string, EmployeeLink>();
  let self: { id: string; position: string | null; department: string | null } | null = null;
  for (const row of linksResult.data ?? []) {
    if (row.is_automation) continue;
    links.set(row.id as string, {
      id: row.id as string,
      manager_employee_id: (row.manager_employee_id as string | null) ?? null,
      department: (row.department as string | null) ?? null,
      is_active: Boolean(row.is_active),
    });
    if (row.user_id === profile.id) {
      self = { id: row.id as string, position: row.position as string | null, department: row.department as string | null };
    }
  }

  const role = (profile.role as string | null) ?? null;
  const permissions = (profile.permissions as string[] | null) ?? [];
  const isHr = hasHrAccess(role, permissions);

  const team = new Set<string>();
  if (self) {
    for (const id of collectReports(self.id, links.values())) team.add(id);
    // Liderança por área (cargo de gestão ou escopo em Usuários), a mesma de Férias.
    const area = resolveFeriasAccess({
      role: null,
      permissions: [],
      accessMode: profile.ferias_access_mode as FeriasAccessMode | null,
      areaScope: profile.ferias_area_scope as string[] | null,
      position: self.position,
      department: self.department,
    });
    if (area.level === "viewer") {
      for (const link of links.values()) {
        if (link.is_active && employeeMatchesFeriasAccess(link.department, area)) team.add(link.id);
      }
    }
    team.delete(self.id);
  }

  return {
    db,
    userId: profile.id as string,
    name: profile.name as string,
    isHr,
    employeeId: self?.id ?? null,
    team,
    people,
    links,
  };
}

async function requireHr(): Promise<PdiActor> {
  const actor = await resolveActor();
  if (!actor.isHr) throw new RhHttpError("Você não tem acesso à gestão de PDI.", 403, "FORBIDDEN");
  return actor;
}

function personOf(actor: PdiActor, id: string | null): PdiPerson | null {
  if (!id) return null;
  return actor.people.get(id) ?? { ...UNKNOWN_PERSON, id };
}

// ---------------------------------------------------------------------------
// Leitura.
// ---------------------------------------------------------------------------

interface PlanRow {
  id: string;
  employee_id: string;
  manager_employee_id: string | null;
  type_id: string | null;
  title: string;
  career_goal: string | null;
  origin: PdiOrigin;
  origin_label: string | null;
  start_date: string;
  due_date: string;
  status: PdiStatus;
  completed_at: string | null;
  status_note: string | null;
  agreed_at: string | null;
  agreed_by: string | null;
  created_by: string | null;
  created_at: string;
}

const PLAN_SELECT =
  "id, employee_id, manager_employee_id, type_id, title, career_goal, origin, origin_label, start_date, due_date, status, completed_at, status_note, agreed_at, agreed_by, created_by, created_at";

interface ActionLite {
  plan_id: string;
  goal_id: string;
  progress: number;
  due_date: string | null;
  learning_kind: PdiLearningKind | null;
  last_update_at: string | null;
}

async function loadTypes(db: SupabaseClient): Promise<PdiType[]> {
  const { data, error } = await db
    .from("hr_pdi_types")
    .select("id, name, description, is_active")
    .order("sort_order")
    .order("name");
  if (error) failed("tipos", error);
  return (data ?? []) as PdiType[];
}

function summarize(
  actor: PdiActor,
  plan: PlanRow,
  actions: ActionLite[],
  typeNames: Map<string, string>,
  today: string
): PdiPlanSummary {
  const lastUpdate = actions.reduce<string | null>(
    (latest, action) => (action.last_update_at && (!latest || action.last_update_at > latest) ? action.last_update_at : latest),
    null
  );
  return {
    id: plan.id,
    title: plan.title,
    type_id: plan.type_id,
    type_name: plan.type_id ? typeNames.get(plan.type_id) ?? null : null,
    employee: personOf(actor, plan.employee_id) as PdiPerson,
    manager: personOf(actor, plan.manager_employee_id),
    start_date: plan.start_date,
    due_date: plan.due_date,
    status: plan.status,
    origin: plan.origin,
    origin_label: plan.origin_label,
    progress: planProgress(actions),
    actions_total: actions.length,
    actions_done: actions.filter((action) => action.progress >= 100).length,
    actions_overdue: plan.status === "ativo" ? actions.filter((action) => isActionOverdue(action, today)).length : 0,
    due_state: planDueState(plan, today),
    days_left: daysBetween(today, plan.due_date),
    last_update_at: lastUpdate,
    agreed_at: plan.agreed_at,
    kinds: countKinds(actions),
  };
}

async function loadSummaries(actor: PdiActor, filter: (plan: PlanRow) => boolean): Promise<PdiPlanSummary[]> {
  const [plansResult, actionsResult, types] = await Promise.all([
    actor.db.from("hr_pdi_plans").select(PLAN_SELECT).order("due_date"),
    actor.db.from("hr_pdi_actions").select("plan_id, goal_id, progress, due_date, learning_kind, last_update_at"),
    loadTypes(actor.db),
  ]);
  if (plansResult.error) failed("planos", plansResult.error);
  if (actionsResult.error) failed("ações", actionsResult.error);
  const actionsByPlan = new Map<string, ActionLite[]>();
  for (const action of (actionsResult.data ?? []) as ActionLite[]) {
    const list = actionsByPlan.get(action.plan_id) ?? [];
    list.push(action);
    actionsByPlan.set(action.plan_id, list);
  }
  const typeNames = new Map(types.map((type) => [type.id, type.name]));
  const today = todayInBrasilia();
  return ((plansResult.data ?? []) as PlanRow[])
    .filter(filter)
    .map((plan) => summarize(actor, plan, actionsByPlan.get(plan.id) ?? [], typeNames, today));
}

function activePeople(actor: PdiActor, ids: Iterable<string>): PdiPerson[] {
  return [...ids]
    .map((id) => actor.people.get(id))
    .filter((person): person is PdiPerson => Boolean(person?.is_active))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Tela "Meu PDI": os meus planos e os da equipe que eu lidero. */
export async function getPdiOverview(): Promise<PdiOverview> {
  const actor = await resolveActor();
  const summaries = await loadSummaries(
    actor,
    (plan) => plan.employee_id === actor.employeeId || actor.team.has(plan.employee_id)
  );
  const myPlans = summaries.filter((plan) => plan.employee.id === actor.employeeId);
  const teamPlans = summaries.filter((plan) => plan.employee.id !== actor.employeeId);
  const withActivePlan = new Set(teamPlans.filter((plan) => plan.status === "ativo").map((plan) => plan.employee.id));
  const team = activePeople(actor, actor.team);
  const types = (await loadTypes(actor.db)).filter((type) => type.is_active);
  const me = personOf(actor, actor.employeeId);
  const creatable = actor.isHr
    ? activePeople(actor, actor.people.keys())
    : [...(me ? [me] : []), ...team];
  return {
    me,
    myPlans,
    teamPlans,
    teamWithoutPlan: team.filter((person) => !withActivePlan.has(person.id)),
    isLeader: actor.team.size > 0,
    isHr: actor.isHr,
    types,
    creatable,
  };
}

/** Gestão do RH: todos os planos. */
export async function listAllPlans(): Promise<{
  plans: PdiPlanSummary[];
  withoutPlan: PdiPerson[];
  types: PdiType[];
  managers: PdiManagerRow[];
}> {
  const actor = await requireHr();
  const plans = await loadSummaries(actor, () => true);
  const withActive = new Set(plans.filter((plan) => plan.status === "ativo").map((plan) => plan.employee.id));
  const everyone = activePeople(actor, actor.people.keys());
  return {
    plans,
    withoutPlan: everyone.filter((person) => !withActive.has(person.id)),
    types: await loadTypes(actor.db),
    managers: everyone.map((person) => ({
      employee: person,
      manager_employee_id: actor.links.get(person.id)?.manager_employee_id ?? null,
    })),
  };
}

function permissionsFor(actor: PdiActor, plan: PlanRow): { permissions: PdiPermissions; role: PdiPlanDetail["viewer_role"] } | null {
  const isOwner = plan.employee_id === actor.employeeId;
  const isLeader = actor.team.has(plan.employee_id) || (plan.manager_employee_id !== null && plan.manager_employee_id === actor.employeeId);
  if (!isOwner && !isLeader && !actor.isHr) return null;
  const active = plan.status === "ativo";
  const any = isOwner || isLeader || actor.isHr;
  return {
    role: isOwner ? "dono" : isLeader ? "gestor" : "rh",
    permissions: {
      canEdit: any && active,
      canUpdateProgress: any && active,
      canComment: any,
      canAgree: (isLeader || actor.isHr) && !isOwner && active && !plan.agreed_at,
      canChangeStatus: any,
      canDelete: actor.isHr,
    },
  };
}

async function loadPlanRow(actor: PdiActor, planId: string): Promise<PlanRow> {
  if (!z.string().uuid().safeParse(planId).success) throw new RhHttpError("PDI não encontrado.", 404, "NOT_FOUND");
  const { data, error } = await actor.db.from("hr_pdi_plans").select(PLAN_SELECT).eq("id", planId).maybeSingle();
  if (error) failed("plano", error);
  if (!data) throw new RhHttpError("PDI não encontrado.", 404, "NOT_FOUND");
  return data as PlanRow;
}

async function authorize(actor: PdiActor, planId: string, check?: keyof PdiPermissions) {
  const plan = await loadPlanRow(actor, planId);
  const access = permissionsFor(actor, plan);
  if (!access) throw new RhHttpError("Você não tem acesso a este PDI.", 403, "FORBIDDEN");
  if (check && !access.permissions[check]) {
    const message =
      plan.status !== "ativo" && check !== "canDelete"
        ? "Este PDI não está ativo. Reabra o plano para alterar."
        : "Você não pode fazer isso neste PDI.";
    throw new RhHttpError(message, 403, "FORBIDDEN");
  }
  return { plan, access };
}

export async function getPlanDetail(planId: string): Promise<PdiPlanDetail> {
  const actor = await resolveActor();
  const { plan, access } = await authorize(actor, planId);
  const [goalsResult, actionsResult, activityResult, types] = await Promise.all([
    actor.db.from("hr_pdi_goals").select("id, title, description, competency, sort_order").eq("plan_id", plan.id).order("sort_order"),
    actor.db
      .from("hr_pdi_actions")
      .select(
        "id, goal_id, title, description, learning_kind, expected_evidence, success_indicator, due_date, progress, completed_at, learnings, evidence_url, sort_order, last_update_at"
      )
      .eq("plan_id", plan.id)
      .order("sort_order"),
    actor.db
      .from("hr_pdi_activity")
      .select("id, action_id, kind, progress_from, progress_to, body, author_user_id, created_at")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: false })
      .limit(200),
    loadTypes(actor.db),
  ]);
  if (goalsResult.error) failed("frentes", goalsResult.error);
  if (actionsResult.error) failed("ações", actionsResult.error);
  if (activityResult.error) failed("histórico", activityResult.error);

  const today = todayInBrasilia();
  const actions: PdiAction[] = ((actionsResult.data ?? []) as Array<Omit<PdiAction, "overdue">>).map((action) => ({
    ...action,
    overdue: plan.status === "ativo" && isActionOverdue(action, today),
  }));
  const goals: PdiGoal[] = ((goalsResult.data ?? []) as Array<Omit<PdiGoal, "progress" | "actions">>).map((goal) => {
    const goalActions = actions.filter((action) => action.goal_id === goal.id);
    return { ...goal, actions: goalActions, progress: averageProgress(goalActions.map((action) => action.progress)) };
  });

  const userIds = [
    ...new Set(
      [plan.agreed_by, plan.created_by, ...(activityResult.data ?? []).map((row) => row.author_user_id as string | null)].filter(
        Boolean
      ) as string[]
    ),
  ];
  const users = new Map<string, { name: string; avatar: string | null }>();
  if (userIds.length) {
    const { data, error } = await actor.db.from("users").select("id, name, avatar_url, photo_onedrive_url").in("id", userIds);
    if (error) failed("autores", error);
    for (const row of data ?? []) {
      users.set(row.id as string, {
        name: row.name as string,
        avatar: resolveEmployeeAvatarUrl(row.avatar_url as string | null, row.photo_onedrive_url as string | null),
      });
    }
  }
  const actionTitles = new Map(actions.map((action) => [action.id, action.title]));
  const activity: PdiActivity[] = (activityResult.data ?? []).map((row) => {
    const author = row.author_user_id ? users.get(row.author_user_id as string) : undefined;
    return {
      id: row.id as string,
      action_id: (row.action_id as string | null) ?? null,
      action_title: row.action_id ? actionTitles.get(row.action_id as string) ?? null : null,
      kind: row.kind as PdiActivityKind,
      progress_from: (row.progress_from as number | null) ?? null,
      progress_to: (row.progress_to as number | null) ?? null,
      body: (row.body as string | null) ?? null,
      author_name: author?.name ?? null,
      author_avatar_url: author?.avatar ?? null,
      created_at: row.created_at as string,
    };
  });

  const typeNames = new Map(types.map((type) => [type.id, type.name]));
  const summary = summarize(actor, plan, actions.map((action) => ({ ...action, plan_id: plan.id })), typeNames, today);
  return {
    ...summary,
    career_goal: plan.career_goal,
    status_note: plan.status_note,
    completed_at: plan.completed_at,
    agreed_by_name: plan.agreed_by ? users.get(plan.agreed_by)?.name ?? null : null,
    created_by_name: plan.created_by ? users.get(plan.created_by)?.name ?? null : null,
    created_at: plan.created_at,
    goals,
    activity,
    permissions: access.permissions,
    viewer_role: access.role,
  };
}

// ---------------------------------------------------------------------------
// Escrita.
// ---------------------------------------------------------------------------

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Texto muito longo.")
    .nullable()
    .optional()
    .transform((value) => value || null);

const actionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Dê um nome a cada ação.").max(300, "Nome da ação muito longo."),
  description: optionalText(8000),
  learning_kind: z.enum(["pratica", "troca", "formal"]).nullable().optional().transform((value) => value ?? null),
  expected_evidence: optionalText(2000),
  success_indicator: optionalText(2000),
  due_date: isoDate.nullable().optional().transform((value) => value ?? null),
});

const planSchema = z
  .object({
    employee_id: z.string().uuid("Escolha o colaborador."),
    manager_employee_id: z.string().uuid().nullable().optional(),
    type_id: z.string().uuid().nullable().optional().transform((value) => value ?? null),
    title: z.string().trim().min(3, "Dê um título ao plano.").max(200, "Título muito longo."),
    career_goal: optionalText(2000),
    start_date: isoDate,
    due_date: isoDate,
    goals: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          title: z.string().trim().min(2, "Dê um nome a cada frente.").max(200, "Nome da frente muito longo."),
          description: optionalText(4000),
          competency: optionalText(120),
          actions: z.array(actionSchema).min(1, "Cada frente precisa de pelo menos uma ação.").max(30),
        })
      )
      .min(1, "Inclua pelo menos uma frente de desenvolvimento.")
      .max(15),
  })
  .superRefine((value, ctx) => {
    if (value.due_date < value.start_date) {
      ctx.addIssue({ code: "custom", path: ["due_date"], message: "O prazo não pode ser antes do início." });
    }
  });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new RhHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID_INPUT");
  return parsed.data;
}

async function logActivity(
  actor: PdiActor,
  entry: {
    plan_id: string;
    action_id?: string | null;
    kind: PdiActivityKind;
    progress_from?: number | null;
    progress_to?: number | null;
    body?: string | null;
  }
) {
  const { error } = await actor.db.from("hr_pdi_activity").insert({ ...entry, author_user_id: actor.userId });
  if (error) failed("registrar histórico", error);
}

function canCreateFor(actor: PdiActor, employeeId: string): boolean {
  return actor.isHr || employeeId === actor.employeeId || actor.team.has(employeeId);
}

async function syncStructure(actor: PdiActor, planId: string, goals: z.infer<typeof planSchema>["goals"]) {
  const [existingGoals, existingActions] = await Promise.all([
    actor.db.from("hr_pdi_goals").select("id").eq("plan_id", planId),
    actor.db.from("hr_pdi_actions").select("id").eq("plan_id", planId),
  ]);
  if (existingGoals.error) failed("frentes atuais", existingGoals.error);
  if (existingActions.error) failed("ações atuais", existingActions.error);
  const goalIds = new Set((existingGoals.data ?? []).map((row) => row.id as string));
  const actionIds = new Set((existingActions.data ?? []).map((row) => row.id as string));
  const keptGoals = new Set<string>();
  const keptActions = new Set<string>();
  const now = new Date().toISOString();

  for (const [goalIndex, goal] of goals.entries()) {
    const goalFields = {
      plan_id: planId,
      title: goal.title,
      description: goal.description,
      competency: goal.competency,
      sort_order: goalIndex,
      updated_at: now,
    };
    let goalId = goal.id && goalIds.has(goal.id) ? goal.id : null;
    if (goalId) {
      const { error } = await actor.db.from("hr_pdi_goals").update(goalFields).eq("id", goalId);
      if (error) failed("atualizar frente", error);
    } else {
      const { data, error } = await actor.db.from("hr_pdi_goals").insert(goalFields).select("id").single();
      if (error || !data) failed("criar frente", error);
      goalId = data.id as string;
    }
    keptGoals.add(goalId);

    for (const [actionIndex, action] of goal.actions.entries()) {
      const actionFields = {
        plan_id: planId,
        goal_id: goalId,
        title: action.title,
        description: action.description,
        learning_kind: action.learning_kind,
        expected_evidence: action.expected_evidence,
        success_indicator: action.success_indicator,
        due_date: action.due_date,
        sort_order: actionIndex,
        updated_at: now,
      };
      if (action.id && actionIds.has(action.id)) {
        const { error } = await actor.db.from("hr_pdi_actions").update(actionFields).eq("id", action.id);
        if (error) failed("atualizar ação", error);
        keptActions.add(action.id);
      } else {
        const { data, error } = await actor.db.from("hr_pdi_actions").insert(actionFields).select("id").single();
        if (error || !data) failed("criar ação", error);
        keptActions.add(data.id as string);
      }
    }
  }

  const removedActions = [...actionIds].filter((id) => !keptActions.has(id));
  if (removedActions.length) {
    const { error } = await actor.db.from("hr_pdi_actions").delete().in("id", removedActions);
    if (error) failed("remover ações", error);
  }
  const removedGoals = [...goalIds].filter((id) => !keptGoals.has(id));
  if (removedGoals.length) {
    const { error } = await actor.db.from("hr_pdi_goals").delete().in("id", removedGoals);
    if (error) failed("remover frentes", error);
  }
}

export async function createPlan(input: PdiPlanInput): Promise<{ id: string }> {
  const actor = await resolveActor();
  const data = parse(planSchema, input);
  if (!actor.people.get(data.employee_id)?.is_active) {
    throw new RhHttpError("Colaborador não encontrado ou inativo.", 400, "INVALID_INPUT");
  }
  if (!canCreateFor(actor, data.employee_id)) {
    throw new RhHttpError("Você só pode criar PDI para você ou para quem você lidera.", 403, "FORBIDDEN");
  }
  // Acompanhante: o escolhido (RH/gestor) ou o gestor direto do cadastro.
  const manager =
    (actor.isHr || actor.team.has(data.employee_id)) && data.manager_employee_id !== undefined
      ? data.manager_employee_id
      : actor.links.get(data.employee_id)?.manager_employee_id ?? null;

  const { data: plan, error } = await actor.db
    .from("hr_pdi_plans")
    .insert({
      employee_id: data.employee_id,
      manager_employee_id: manager === data.employee_id ? null : manager,
      type_id: data.type_id,
      title: data.title,
      career_goal: data.career_goal,
      start_date: data.start_date,
      due_date: data.due_date,
      origin: "manual",
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !plan) failed("criar plano", error);
  try {
    await syncStructure(actor, plan.id as string, data.goals);
  } catch (structureError) {
    await actor.db.from("hr_pdi_plans").delete().eq("id", plan.id);
    throw structureError;
  }
  await logActivity(actor, { plan_id: plan.id as string, kind: "criacao" });
  return { id: plan.id as string };
}

export async function updatePlan(planId: string, input: PdiPlanInput): Promise<void> {
  const actor = await resolveActor();
  const { plan } = await authorize(actor, planId, "canEdit");
  const data = parse(planSchema, { ...input, employee_id: plan.employee_id });
  const canPickManager = actor.isHr || actor.team.has(plan.employee_id);
  const { error } = await actor.db
    .from("hr_pdi_plans")
    .update({
      type_id: data.type_id,
      title: data.title,
      career_goal: data.career_goal,
      start_date: data.start_date,
      due_date: data.due_date,
      ...(canPickManager && data.manager_employee_id !== undefined
        ? { manager_employee_id: data.manager_employee_id === plan.employee_id ? null : data.manager_employee_id }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id);
  if (error) failed("atualizar plano", error);
  await syncStructure(actor, plan.id, data.goals);
  await logActivity(actor, { plan_id: plan.id, kind: "edicao" });
}

const progressSchema = z.object({
  progress: z.number().int().min(0).max(100),
  note: optionalText(4000),
  learnings: optionalText(8000),
  evidence_url: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || /^https?:\/\//i.test(value), "O link da evidência precisa começar com http:// ou https://."),
});

/** Atualiza a ação e devolve o id do plano. */
export async function updateActionProgress(actionId: string, input: PdiProgressInput): Promise<string> {
  const actor = await resolveActor();
  if (!z.string().uuid().safeParse(actionId).success) throw new RhHttpError("Ação não encontrada.", 404, "NOT_FOUND");
  const data = parse(progressSchema, input);
  const { data: action, error } = await actor.db
    .from("hr_pdi_actions")
    .select("id, plan_id, progress, learnings, evidence_url")
    .eq("id", actionId)
    .maybeSingle();
  if (error) failed("ação", error);
  if (!action) throw new RhHttpError("Ação não encontrada.", 404, "NOT_FOUND");
  await authorize(actor, action.plan_id as string, "canUpdateProgress");

  const progress = clampProgress(data.progress);
  const previous = action.progress as number;
  const now = new Date().toISOString();
  const { error: updateError } = await actor.db
    .from("hr_pdi_actions")
    .update({
      progress,
      learnings: data.learnings,
      evidence_url: data.evidence_url,
      completed_at: progress >= 100 ? (previous >= 100 ? undefined : now) : null,
      completed_by: progress >= 100 ? (previous >= 100 ? undefined : actor.userId) : null,
      last_update_at: now,
      updated_at: now,
    })
    .eq("id", actionId);
  if (updateError) failed("atualizar progresso", updateError);
  if (progress !== previous || data.note) {
    await logActivity(actor, {
      plan_id: action.plan_id as string,
      action_id: actionId,
      kind: "progresso",
      progress_from: previous,
      progress_to: progress,
      body: data.note,
    });
  }
  return action.plan_id as string;
}

export async function addComment(planId: string, input: { body: string; action_id?: string | null }): Promise<void> {
  const actor = await resolveActor();
  const { plan } = await authorize(actor, planId, "canComment");
  const data = parse(
    z.object({
      body: z.string().trim().min(1, "Escreva o comentário.").max(4000, "Comentário muito longo."),
      action_id: z.string().uuid().nullable().optional(),
    }),
    input
  );
  await logActivity(actor, { plan_id: plan.id, action_id: data.action_id ?? null, kind: "comentario", body: data.body });
  if (data.action_id) {
    await actor.db.from("hr_pdi_actions").update({ last_update_at: new Date().toISOString() }).eq("id", data.action_id).eq("plan_id", plan.id);
  }
}

export async function changeStatus(planId: string, input: { status: PdiStatus; note?: string | null }): Promise<void> {
  const actor = await resolveActor();
  const { plan } = await authorize(actor, planId, "canChangeStatus");
  const data = parse(
    z.object({ status: z.enum(["ativo", "concluido", "cancelado"]), note: optionalText(2000) }),
    input
  );
  if (data.status === plan.status) return;
  const now = new Date().toISOString();
  const { error } = await actor.db
    .from("hr_pdi_plans")
    .update({
      status: data.status,
      status_note: data.note,
      completed_at: data.status === "concluido" ? now : null,
      updated_at: now,
    })
    .eq("id", plan.id);
  if (error) failed("mudar status", error);
  const label = data.status === "ativo" ? "Plano reaberto" : data.status === "concluido" ? "Plano concluído" : "Plano cancelado";
  await logActivity(actor, { plan_id: plan.id, kind: "status", body: data.note ? `${label}: ${data.note}` : label });
}

export async function agreePlan(planId: string): Promise<void> {
  const actor = await resolveActor();
  const { plan } = await authorize(actor, planId, "canAgree");
  const now = new Date().toISOString();
  const { error } = await actor.db.from("hr_pdi_plans").update({ agreed_at: now, agreed_by: actor.userId, updated_at: now }).eq("id", plan.id);
  if (error) failed("registrar acordo", error);
  await logActivity(actor, { plan_id: plan.id, kind: "acordo", body: "De acordo com o plano" });
}

export async function deletePlan(planId: string): Promise<void> {
  const actor = await resolveActor();
  const { plan } = await authorize(actor, planId, "canDelete");
  const { error } = await actor.db.from("hr_pdi_plans").delete().eq("id", plan.id);
  if (error) failed("excluir plano", error);
}

// ---------------------------------------------------------------------------
// RH: gestor direto e tipos.
// ---------------------------------------------------------------------------

export async function setDirectManager(employeeId: string, managerId: string | null): Promise<void> {
  const actor = await requireHr();
  const ids = z.object({ employeeId: z.string().uuid(), managerId: z.string().uuid().nullable() });
  parse(ids, { employeeId, managerId });
  if (!actor.links.has(employeeId)) throw new RhHttpError("Colaborador não encontrado.", 404, "NOT_FOUND");
  if (managerId) {
    if (!actor.links.has(managerId)) throw new RhHttpError("Gestor não encontrado.", 400, "INVALID_INPUT");
    if (createsCycle(employeeId, managerId, actor.links.values())) {
      throw new RhHttpError("Esse gestor é liderado (direto ou indireto) desta pessoa.", 400, "INVALID_INPUT");
    }
  }
  const { error } = await actor.db.from("hr_employees").update({ manager_employee_id: managerId }).eq("id", employeeId);
  if (error) failed("gestor direto", error);
}

export async function createType(input: { name: string; description?: string | null }): Promise<PdiType> {
  const actor = await requireHr();
  const data = parse(
    z.object({ name: z.string().trim().min(2, "Dê um nome ao tipo.").max(120), description: optionalText(500) }),
    input
  );
  const { data: row, error } = await actor.db
    .from("hr_pdi_types")
    .insert({ name: data.name, description: data.description, sort_order: 100 })
    .select("id, name, description, is_active")
    .single();
  if (error) {
    if (error.code === "23505") throw new RhHttpError("Já existe um tipo com esse nome.", 409, "DUPLICATE");
    failed("criar tipo", error);
  }
  return row as PdiType;
}

export async function setTypeActive(typeId: string, isActive: boolean): Promise<void> {
  const actor = await requireHr();
  parse(z.string().uuid(), typeId);
  const { error } = await actor.db.from("hr_pdi_types").update({ is_active: isActive }).eq("id", typeId);
  if (error) failed("tipo", error);
}
