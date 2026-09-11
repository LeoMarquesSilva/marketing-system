import "server-only";

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import {
  canAssignContentScheduleArea,
  canReadContentScheduleSlot,
  findAutomaticSlotMatch,
  findContentSimilarityWarnings,
  normalizeScheduleArea,
  resolveContentScheduleAccess,
  type ContentScheduleAccess as DomainAccess,
  type ContentSimilarityCandidate,
} from "@/lib/content-schedule/domain";
import { canSeeContentRoteiro } from "@/lib/content-areas";
import {
  classifyScheduleAssigneeIssues,
  likelySamePerson,
  type AssigneeIssuePersonInput,
  type AssigneeIssueSlotInput,
} from "@/lib/content-schedule/assignee-issues";
import type {
  ContentScheduleAssigneeReviewResponse,
  ContentScheduleCollaborator,
  ContentScheduleFormat,
  ContentSchedulePendingLink,
  ContentScheduleResponse,
  ContentScheduleSlot,
  ContentScheduleWarning,
} from "@/lib/content-schedule/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export class ContentScheduleHttpError extends Error {
  constructor(message: string, public status = 500, public code = "CONTENT_SCHEDULE_ERROR") {
    super(message);
  }
}

interface ScheduleActor {
  profileId: string;
  department: string | null;
  role: string | null;
  access: DomainAccess;
}

type SlotRow = {
  id: string; area: string; due_date: string; format: ContentScheduleFormat;
  collaborator_id: string | null; source_key: string; source_name: string | null;
  source_status: string | null; source_notes: string | null; cancelled: boolean;
  content_roteiro_id: string | null; reel_studio_id: string | null;
  instagram_post_id: string | null; created_at: string; updated_at: string;
};

function adminDb(): SupabaseClient {
  if (!serviceKey) throw new ContentScheduleHttpError("Serviço do cronograma indisponível.", 503, "SERVICE_UNAVAILABLE");
  return createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function sameScheduleArea(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeScheduleArea(left);
  const b = normalizeScheduleArea(right);
  return Boolean(a && b && a === b);
}

export function currentSaoPauloDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function currentSaoPauloMonth(): string {
  return currentSaoPauloDate().slice(0, 7);
}

function saoPauloCivilDate(value: string | undefined): string {
  if (!value) return currentSaoPauloDate();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) throw new ContentScheduleHttpError("Data do evento inválida.", 400, "INVALID_DATE");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(instant);
}

function monthBounds(month: string): { start: string; end: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ContentScheduleHttpError("Mês inválido.", 400, "INVALID_MONTH");
  }
  const [year, value] = month.split("-").map(Number);
  const next = value === 12 ? `${year + 1}-01-01` : `${year}-${String(value + 1).padStart(2, "0")}-01`;
  return { start: `${month}-01`, end: next };
}

async function requireActor(): Promise<ScheduleActor> {
  const ssr = await createSsrClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) throw new ContentScheduleHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const db = adminDb();
  const { data: profile, error } = await db.from("users")
    .select("id,role,department,permissions,is_active,ferias_access_mode,ferias_area_scope")
    .eq("auth_id", user.id).maybeSingle();
  if (error) throw new ContentScheduleHttpError("Não foi possível validar seu acesso.", 500, "ACCESS_LOOKUP_FAILED");
  if (!profile || profile.is_active === false) {
    throw new ContentScheduleHttpError("Perfil ativo não encontrado.", 403, "FORBIDDEN");
  }
  const { data: employee, error: employeeError } = await db.from("hr_employees")
    .select("position,department").eq("user_id", profile.id).maybeSingle();
  if (employeeError) throw new ContentScheduleHttpError("Não foi possível validar sua área.", 500, "ACCESS_LOOKUP_FAILED");

  const access = resolveContentScheduleAccess({
    userId: profile.id, isActive: profile.is_active !== false, role: profile.role,
    permissions: profile.permissions, accessMode: profile.ferias_access_mode,
    areaScope: profile.ferias_area_scope, position: employee?.position,
    department: employee?.department ?? profile.department,
  });
  if (!access.manageAll && access.manageableAreas?.length === 0 && !access.canReadOwn) {
    throw new ContentScheduleHttpError("Você não tem acesso ao cronograma.", 403, "FORBIDDEN");
  }
  return { profileId: profile.id, department: employee?.department ?? profile.department ?? null,
    role: profile.role ?? null, access };
}

function requireManager(actor: ScheduleActor): void {
  if (!actor.access.manageAll) throw new ContentScheduleHttpError("Ação exclusiva do Marketing.", 403, "FORBIDDEN");
}

async function loadCollaborators(db: SupabaseClient, access: DomainAccess): Promise<ContentScheduleCollaborator[]> {
  const { data, error } = await db.from("users").select("id,name,department,avatar_url")
    .or("is_active.eq.true,is_active.is.null").order("name");
  if (error) throw new ContentScheduleHttpError("Não foi possível carregar os colaboradores.");
  const ids = (data ?? []).map((person) => person.id);
  const { data: employees, error: employeeError } = ids.length
    ? await db.from("hr_employees").select("user_id,department,is_active").in("user_id", ids)
    : { data: [], error: null };
  if (employeeError) throw new ContentScheduleHttpError("Não foi possível validar as áreas dos colaboradores.");
  const hrByUser = new Map((employees ?? []).map((employee) => [employee.user_id, employee]));
  return ((data ?? []) as ContentScheduleCollaborator[]).flatMap((person) => {
    const employee = hrByUser.get(person.id);
    if (employee?.is_active === false) return [];
    const resolved = { ...person, department: employee?.department ?? person.department };
    if (access.manageAll || access.manageableAreas === null) return [resolved];
    if (resolved.id === access.ownCollaboratorId) return [resolved];
    return access.manageableAreas.some((area) => sameScheduleArea(resolved.department, area)) ? [resolved] : [];
  });
}

type AssigneeUserRow = {
  id: string;
  name: string;
  department: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
};

type AssigneeEmployeeRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  department: string | null;
  is_active: boolean;
};

async function loadAssigneePeople(db: SupabaseClient): Promise<AssigneeIssuePersonInput[]> {
  const [{ data: users, error: userError }, { data: employees, error: employeeError }] = await Promise.all([
    db.from("users").select("id,name,department,avatar_url,is_active"),
    db.from("hr_employees").select("id,user_id,full_name,department,is_active"),
  ]);
  if (userError || employeeError) {
    throw new ContentScheduleHttpError("Não foi possível comparar os nomes com o cadastro de pessoas.");
  }

  const employeeByUser = new Map(
    ((employees ?? []) as AssigneeEmployeeRow[])
      .filter((employee) => employee.user_id)
      .map((employee) => [employee.user_id as string, employee])
  );
  const people = ((users ?? []) as AssigneeUserRow[]).map((user) => {
    const employee = employeeByUser.get(user.id);
    return {
      id: user.id,
      name: employee?.full_name?.trim() || user.name,
      department: employee?.department ?? user.department,
      isActive: user.is_active !== false && employee?.is_active !== false,
      avatarUrl: user.avatar_url,
    } satisfies AssigneeIssuePersonInput;
  });

  // Fichas antigas sem login ainda ajudam a identificar ex-colaboradores, mas
  // nunca viram sugestão selecionável porque não possuem um usuário do sistema.
  for (const employee of (employees ?? []) as AssigneeEmployeeRow[]) {
    if (!employee.user_id && employee.is_active === false) {
      people.push({
        id: `hr:${employee.id}`,
        name: employee.full_name,
        department: employee.department,
        isActive: false,
        avatarUrl: null,
      });
    }
  }
  return people;
}

function ensureAssigneeManager(actor: ScheduleActor): void {
  if (!actor.access.manageAll && actor.access.manageableAreas?.length === 0) {
    throw new ContentScheduleHttpError("Somente gestores podem revisar os responsáveis.", 403, "FORBIDDEN");
  }
}

function assigneeSlotInput(row: Pick<SlotRow, "id" | "area" | "source_name" | "due_date" | "cancelled">): AssigneeIssueSlotInput {
  return {
    id: row.id,
    area: row.area,
    sourceName: row.source_name ?? "",
    dueDate: row.due_date,
    cancelled: row.cancelled,
  };
}

export const assigneeReviewYearSchema = z.coerce.number().int().min(2020).max(2100);

export const associateContentScheduleAssigneeSchema = z.object({
  area: z.string().trim().min(1).max(120),
  source_name: z.string().trim().min(1).max(500),
  collaborator_id: z.string().uuid(),
  mode: z.enum(["identity", "future_replacement"]),
}).strict();

export type AssociateContentScheduleAssigneeInput = z.infer<typeof associateContentScheduleAssigneeSchema>;

export async function getContentScheduleAssigneeReview(
  year = Number(currentSaoPauloDate().slice(0, 4))
): Promise<ContentScheduleAssigneeReviewResponse> {
  const parsedYear = assigneeReviewYearSchema.safeParse(year);
  if (!parsedYear.success) throw new ContentScheduleHttpError("Ano inválido.", 400, "INVALID_YEAR");

  const actor = await requireActor();
  ensureAssigneeManager(actor);
  const db = adminDb();
  const start = `${parsedYear.data}-01-01`;
  const end = `${parsedYear.data + 1}-01-01`;
  const [{ data: rawSlots, error: slotError }, collaborators, people] = await Promise.all([
    db.from("content_schedule_slots")
      .select("id,area,due_date,source_name,cancelled")
      .gte("due_date", start)
      .lt("due_date", end)
      .is("collaborator_id", null)
      .not("source_name", "is", null)
      .order("due_date"),
    loadCollaborators(db, actor.access),
    loadAssigneePeople(db),
  ]);
  if (slotError) throw new ContentScheduleHttpError("Não foi possível carregar os nomes pendentes.");

  const visibleSlots = ((rawSlots ?? []) as Array<Pick<SlotRow, "id" | "area" | "source_name" | "due_date" | "cancelled">>)
    .filter((row) => canAssignContentScheduleArea(actor.access, row.area));
  return {
    year: parsedYear.data,
    issues: classifyScheduleAssigneeIssues({
      slots: visibleSlots.map(assigneeSlotInput),
      people,
      today: currentSaoPauloDate(),
    }),
    collaborators,
    access: {
      canManage: actor.access.manageAll,
      assignableAreas: actor.access.manageableAreas,
      userId: actor.profileId,
    },
  };
}

export async function associateContentScheduleAssignee(
  input: AssociateContentScheduleAssigneeInput
): Promise<{ updated: number }> {
  const parsed = associateContentScheduleAssigneeSchema.safeParse(input);
  if (!parsed.success) throw new ContentScheduleHttpError("Revise a associação do responsável.", 400, "INVALID_INPUT");

  const actor = await requireActor();
  ensureAssigneeManager(actor);
  if (!canAssignContentScheduleArea(actor.access, parsed.data.area)) {
    throw new ContentScheduleHttpError("Você não gerencia esta área.", 403, "FORBIDDEN");
  }

  const db = adminDb();
  await assertCollaboratorInArea(db, parsed.data.collaborator_id, parsed.data.area);
  const [{ data: rawSlots, error: slotError }, people] = await Promise.all([
    db.from("content_schedule_slots")
      .select("id,area,due_date,source_name,cancelled")
      .eq("source_name", parsed.data.source_name)
      .is("collaborator_id", null)
      .eq("cancelled", false),
    loadAssigneePeople(db),
  ]);
  if (slotError) throw new ContentScheduleHttpError("Não foi possível localizar as tarefas desse nome.");

  const matchingRows = ((rawSlots ?? []) as Array<Pick<SlotRow, "id" | "area" | "source_name" | "due_date" | "cancelled">>)
    .filter((row) => sameScheduleArea(row.area, parsed.data.area));
  const [issue] = classifyScheduleAssigneeIssues({
    slots: matchingRows.map(assigneeSlotInput),
    people,
    today: currentSaoPauloDate(),
  });
  if (!issue) throw new ContentScheduleHttpError("Esse nome não possui tarefas pendentes.", 404, "NOT_FOUND");
  if (issue.mode !== parsed.data.mode) {
    throw new ContentScheduleHttpError("A forma de associação mudou. Atualize a tela e confira novamente.", 409, "STALE_ISSUE");
  }

  const destination = people.find((person) => person.id === parsed.data.collaborator_id);
  if (!destination?.isActive) {
    throw new ContentScheduleHttpError("Selecione um colaborador ativo da área.", 400, "INVALID_COLLABORATOR");
  }
  if (issue.mode === "identity" && !likelySamePerson(issue.sourceName, destination.name)) {
    throw new ContentScheduleHttpError("A pessoa escolhida não corresponde ao nome abreviado.", 409, "IDENTITY_MISMATCH");
  }

  const today = currentSaoPauloDate();
  const targetIds = matchingRows
    .filter((row) => issue.mode === "identity" || row.due_date >= today)
    .map((row) => row.id);
  if (!targetIds.length) return { updated: 0 };

  let update = db.from("content_schedule_slots")
    .update({ collaborator_id: parsed.data.collaborator_id })
    .in("id", targetIds)
    .is("collaborator_id", null)
    .eq("cancelled", false);
  if (issue.mode === "future_replacement") update = update.gte("due_date", today);
  const { data: updated, error: updateError } = await update.select("id");
  if (updateError) throw new ContentScheduleHttpError("Não foi possível associar o responsável.");
  return { updated: updated?.length ?? 0 };
}

export async function getContentSchedule(month = currentSaoPauloMonth()): Promise<ContentScheduleResponse> {
  const actor = await requireActor();
  const db = adminDb();
  const { start, end } = monthBounds(month);
  const [{ data: rawSlots, error: slotError }, collaborators] = await Promise.all([
    db.from("content_schedule_slots").select("*").gte("due_date", start).lt("due_date", end).order("due_date"),
    loadCollaborators(db, actor.access),
  ]);
  if (slotError) throw new ContentScheduleHttpError("Não foi possível carregar o cronograma.");
  const rows = ((rawSlots ?? []) as SlotRow[]).filter((row) => canReadContentScheduleSlot(actor.access, {
    area: row.area, collaboratorId: row.collaborator_id ?? "",
  }));

  const userIds = [...new Set(rows.map((row) => row.collaborator_id).filter(Boolean))] as string[];
  const roteiroIds = [...new Set(rows.map((row) => row.content_roteiro_id).filter(Boolean))] as string[];
  const reelIds = [...new Set(rows.map((row) => row.reel_studio_id).filter(Boolean))] as string[];
  const directPostIds = [...new Set(rows.map((row) => row.instagram_post_id).filter(Boolean))] as string[];
  const [usersResult, roteirosResult, reelsResult] = await Promise.all([
    userIds.length ? db.from("users").select("id,name,avatar_url").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    roteiroIds.length ? db.from("content_roteiros").select("id,title,marketing_request_id,vios_task_id").in("id", roteiroIds) : Promise.resolve({ data: [], error: null }),
    reelIds.length ? db.from("reel_studio_items").select("id,title").in("id", reelIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (usersResult.error || roteirosResult.error || reelsResult.error) throw new ContentScheduleHttpError("Não foi possível completar os dados do cronograma.");

  const requestIds = [...new Set((roteirosResult.data ?? []).map((r) => r.marketing_request_id).filter(Boolean))] as string[];
  const postRoteiroIds = new Set(
    rows
      .filter((row) => row.format === "post")
      .map((row) => row.content_roteiro_id)
      .filter(Boolean) as string[]
  );
  const viosTaskIds = [...new Set((roteirosResult.data ?? [])
    .filter((roteiro) => postRoteiroIds.has(roteiro.id))
    .map((roteiro) => roteiro.vios_task_id)
    .filter(Boolean))] as string[];
  const [requestResult, viosResult] = await Promise.all([
    requestIds.length
      ? db.from("marketing_requests").select("id,ig_media_id").in("id", requestIds)
      : Promise.resolve({ data: [], error: null }),
    viosTaskIds.length
      ? db.from("vios_tasks").select("id,vios_id,status,tarefa").in("id", viosTaskIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (requestResult.error) throw new ContentScheduleHttpError("Não foi possível carregar os vínculos de publicação.");
  if (viosResult.error) throw new ContentScheduleHttpError("Não foi possível carregar as tarefas VIOS.");
  const igMediaIds = [...new Set((requestResult.data ?? []).map((r) => r.ig_media_id).filter(Boolean))] as string[];
  const postResult = directPostIds.length || igMediaIds.length
    ? await db.from("instagram_posts").select("id,ig_media_id,permalink,published_at,caption,likes,comments,reach,views")
        .or([directPostIds.length ? `id.in.(${directPostIds.join(",")})` : "", igMediaIds.length ? `ig_media_id.in.(${igMediaIds.join(",")})` : ""].filter(Boolean).join(","))
    : { data: [], error: null };
  if (postResult.error) throw new ContentScheduleHttpError("Não foi possível carregar as publicações.");

  const users = new Map((usersResult.data ?? []).map((v) => [v.id, v]));
  const roteiros = new Map((roteirosResult.data ?? []).map((v) => [v.id, v]));
  const reels = new Map((reelsResult.data ?? []).map((v) => [v.id, v]));
  const viosTasks = new Map((viosResult.data ?? []).map((v) => [v.id, v]));
  const requests = new Map((requestResult.data ?? []).map((v) => [v.id, v]));
  const postsById = new Map((postResult.data ?? []).map((v) => [v.id, v]));
  const postsByMedia = new Map((postResult.data ?? []).map((v) => [v.ig_media_id, v]));

  const slots: ContentScheduleSlot[] = rows.map((row) => {
    const person = row.collaborator_id ? users.get(row.collaborator_id) : null;
    const roteiro = row.content_roteiro_id ? roteiros.get(row.content_roteiro_id) : null;
    const request = row.format === "post" && roteiro?.marketing_request_id ? requests.get(roteiro.marketing_request_id) : null;
    const viosTask = row.format === "post" && roteiro?.vios_task_id
      ? viosTasks.get(roteiro.vios_task_id)
      : null;
    const publication = (row.instagram_post_id ? postsById.get(row.instagram_post_id) : null) ??
      (request?.ig_media_id ? postsByMedia.get(request.ig_media_id) : null) ?? null;
    return {
      ...row,
      collaborator_name: person?.name ?? null,
      collaborator_avatar_url: person?.avatar_url ?? null,
      content_title: roteiro?.title ?? null,
      reel_title: row.reel_studio_id ? reels.get(row.reel_studio_id)?.title ?? null : null,
      publication,
      vios_task: viosTask ? {
        id: viosTask.id,
        ci: String(viosTask.vios_id),
        status: viosTask.status ?? null,
        title: viosTask.tarefa ?? null,
      } : null,
    } as ContentScheduleSlot;
  });

  let pendingLinks: ContentSchedulePendingLink[] = [];
  if (actor.access.manageAll) {
    const { data: links, error: linksError } = await db.from("content_schedule_links").select("*")
      .eq("status", "pending").order("event_date");
    if (linksError) throw new ContentScheduleHttpError("Não foi possível carregar as pendências.");
    const pendingUserIds = [...new Set((links ?? []).map((link) => link.collaborator_id))];
    const pendingRoteiroIds = [...new Set((links ?? []).map((link) => link.content_roteiro_id).filter(Boolean))] as string[];
    const pendingReelIds = [...new Set((links ?? []).map((link) => link.reel_studio_id).filter(Boolean))] as string[];
    const [pu, pr, pe] = await Promise.all([
      pendingUserIds.length ? db.from("users").select("id,name").in("id", pendingUserIds) : Promise.resolve({ data: [] }),
      pendingRoteiroIds.length ? db.from("content_roteiros").select("id,title").in("id", pendingRoteiroIds) : Promise.resolve({ data: [] }),
      pendingReelIds.length ? db.from("reel_studio_items").select("id,title").in("id", pendingReelIds) : Promise.resolve({ data: [] }),
    ]);
    const pun = new Map((pu.data ?? []).map((v) => [v.id, v.name]));
    const prt = new Map((pr.data ?? []).map((v) => [v.id, v.title]));
    const pet = new Map((pe.data ?? []).map((v) => [v.id, v.title]));
    pendingLinks = (links ?? []).map((link) => ({ ...link,
      collaborator_name: pun.get(link.collaborator_id) ?? null,
      source_title: (link.content_roteiro_id ? prt.get(link.content_roteiro_id) : pet.get(link.reel_studio_id)) ?? null,
    })) as ContentSchedulePendingLink[];
  }

  const areas = [...new Set([...slots.map((slot) => slot.area), ...collaborators.map((person) => person.department).filter(Boolean) as string[]])].sort();
  return { slots, collaborators, areas, access: {
    canManage: actor.access.manageAll,
    assignableAreas: actor.access.manageAll ? null : actor.access.manageableAreas,
    userId: actor.profileId,
  }, pendingLinks };
}

export interface CreateSlotInput {
  area: string; due_date: string; format: ContentScheduleFormat; collaborator_id?: string | null;
  source_key?: string; source_name?: string | null; source_status?: string | null; source_notes?: string | null;
}

const isoCivilDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Data inválida");

export const createContentScheduleSlotSchema = z.object({
  area: z.string().trim().min(1).max(120),
  due_date: isoCivilDateSchema,
  format: z.enum(["post", "reel"]),
  collaborator_id: z.string().uuid().nullable().optional(),
  source_key: z.string().trim().min(1).max(500).optional(),
  source_name: z.string().trim().max(500).nullable().optional(),
  source_status: z.string().trim().max(200).nullable().optional(),
  source_notes: z.string().trim().max(4_000).nullable().optional(),
}).strict();

function validateDate(value: string): void {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ContentScheduleHttpError("Data inválida.", 400, "INVALID_DATE");
  }
}

async function assertCollaboratorInArea(db: SupabaseClient, collaboratorId: string, area: string): Promise<void> {
  const [{ data }, { data: employee }] = await Promise.all([
    db.from("users").select("id,department,is_active").eq("id", collaboratorId).maybeSingle(),
    db.from("hr_employees").select("department,is_active").eq("user_id", collaboratorId).maybeSingle(),
  ]);
  const department = employee?.department ?? data?.department;
  if (!data || data.is_active === false || employee?.is_active === false || !sameScheduleArea(department, area)) {
    throw new ContentScheduleHttpError("Selecione um colaborador ativo da área.", 400, "INVALID_COLLABORATOR");
  }
}

export async function createContentScheduleSlots(inputs: CreateSlotInput[]): Promise<SlotRow[]> {
  const actor = await requireActor(); requireManager(actor);
  if (!inputs.length || inputs.length > 200) throw new ContentScheduleHttpError("Informe entre 1 e 200 vagas.", 400);
  const db = adminDb();
  for (const input of inputs) {
    if (!input || typeof input !== "object") throw new ContentScheduleHttpError("Vaga inválida.", 400);
    validateDate(input.due_date);
    if (typeof input.area !== "string" || !input.area.trim() || !["post", "reel"].includes(input.format)) throw new ContentScheduleHttpError("Revise área e formato.", 400);
    if (input.collaborator_id) await assertCollaboratorInArea(db, input.collaborator_id, input.area);
  }
  const payload = inputs.map((input) => ({ ...input, area: normalizeScheduleArea(input.area) ?? input.area.trim(),
    source_key: input.source_key?.trim() || `manual:${crypto.randomUUID()}`, created_by: actor.profileId }));
  const { data, error } = await db.from("content_schedule_slots").insert(payload).select("*");
  if (error) throw new ContentScheduleHttpError(error.code === "23505" ? "Essa vaga já foi importada." : "Não foi possível criar as vagas.", error.code === "23505" ? 409 : 500);
  return (data ?? []) as SlotRow[];
}

export type UpdateSlotInput = Partial<Omit<CreateSlotInput, "source_key">> & { cancelled?: boolean };

export const updateContentScheduleSlotSchema = createContentScheduleSlotSchema
  .omit({ source_key: true })
  .partial()
  .extend({ cancelled: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nenhuma alteração informada");

export async function updateContentScheduleSlot(id: string, input: UpdateSlotInput): Promise<SlotRow> {
  const actor = await requireActor();
  const db = adminDb();
  const { data: current } = await db.from("content_schedule_slots").select("*").eq("id", id).maybeSingle();
  if (!current) throw new ContentScheduleHttpError("Vaga não encontrada.", 404);
  const structural = ["area", "due_date", "format", "cancelled", "source_name", "source_status", "source_notes"]
    .some((key) => key in input);
  if (structural && !actor.access.manageAll) throw new ContentScheduleHttpError("Ação exclusiva do Marketing.", 403);
  if (input.format !== undefined && !["post", "reel"].includes(input.format)) throw new ContentScheduleHttpError("Formato inválido.", 400);
  if (input.area !== undefined && (typeof input.area !== "string" || !input.area.trim())) throw new ContentScheduleHttpError("Área inválida.", 400);
  if (input.cancelled !== undefined && typeof input.cancelled !== "boolean") throw new ContentScheduleHttpError("Situação inválida.", 400);
  if (input.collaborator_id !== undefined && input.collaborator_id !== null && typeof input.collaborator_id !== "string") throw new ContentScheduleHttpError("Colaborador inválido.", 400);
  const targetArea = input.area?.trim() || current.area;
  const changesLinkedIdentity = Boolean(current.content_roteiro_id || current.reel_studio_id) && (
    (input.area !== undefined && !sameScheduleArea(input.area, current.area)) ||
    (input.format !== undefined && input.format !== current.format) ||
    (input.collaborator_id !== undefined && input.collaborator_id !== current.collaborator_id)
  );
  if (changesLinkedIdentity) throw new ContentScheduleHttpError("Uma vaga com conteúdo vinculado não pode trocar de área, formato ou colaborador.", 409, "LINKED_SLOT");
  if (!structural && !canAssignContentScheduleArea(actor.access, current.area)) throw new ContentScheduleHttpError("Você não gerencia esta área.", 403);
  if (input.due_date) validateDate(input.due_date);
  const targetCollaborator = input.collaborator_id === undefined ? current.collaborator_id : input.collaborator_id;
  if (targetCollaborator) await assertCollaboratorInArea(db, targetCollaborator, targetArea);
  const updates = { ...input, ...(input.area ? { area: normalizeScheduleArea(input.area) ?? input.area.trim() } : {}) };
  const { data, error } = await db.from("content_schedule_slots").update(updates).eq("id", id)
    .eq("updated_at", current.updated_at).select("*").maybeSingle();
  if (error || !data) throw new ContentScheduleHttpError("A vaga foi alterada por outra pessoa. Atualize a tela e tente novamente.", 409, "STALE_SLOT");
  return data as SlotRow;
}

export async function linkPublicationToSlot(slotId: string, instagramPostId: string): Promise<void> {
  const actor = await requireActor(); requireManager(actor);
  const db = adminDb();
  const [{ data: post }, { data: slot }] = await Promise.all([
    db.from("instagram_posts").select("id,media_product_type,media_type,content_type").eq("id", instagramPostId).maybeSingle(),
    db.from("content_schedule_slots").select("id,format").eq("id", slotId).maybeSingle(),
  ]);
  if (!post) throw new ContentScheduleHttpError("Publicação não encontrada.", 404);
  if (!slot) throw new ContentScheduleHttpError("Vaga não encontrada.", 404);
  const mediaKind = `${post.media_product_type ?? ""} ${post.media_type ?? ""} ${post.content_type ?? ""}`.toLowerCase();
  const looksLikeReel = mediaKind.includes("reel");
  if ((slot.format === "reel") !== looksLikeReel) throw new ContentScheduleHttpError("O formato da publicação não corresponde à vaga.", 409);
  const { data: updated, error } = await db.from("content_schedule_slots").update({ instagram_post_id: instagramPostId }).eq("id", slotId).select("id").maybeSingle();
  if (error || !updated) throw new ContentScheduleHttpError("Não foi possível vincular a publicação.");
}

export async function resolvePendingScheduleLink(linkId: string, slotId: string): Promise<void> {
  const actor = await requireActor(); requireManager(actor);
  const db = adminDb();
  const { data: link } = await db.from("content_schedule_links").select("*").eq("id", linkId).eq("status", "pending").maybeSingle();
  if (!link) throw new ContentScheduleHttpError("Pendência não encontrada.", 404);
  const { data: slot } = await db.from("content_schedule_slots").select("id,area,format,collaborator_id,cancelled,content_roteiro_id,reel_studio_id").eq("id", slotId).maybeSingle();
  if (!slot || slot.cancelled || slot.format !== link.format || slot.collaborator_id !== link.collaborator_id || !sameScheduleArea(slot.area, link.area)) {
    throw new ContentScheduleHttpError("A vaga escolhida não corresponde ao colaborador, área e formato da pendência.", 409);
  }
  const column = link.format === "reel" ? "reel_studio_id" : "content_roteiro_id";
  const sourceId = link[column];
  const finish = async () => {
    const { error: linkError } = await db.from("content_schedule_links").update({ status: "resolved", resolved_slot_id: slotId }).eq("id", linkId);
    if (linkError) throw new ContentScheduleHttpError("O conteúdo foi ligado, mas a pendência não pôde ser encerrada.");
  };
  if (slot[column] === sourceId) {
    await finish();
    return;
  }
  const resolvedUpdates: Record<string, string> = { [column]: sourceId };
  if (link.format === "reel" && link.content_roteiro_id) resolvedUpdates.content_roteiro_id = link.content_roteiro_id;
  const { data: updated, error } = await db.from("content_schedule_slots").update(resolvedUpdates)
    .eq("id", slotId).eq("format", link.format).eq("collaborator_id", link.collaborator_id)
    .eq("area", slot.area).eq("cancelled", false).is(column, null).select("id").maybeSingle();
  if (error || !updated) {
    const { data: retrySlot } = await db.from("content_schedule_slots").select("content_roteiro_id,reel_studio_id").eq("id", slotId).maybeSingle();
    if (retrySlot?.[column] !== sourceId) throw new ContentScheduleHttpError("A vaga escolhida não é compatível ou já foi preenchida.", 409);
  }
  await finish();
}

export interface AutoLinkContentScheduleInput {
  collaboratorId: string; area: string; format: ContentScheduleFormat;
  contentRoteiroId?: string; reelStudioId?: string; eventDate?: string;
}

async function closePendingLink(
  db: SupabaseClient,
  input: AutoLinkContentScheduleInput,
  sourceId: string,
  slotId: string
): Promise<void> {
  let query = db.from("content_schedule_links").update({ status: "resolved", resolved_slot_id: slotId })
    .eq("collaborator_id", input.collaboratorId).eq("format", input.format).eq("status", "pending");
  query = input.format === "post" ? query.eq("content_roteiro_id", sourceId) : query.eq("reel_studio_id", sourceId);
  const { error } = await query;
  if (error) throw new ContentScheduleHttpError("O conteúdo foi ligado, mas a pendência não pôde ser encerrada.");
}

export async function autoLinkContentSchedule(input: AutoLinkContentScheduleInput) {
  const db = adminDb();
  const sourceId = input.format === "post" ? input.contentRoteiroId : input.reelStudioId;
  if (!sourceId) throw new ContentScheduleHttpError("Fonte do conteúdo ausente.", 400);
  const date = saoPauloCivilDate(input.eventDate); validateDate(date);

  if (input.format === "post") {
    const { data } = await db.from("content_roteiros").select("id,approved_by_id,area").eq("id", sourceId).maybeSingle();
    if (!data || data.approved_by_id !== input.collaboratorId || !sameScheduleArea(data.area, input.area)) {
      throw new ContentScheduleHttpError("O conteúdo não pertence ao colaborador e à área informados.", 403);
    }
  } else {
    const [{ data: reel }, { data: assignee }] = await Promise.all([
      db.from("reel_studio_items").select("id,area,source_content_id").eq("id", sourceId).maybeSingle(),
      db.from("reel_studio_assignees").select("user_id").eq("reel_id", sourceId).eq("user_id", input.collaboratorId).maybeSingle(),
    ]);
    if (!reel || !assignee || !sameScheduleArea(reel.area, input.area) ||
        (input.contentRoteiroId && reel.source_content_id !== input.contentRoteiroId)) {
      throw new ContentScheduleHttpError("O Reel não pertence ao colaborador e à área informados.", 403);
    }
  }

  const sourceColumn = input.format === "post" ? "content_roteiro_id" : "reel_studio_id";
  const { data: slots, error } = await db.from("content_schedule_slots").select("id,due_date,area,format,collaborator_id,cancelled,content_roteiro_id,reel_studio_id")
    .eq("collaborator_id", input.collaboratorId).eq("format", input.format);
  if (error) throw new ContentScheduleHttpError("Não foi possível localizar uma vaga.");
  const match = findAutomaticSlotMatch({ id: sourceId, date, area: input.area, format: input.format, collaboratorId: input.collaboratorId },
    (slots ?? []).map((slot) => ({ id: slot.id, date: slot.due_date, area: slot.area, format: slot.format,
      collaboratorId: slot.collaborator_id, contentId: slot[sourceColumn], cancelled: slot.cancelled })));
  if (match.status === "already_linked") {
    await closePendingLink(db, input, sourceId, match.slotId);
    return match;
  }
  if (match.status === "matched") {
    const updates: Record<string, string> = { [sourceColumn]: sourceId };
    if (input.contentRoteiroId && input.format === "reel") updates.content_roteiro_id = input.contentRoteiroId;
    const chosen = (slots ?? []).find((slot) => slot.id === match.slotId)!;
    const { data: won, error: updateError } = await db.from("content_schedule_slots").update(updates)
      .eq("id", match.slotId).eq("area", chosen.area).eq("format", input.format)
      .eq("collaborator_id", input.collaboratorId).eq("cancelled", false)
      .is(sourceColumn, null).select("id").maybeSingle();
    if (!updateError && won) {
      await closePendingLink(db, input, sourceId, match.slotId);
      return match;
    }
    if (!updateError) {
      const { data: winner, error: winnerError } = await db.from("content_schedule_slots").select("id")
        .eq("collaborator_id", input.collaboratorId).eq("format", input.format)
        .eq(sourceColumn, sourceId).maybeSingle();
      if (winnerError) throw new ContentScheduleHttpError("Não foi possível confirmar o vínculo concorrente.");
      if (winner) {
        await closePendingLink(db, input, sourceId, winner.id);
        return { status: "already_linked" as const, slotId: winner.id };
      }
    }
    if (updateError) throw new ContentScheduleHttpError("Não foi possível vincular o conteúdo à vaga.");
  }
  const reason = match.status === "ambiguous" ? "ambiguous" : match.status === "matched" ? "race_lost" : "no_slot";
  const pending = { collaborator_id: input.collaboratorId, area: input.area, format: input.format, event_date: date,
    content_roteiro_id: input.contentRoteiroId ?? null, reel_studio_id: input.reelStudioId ?? null, reason, status: "pending" };
  let existingQuery = db.from("content_schedule_links").select("id")
    .eq("collaborator_id", input.collaboratorId).eq("format", input.format);
  existingQuery = input.format === "post"
    ? existingQuery.eq("content_roteiro_id", sourceId)
    : existingQuery.eq("reel_studio_id", sourceId);
  const { data: existing } = await existingQuery.maybeSingle();
  const pendingResult = existing
    ? await db.from("content_schedule_links").update(pending).eq("id", existing.id)
    : await db.from("content_schedule_links").insert(pending);
  const pendingError = pendingResult.error;
  // Um retry simultâneo pode perder a corrida do índice único; o outro request já persistiu a pendência.
  if (pendingError?.code === "23505") return match.status === "matched" ? { status: "not_found" as const } : match;
  if (pendingError) throw new ContentScheduleHttpError("Não foi possível registrar a pendência de vínculo.");
  return match.status === "matched" ? { status: "not_found" as const } : match;
}

export async function getContentSimilarity(contentId: string): Promise<ContentScheduleWarning[]> {
  const actor = await requireActor();
  const db = adminDb();
  const { data: source, error: sourceError } = await db.from("content_roteiros").select("id,title,link,post,area,approved_by_id,created_by_id").eq("id", contentId).maybeSingle();
  if (sourceError) throw new ContentScheduleHttpError("Não foi possível analisar esse conteúdo.");
  if (!source) throw new ContentScheduleHttpError("Conteúdo não encontrado.", 404);
  if (!canSeeContentRoteiro({ id: actor.profileId, role: actor.role, department: actor.department }, {
    area: source.area, createdById: source.created_by_id,
  })) {
    throw new ContentScheduleHttpError("Você não tem acesso a esse conteúdo.", 403);
  }
  const [roteiroResult, postResult, reelResult] = await Promise.all([
    db.from("content_roteiros").select("id,title,link,post,status,approved_by_name,approved_at").neq("id", contentId)
      .or("approved_at.not.is.null,status.in.(aprovado,em_revisao,aprovado_revisor,enviado_mkt)").limit(500),
    db.from("instagram_posts").select("id,caption,permalink,published_at,solicitante").order("published_at", { ascending: false }).limit(500),
    db.from("reel_studio_items").select("id,title,original_script,source_content_id,created_at").order("created_at", { ascending: false }).limit(500),
  ]);
  if (roteiroResult.error || postResult.error || reelResult.error) throw new ContentScheduleHttpError("Não foi possível consultar o histórico de conteúdo.");
  const roteiros = roteiroResult.data ?? [];
  const posts = postResult.data ?? [];
  const reelItems = reelResult.data ?? [];
  const candidates: ContentSimilarityCandidate[] = [
    ...(roteiros ?? []).map((r) => ({ id: `roteiro:${r.id}`, status: "in_production" as const, sourceUrl: r.link, title: r.title, text: r.post })),
    ...(posts ?? []).map((p) => ({ id: `instagram:${p.id}`, status: "published" as const, sourceUrl: p.permalink, title: p.caption, text: p.caption })),
    ...(reelItems ?? []).map((r) => ({ id: `reel:${r.id}`, status: "in_production" as const, title: r.title, text: r.original_script })),
  ];
  const warningRows = findContentSimilarityWarnings({ sourceUrl: source.link, title: source.title, text: source.post }, candidates);
  const metadata = new Map<string, { title: string; publishedAt?: string; url?: string; collaboratorName?: string }>();
  for (const r of roteiros ?? []) metadata.set(`roteiro:${r.id}`, { title: r.title, publishedAt: r.approved_at ?? undefined, collaboratorName: r.approved_by_name ?? undefined });
  for (const p of posts ?? []) metadata.set(`instagram:${p.id}`, { title: p.caption?.slice(0, 180) || "Publicação no Instagram", publishedAt: p.published_at ?? undefined, url: p.permalink ?? undefined, collaboratorName: p.solicitante ?? undefined });
  for (const r of reelItems ?? []) metadata.set(`reel:${r.id}`, { title: r.title });
  return warningRows.map((warning) => { const item = metadata.get(warning.candidateId)!; return {
    id: warning.candidateId, title: item.title, kind: warning.kind,
    evidence: warning.evidence.map((value) => value === "source_url" ? "Mesma fonte" : "Termos relevantes em comum"),
    status: warning.candidateStatus, publishedAt: item.publishedAt, url: item.url, collaboratorName: item.collaboratorName,
  }; });
}

export function toContentScheduleApiError(error: unknown): { message: string; status: number; code?: string } {
  if (error instanceof ContentScheduleHttpError) return { message: error.message, status: error.status, code: error.code };
  console.error("[content-schedule]", error);
  return { message: "Não foi possível concluir a operação.", status: 500 };
}
