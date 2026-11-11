import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { canEditDocumentario, hasDocumentarioAccess, isAdminRole } from "@/lib/access-control";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import {
  ARCHIVE_USES,
  DOC_BUCKET,
  DOC_DEFAULT_SLUG,
  archiveCode,
  todayInSaoPaulo,
  type DocApprovalItem,
  type DocArchiveItem,
  type DocArchiveSummary,
  type DocBoard,
  type DocChecklistItem,
  type DocComment,
  type DocDecision,
  type DocEventInfo,
  type DocPerson,
  type DocProject,
  type DocProjectVersion,
  type DocQuestion,
  type DocSection,
  type DocSectionVersion,
  type DocShoot,
  type DocShootCheck,
  type DocTake,
  type DocTeamMember,
  type DocViewer,
} from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const LOG = "documentario";
/** Links assinados do acervo: 2 h (a tela recarrega a lista quando precisa). */
const SIGNED_SECONDS = 2 * 60 * 60;

export class DocHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "DocHttpError";
  }
}

export function toDocApiError(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof DocHttpError) return { status: error.status, body: { error: error.message, code: error.code } };
  if (error instanceof z.ZodError) {
    return { status: 400, body: { error: "Dados inválidos. Confira os campos e tente de novo.", code: "INVALID" } };
  }
  console.error(`[${LOG}]`, error);
  return { status: 500, body: { error: "Erro interno.", code: "INTERNAL" } };
}

function createDocAdminClient(): SupabaseClient {
  if (!serviceKey) throw new DocHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function fail(context: string, error: unknown): never {
  console.error(`[${LOG}] ${context}:`, error);
  throw new DocHttpError("Não foi possível concluir. Tente de novo.", 500, "QUERY_FAILED");
}

interface ViewerBase {
  user_id: string;
  name: string;
  is_admin: boolean;
  can_edit: boolean;
}

/** Sessão + acesso ao documentário (admin ou chave /documentario). */
async function requireViewer(db: SupabaseClient): Promise<ViewerBase> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new DocHttpError("Não autenticado.", 401, "UNAUTHENTICATED");
  const { data, error } = await db.from("users").select("id, name, role, permissions, is_active").eq("auth_id", user.id).maybeSingle();
  if (error || !data) throw new DocHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  if (data.is_active === false) throw new DocHttpError("Usuário inativo.", 403, "FORBIDDEN");
  const profile = { role: data.role as string | null, permissions: (data.permissions as string[] | null) ?? null };
  if (!hasDocumentarioAccess(profile)) throw new DocHttpError("Você não tem acesso ao documentário.", 403, "FORBIDDEN");
  return {
    user_id: data.id as string,
    name: (data.name as string) ?? "",
    is_admin: isAdminRole(profile),
    can_edit: canEditDocumentario(profile),
  };
}

function requireEditor(viewer: ViewerBase): void {
  if (!viewer.can_edit) throw new DocHttpError("Só a equipe de produção altera o projeto.", 403, "READ_ONLY");
}

async function loadProject(db: SupabaseClient, slug = DOC_DEFAULT_SLUG): Promise<DocProject> {
  const { data, error } = await db
    .from("documentary_projects")
    .select(
      "id, slug, eyebrow, title, subtitle, tagline, signature, version_label, status_label, usage_note, access_note, event_id, event_task_id, festa_target_seconds, extended_target_seconds, updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail("projeto", error);
  if (!data) throw new DocHttpError("Projeto não encontrado.", 404, "NOT_FOUND");
  return data as DocProject & { event_task_id: string | null };
}

async function usersById(db: SupabaseClient, ids: Iterable<string | null | undefined>) {
  const unique = [...new Set([...ids].filter(Boolean) as string[])];
  const map = new Map<string, { name: string; avatar_url: string | null }>();
  if (!unique.length) return map;
  const { data, error } = await db.from("users").select("id, name, avatar_url, photo_onedrive_url").in("id", unique);
  if (error) console.error(`[${LOG}] usuários:`, error);
  for (const row of data ?? []) {
    map.set(row.id as string, {
      name: row.name as string,
      avatar_url: resolveEmployeeAvatarUrl(row.avatar_url as string | null, row.photo_onedrive_url as string | null),
    });
  }
  return map;
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => !["da", "de", "do", "das", "dos", "e"].includes(part.toLowerCase()));
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : name.trim();
}

async function loadEvent(db: SupabaseClient, project: DocProject & { event_task_id?: string | null }): Promise<DocEventInfo | null> {
  if (!project.event_id) return null;
  const [eventResult, scheduleResult, taskResult] = await Promise.all([
    db.from("events").select("id, name, event_date, location").eq("id", project.event_id).maybeSingle(),
    db
      .from("event_schedule_items")
      .select("start_time, end_time, title, note, removed, event_schedules!inner(name, is_official)")
      .eq("event_id", project.event_id)
      .eq("event_schedules.is_official", true)
      .eq("removed", false)
      .ilike("title", "%vídeo%"),
    project.event_task_id
      ? db.from("event_tasks").select("id, title, status").eq("id", project.event_task_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (eventResult.error || !eventResult.data) return null;
  if (scheduleResult.error) console.error(`[${LOG}] cronograma:`, scheduleResult.error);
  const slotRow = (scheduleResult.data ?? [])[0] as
    | { start_time: string | null; end_time: string | null; title: string; note: string | null; event_schedules: { name: string } | { name: string }[] }
    | undefined;
  const scheduleName = slotRow ? (Array.isArray(slotRow.event_schedules) ? slotRow.event_schedules[0]?.name : slotRow.event_schedules?.name) : null;
  return {
    id: eventResult.data.id as string,
    name: eventResult.data.name as string,
    event_date: (eventResult.data.event_date as string | null) ?? null,
    location: (eventResult.data.location as string | null) ?? null,
    slot: slotRow
      ? { start_time: slotRow.start_time, end_time: slotRow.end_time, title: slotRow.title, note: slotRow.note, schedule_name: scheduleName ?? "Cronograma oficial" }
      : null,
    task: (taskResult.data as DocEventInfo["task"]) ?? null,
  };
}

/* ------------------------------------------------------------------ leitura */

function mapDecision(row: Record<string, unknown>, people: Map<string, { name: string }>): DocDecision {
  return {
    id: row.id as string,
    item_id: row.item_id as string,
    person_key: row.person_key as string,
    status: row.status as DocDecision["status"],
    note: (row.note as string | null) ?? null,
    decided_on: (row.decided_on as string | null) ?? null,
    project_version: (row.project_version as string | null) ?? null,
    recorded_by_name: row.recorded_by ? shortName(people.get(row.recorded_by as string)?.name ?? "") || null : null,
    created_at: row.created_at as string,
  };
}

async function loadApprovals(db: SupabaseClient, projectId: string): Promise<DocApprovalItem[]> {
  const items = await db
    .from("documentary_approval_items")
    .select("id, stage, sort, title, context, sensitive, approvers, source")
    .eq("project_id", projectId)
    .order("sort");
  if (items.error) fail("aprovações", items.error);
  const ids = (items.data ?? []).map((item) => item.id as string);
  const decisions = ids.length
    ? await db
        .from("documentary_approval_decisions")
        .select("id, item_id, person_key, status, note, decided_on, project_version, recorded_by, created_at")
        .in("item_id", ids)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (decisions.error) fail("decisões", decisions.error);
  const people = await usersById(db, (decisions.data ?? []).map((row) => row.recorded_by as string | null));
  return (items.data ?? []).map((item) => ({
    ...(item as Omit<DocApprovalItem, "decisions">),
    decisions: (decisions.data ?? []).filter((row) => row.item_id === item.id).map((row) => mapDecision(row, people)),
  }));
}

function mapShoot(row: Record<string, unknown>): DocShoot {
  return {
    ...(row as unknown as DocShoot),
    start_time: row.start_time ? String(row.start_time).slice(0, 5) : null,
    end_time: row.end_time ? String(row.end_time).slice(0, 5) : null,
    participants: Array.isArray(row.participants) ? (row.participants as DocShoot["participants"]) : [],
    person_keys: (row.person_keys as string[]) ?? [],
  };
}

const SHOOT_COLUMNS =
  "id, kind, title, person_keys, estimate, optional, scheduled_date, start_time, end_time, location, participants, status, notes, timer_started_at, timer_elapsed_seconds, sort";
const QUESTION_COLUMNS = "id, audience, sort, text, note, sensitive, approval_item_id, priority, added_on_day";
const ARCHIVE_COLUMNS =
  "id, seq, storage_path, thumb_path, file_name, mime_type, size_bytes, kind, width, height, year, year_approx, date_note, description, people, category, source, authorization_status, allowed_uses, chapters, status, status_note, created_by, created_at";

async function loadShoots(db: SupabaseClient, projectId: string): Promise<DocShoot[]> {
  const { data, error } = await db.from("documentary_shoots").select(SHOOT_COLUMNS).eq("project_id", projectId).order("sort");
  if (error) fail("gravações", error);
  return (data ?? []).map(mapShoot);
}

async function loadSections(db: SupabaseClient, projectId: string): Promise<DocSection[]> {
  const { data, error } = await db
    .from("documentary_sections")
    .select("id, slug, number, title, body, sort, version, updated_at, updated_by")
    .eq("project_id", projectId)
    .order("sort");
  if (error) fail("seções", error);
  const people = await usersById(db, (data ?? []).map((row) => row.updated_by as string | null));
  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    number: (row.number as string | null) ?? null,
    title: row.title as string,
    body: row.body as string,
    sort: row.sort as number,
    version: row.version as number,
    updated_at: row.updated_at as string,
    updated_by_name: row.updated_by ? shortName(people.get(row.updated_by as string)?.name ?? "") || null : null,
  }));
}

async function loadComments(db: SupabaseClient, projectId: string): Promise<DocComment[]> {
  const { data, error } = await db
    .from("documentary_comments")
    .select("id, section_id, body, author_user_id, created_at, resolved_at")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) fail("comentários", error);
  const people = await usersById(db, (data ?? []).map((row) => row.author_user_id as string | null));
  return (data ?? []).map((row) => {
    const author = row.author_user_id ? people.get(row.author_user_id as string) : undefined;
    return {
      id: row.id as string,
      section_id: (row.section_id as string | null) ?? null,
      body: row.body as string,
      author_user_id: (row.author_user_id as string | null) ?? null,
      author_name: author ? shortName(author.name) : null,
      author_avatar: author?.avatar_url ?? null,
      created_at: row.created_at as string,
      resolved_at: (row.resolved_at as string | null) ?? null,
    };
  });
}

async function loadVersions(db: SupabaseClient, projectId: string): Promise<DocProjectVersion[]> {
  const { data, error } = await db
    .from("documentary_project_versions")
    .select("id, version_label, note, section_versions, created_by, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) fail("versões", error);
  const people = await usersById(db, (data ?? []).map((row) => row.created_by as string | null));
  return (data ?? []).map((row) => ({
    id: row.id as string,
    version_label: row.version_label as string,
    note: (row.note as string | null) ?? null,
    section_versions: (row.section_versions as Record<string, number>) ?? {},
    created_at: row.created_at as string,
    created_by_name: row.created_by ? shortName(people.get(row.created_by as string)?.name ?? "") || null : null,
  }));
}

async function loadChecklist(db: SupabaseClient, projectId: string): Promise<{ items: DocChecklistItem[]; checks: DocShootCheck[] }> {
  const [items, checks] = await Promise.all([
    db.from("documentary_checklist_items").select("id, phase, sort, text, done_at, done_by").eq("project_id", projectId).order("sort"),
    db.from("documentary_shoot_checks").select("shoot_id, item_id, done_at, documentary_shoots!inner(project_id)").eq("documentary_shoots.project_id", projectId),
  ]);
  if (items.error) fail("checklist", items.error);
  if (checks.error) fail("checklist do dia", checks.error);
  const people = await usersById(db, (items.data ?? []).map((row) => row.done_by as string | null));
  return {
    items: (items.data ?? []).map((row) => ({
      id: row.id as string,
      phase: row.phase as DocChecklistItem["phase"],
      sort: row.sort as number,
      text: row.text as string,
      done_at: (row.done_at as string | null) ?? null,
      done_by_name: row.done_by ? shortName(people.get(row.done_by as string)?.name ?? "") || null : null,
    })),
    checks: (checks.data ?? []).map((row) => ({ shoot_id: row.shoot_id as string, item_id: row.item_id as string, done_at: row.done_at as string })),
  };
}

async function loadTakes(db: SupabaseClient, projectId: string): Promise<DocTake[]> {
  const { data, error } = await db
    .from("documentary_question_takes")
    .select("question_id, shoot_id, asked, asked_at, time_mark, strong, note, documentary_shoots!inner(project_id)")
    .eq("documentary_shoots.project_id", projectId);
  if (error) fail("perguntas feitas", error);
  return (data ?? []).map((row) => ({
    question_id: row.question_id as string,
    shoot_id: row.shoot_id as string,
    asked: row.asked as boolean,
    asked_at: (row.asked_at as string | null) ?? null,
    time_mark: (row.time_mark as string | null) ?? null,
    strong: row.strong as boolean,
    note: (row.note as string | null) ?? null,
  }));
}

/** Pessoas ativas do sistema, para escolher quem participa de cada gravação. */
async function loadTeam(db: SupabaseClient): Promise<DocTeamMember[]> {
  const { data, error } = await db.from("users").select("id, name, avatar_url, photo_onedrive_url, is_active").eq("is_active", true).order("name");
  if (error) fail("equipe", error);
  return (data ?? [])
    .filter((row) => !/fênix agendador/i.test(row.name as string))
    .map((row) => ({
      user_id: row.id as string,
      name: row.name as string,
      short_name: shortName(row.name as string),
      avatar_url: resolveEmployeeAvatarUrl(row.avatar_url as string | null, row.photo_onedrive_url as string | null),
    }));
}

async function archiveSummary(db: SupabaseClient, projectId: string): Promise<DocArchiveSummary> {
  const { data, error } = await db.from("documentary_archive_items").select("status").eq("project_id", projectId);
  if (error) fail("acervo", error);
  const rows = data ?? [];
  return {
    total: rows.length,
    aprovado: rows.filter((row) => row.status === "aprovado").length,
    pendente: rows.filter((row) => row.status === "pendente").length,
    nao_utilizavel: rows.filter((row) => row.status === "nao_utilizavel").length,
  };
}

export async function loadDocBoard(slug = DOC_DEFAULT_SLUG): Promise<DocBoard> {
  const db = createDocAdminClient();
  const viewerBase = await requireViewer(db);
  const project = await loadProject(db, slug);
  const [event, peopleResult, sections, versions, comments, approvals, shoots, questionsResult, takes, checklist, summary, team] = await Promise.all([
    loadEvent(db, project),
    db.from("documentary_people").select("key, name, short_name, user_id, is_approver, sort").eq("project_id", project.id).order("sort"),
    loadSections(db, project.id),
    loadVersions(db, project.id),
    loadComments(db, project.id),
    loadApprovals(db, project.id),
    loadShoots(db, project.id),
    db.from("documentary_questions").select(QUESTION_COLUMNS).eq("project_id", project.id).order("sort"),
    loadTakes(db, project.id),
    loadChecklist(db, project.id),
    archiveSummary(db, project.id),
    loadTeam(db),
  ]);
  if (peopleResult.error) fail("pessoas", peopleResult.error);
  if (questionsResult.error) fail("perguntas", questionsResult.error);
  const teamById = new Map(team.map((member) => [member.user_id, member]));
  const people: DocPerson[] = (peopleResult.data ?? []).map((row) => ({
    key: row.key as string,
    name: row.name as string,
    short_name: row.short_name as string,
    user_id: (row.user_id as string | null) ?? null,
    avatar_url: row.user_id ? teamById.get(row.user_id as string)?.avatar_url ?? null : null,
    is_approver: row.is_approver as boolean,
  }));
  const viewer: DocViewer = {
    ...viewerBase,
    person_key: people.find((person) => person.user_id === viewerBase.user_id)?.key ?? null,
  };
  const { event_task_id: _taskId, ...projectPublic } = project as DocProject & { event_task_id?: string | null };
  void _taskId;
  return {
    project: projectPublic,
    event,
    people,
    sections,
    versions,
    comments,
    approvals,
    shoots,
    questions: (questionsResult.data ?? []) as DocQuestion[],
    takes,
    checklist: checklist.items,
    shootChecks: checklist.checks,
    archiveSummary: summary,
    team,
    viewer,
  };
}

/* ------------------------------------------------------------------ acervo */

async function mapArchive(db: SupabaseClient, rows: Record<string, unknown>[]): Promise<DocArchiveItem[]> {
  const paths = rows.flatMap((row) => [row.storage_path as string, row.thumb_path as string | null].filter(Boolean) as string[]);
  const signed = new Map<string, string>();
  for (let index = 0; index < paths.length; index += 500) {
    const chunk = paths.slice(index, index + 500);
    const { data, error } = await db.storage.from(DOC_BUCKET).createSignedUrls(chunk, SIGNED_SECONDS);
    if (error) console.error(`[${LOG}] links assinados:`, error);
    for (const item of data ?? []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }
  const people = await usersById(db, rows.map((row) => row.created_by as string | null));
  return rows.map((row) => ({
    id: row.id as string,
    seq: Number(row.seq),
    code: archiveCode(Number(row.seq)),
    file_name: row.file_name as string,
    mime_type: (row.mime_type as string | null) ?? null,
    size_bytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    kind: row.kind as DocArchiveItem["kind"],
    width: (row.width as number | null) ?? null,
    height: (row.height as number | null) ?? null,
    year: (row.year as number | null) ?? null,
    year_approx: row.year_approx as boolean,
    date_note: (row.date_note as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    people: Array.isArray(row.people) ? (row.people as DocArchiveItem["people"]) : [],
    category: (row.category as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    authorization_status: row.authorization_status as DocArchiveItem["authorization_status"],
    allowed_uses: (row.allowed_uses as string[]) ?? [],
    chapters: (row.chapters as string[]) ?? [],
    status: row.status as DocArchiveItem["status"],
    status_note: (row.status_note as string | null) ?? null,
    created_at: row.created_at as string,
    created_by_name: row.created_by ? shortName(people.get(row.created_by as string)?.name ?? "") || null : null,
    thumb_url: row.thumb_path ? signed.get(row.thumb_path as string) ?? null : null,
    file_url: signed.get(row.storage_path as string) ?? null,
  }));
}

export async function loadDocArchive(slug = DOC_DEFAULT_SLUG): Promise<DocArchiveItem[]> {
  const db = createDocAdminClient();
  await requireViewer(db);
  const project = await loadProject(db, slug);
  const { data, error } = await db
    .from("documentary_archive_items")
    .select(ARCHIVE_COLUMNS)
    .eq("project_id", project.id)
    .order("year", { ascending: true, nullsFirst: false })
    .order("seq");
  if (error) fail("acervo", error);
  return mapArchive(db, (data ?? []) as Record<string, unknown>[]);
}

/** Link assinado de um arquivo do acervo (abrir ou baixar com o nome original). */
export async function signedArchiveUrl(itemId: string, download: boolean): Promise<string> {
  const db = createDocAdminClient();
  await requireViewer(db);
  const { data, error } = await db.from("documentary_archive_items").select("storage_path, file_name").eq("id", itemId).maybeSingle();
  if (error) fail("arquivo", error);
  if (!data) throw new DocHttpError("Arquivo não encontrado.", 404, "NOT_FOUND");
  const signed = await db.storage
    .from(DOC_BUCKET)
    .createSignedUrl(data.storage_path as string, 10 * 60, download ? { download: data.file_name as string } : undefined);
  if (signed.error || !signed.data?.signedUrl) fail("link assinado", signed.error);
  return signed.data.signedUrl;
}

/** Resumo para o cartão na página do evento. */
export async function loadDocSummaryForEvent(eventId: string) {
  const db = createDocAdminClient();
  await requireViewer(db);
  const { data, error } = await db.from("documentary_projects").select("id, slug, title").eq("event_id", eventId).maybeSingle();
  if (error) fail("resumo", error);
  if (!data) return null;
  const [approvals, shoots, summary] = await Promise.all([
    loadApprovals(db, data.id as string),
    loadShoots(db, data.id as string),
    archiveSummary(db, data.id as string),
  ]);
  const pending = approvals.reduce(
    (total, item) => total + item.approvers.filter((key) => (item.decisions.find((decision) => decision.person_key === key)?.status ?? "pendente") === "pendente").length,
    0,
  );
  return {
    slug: data.slug as string,
    title: data.title as string,
    pendingDecisions: pending,
    shootsScheduled: shoots.filter((shoot) => shoot.status === "marcada" || shoot.status === "realizada").length,
    shootsTotal: shoots.filter((shoot) => shoot.status !== "cancelada").length,
    archiveTotal: summary.total,
  };
}

/* ------------------------------------------------------------------ escrita */

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const personKey = z.string().regex(/^[a-z0-9_-]{2,40}$/);
const participant = z.object({ name: text(120).min(1), user_id: z.string().uuid().nullable(), role: optionalText(60) });
const archivePerson = z.object({ name: text(120).min(1), user_id: z.string().uuid().nullable() });
const usesEnum = z.enum(ARCHIVE_USES.map((use) => use.key) as [string, ...string[]]);

const archiveFields = z.object({
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  year_approx: z.boolean().optional(),
  date_note: optionalText(120).optional(),
  description: optionalText(2000).optional(),
  people: z.array(archivePerson).max(60).optional(),
  category: optionalText(60).optional(),
  source: optionalText(200).optional(),
  authorization_status: z.enum(["pendente", "autorizado", "nao_autorizado", "nao_precisa"]).optional(),
  allowed_uses: z.array(usesEnum).max(10).optional(),
  chapters: z.array(text(60)).max(10).optional(),
  status: z.enum(["pendente", "aprovado", "nao_utilizavel"]).optional(),
  status_note: optionalText(500).optional(),
});

const storagePath = z.string().regex(/^acervo\/[0-9a-f-]{36}\/[A-Za-z0-9._\/-]{3,300}$/);

export const docActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("section.save"), sectionId: z.string().uuid(), title: text(200).min(2), body: z.string().max(60000), note: optionalText(500) }),
  z.object({ action: z.literal("section.history"), sectionId: z.string().uuid() }),
  z.object({ action: z.literal("section.restore"), sectionId: z.string().uuid(), version: z.number().int().min(1) }),
  z.object({
    action: z.literal("project.update"),
    title: text(200).min(2),
    subtitle: optionalText(300),
    tagline: optionalText(300),
    signature: optionalText(200),
    status_label: optionalText(200),
  }),
  z.object({ action: z.literal("project.closeVersion"), label: z.string().trim().regex(/^\d+(\.\d+){1,2}$/), note: text(1000).min(3) }),
  z.object({ action: z.literal("comment.add"), sectionId: z.string().uuid(), body: text(4000).min(1) }),
  z.object({ action: z.literal("comment.resolve"), id: z.string().uuid(), resolved: z.boolean() }),
  z.object({ action: z.literal("comment.delete"), id: z.string().uuid() }),
  z.object({
    action: z.literal("approval.decide"),
    itemId: z.string().uuid(),
    personKey,
    status: z.enum(["pendente", "aprovado", "ajustar", "recusado"]),
    note: optionalText(2000),
    decidedOn: isoDate.nullable(),
  }),
  z.object({
    action: z.literal("approval.save"),
    id: z.string().uuid().optional(),
    stage: z.enum(["validacao", "editorial", "producao"]),
    title: text(300).min(3),
    context: optionalText(3000),
    sensitive: z.boolean(),
    approvers: z.array(personKey).min(1).max(5),
  }),
  z.object({ action: z.literal("approval.delete"), id: z.string().uuid() }),
  z.object({
    action: z.literal("shoot.save"),
    id: z.string().uuid().optional(),
    kind: z.enum(["pre_entrevista", "entrevista", "conversa_conjunta", "broll", "outro"]),
    title: text(200).min(3),
    person_keys: z.array(personKey).max(5),
    estimate: optionalText(60),
    optional: z.boolean(),
    scheduled_date: isoDate.nullable(),
    start_time: hhmm.nullable(),
    end_time: hhmm.nullable(),
    location: optionalText(300),
    participants: z.array(participant).max(30),
    status: z.enum(["a_marcar", "marcada", "realizada", "cancelada"]),
    notes: optionalText(3000),
  }),
  z.object({ action: z.literal("shoot.delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("shoot.timer"), id: z.string().uuid(), op: z.enum(["start", "pause", "reset"]) }),
  z.object({
    action: z.literal("question.save"),
    id: z.string().uuid().optional(),
    audience: z.enum(["ricardo", "gustavo", "comum", "aprofundamento"]),
    text: text(1000).min(3),
    note: optionalText(1000),
    sensitive: z.boolean(),
    approval_item_id: z.string().uuid().nullable(),
    added_on_day: z.boolean().optional(),
  }),
  z.object({ action: z.literal("question.priority"), id: z.string().uuid(), priority: z.boolean() }),
  z.object({ action: z.literal("question.move"), id: z.string().uuid(), direction: z.enum(["up", "down"]) }),
  z.object({ action: z.literal("question.delete"), id: z.string().uuid() }),
  z.object({
    action: z.literal("take.save"),
    questionId: z.string().uuid(),
    shootId: z.string().uuid(),
    asked: z.boolean().optional(),
    time_mark: optionalText(20).optional(),
    strong: z.boolean().optional(),
    note: optionalText(2000).optional(),
  }),
  z.object({ action: z.literal("checklist.toggle"), itemId: z.string().uuid(), done: z.boolean() }),
  z.object({ action: z.literal("shootCheck.toggle"), shootId: z.string().uuid(), itemId: z.string().uuid(), done: z.boolean() }),
  z.object({
    action: z.literal("archive.create"),
    items: z
      .array(
        archiveFields.extend({
          storage_path: storagePath,
          thumb_path: storagePath.nullable(),
          file_name: text(300).min(1),
          mime_type: optionalText(120),
          size_bytes: z.number().int().min(0).nullable(),
          kind: z.enum(["foto", "video", "audio", "documento"]),
          width: z.number().int().min(1).max(100000).nullable(),
          height: z.number().int().min(1).max(100000).nullable(),
        }),
      )
      .min(1)
      .max(100),
  }),
  z.object({ action: z.literal("archive.update"), id: z.string().uuid(), fields: archiveFields }),
  z.object({ action: z.literal("archive.bulk"), ids: z.array(z.string().uuid()).min(1).max(500), fields: archiveFields }),
  z.object({ action: z.literal("archive.delete"), ids: z.array(z.string().uuid()).min(1).max(200) }),
]);

export type DocAction = z.infer<typeof docActionSchema>;

async function sectionOfProject(db: SupabaseClient, projectId: string, sectionId: string) {
  const { data, error } = await db
    .from("documentary_sections")
    .select("id, slug, title, body, version")
    .eq("id", sectionId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) fail("seção", error);
  if (!data) throw new DocHttpError("Seção não encontrada.", 404, "NOT_FOUND");
  return data as { id: string; slug: string; title: string; body: string; version: number };
}

async function writeSectionVersion(
  db: SupabaseClient,
  project: DocProject,
  section: { id: string; version: number },
  title: string,
  body: string,
  note: string | null,
  userId: string,
) {
  const next = section.version + 1;
  const update = await db
    .from("documentary_sections")
    .update({ title, body, version: next, updated_by: userId })
    .eq("id", section.id)
    .eq("version", section.version)
    .select("id");
  if (update.error) fail("salvar seção", update.error);
  if (!update.data?.length) throw new DocHttpError("Alguém salvou esta seção agora há pouco. Recarregue a página e confira.", 409, "CONFLICT");
  const inserted = await db.from("documentary_section_versions").insert({
    section_id: section.id,
    version: next,
    title,
    body,
    note,
    project_version: project.version_label,
    created_by: userId,
  });
  if (inserted.error) fail("versão da seção", inserted.error);
}

async function ensureItemInProject(db: SupabaseClient, table: string, id: string, projectId: string) {
  const { data, error } = await db.from(table).select("id").eq("id", id).eq("project_id", projectId).maybeSingle();
  if (error) fail(table, error);
  if (!data) throw new DocHttpError("Item não encontrado.", 404, "NOT_FOUND");
}

async function loadQuestion(db: SupabaseClient, id: string): Promise<DocQuestion> {
  const { data, error } = await db.from("documentary_questions").select(QUESTION_COLUMNS).eq("id", id).maybeSingle();
  if (error) fail("pergunta", error);
  if (!data) throw new DocHttpError("Pergunta não encontrada.", 404, "NOT_FOUND");
  return data as DocQuestion;
}

export async function runDocAction(raw: unknown): Promise<Record<string, unknown>> {
  const input = docActionSchema.parse(raw);
  const db = createDocAdminClient();
  const viewer = await requireViewer(db);
  const project = await loadProject(db);
  const now = new Date().toISOString();

  switch (input.action) {
    case "section.save": {
      requireEditor(viewer);
      const section = await sectionOfProject(db, project.id, input.sectionId);
      if (section.title === input.title && section.body === input.body) return { sections: await loadSections(db, project.id) };
      await writeSectionVersion(db, project, section, input.title, input.body, input.note, viewer.user_id);
      return { sections: await loadSections(db, project.id) };
    }
    case "section.history": {
      await sectionOfProject(db, project.id, input.sectionId);
      const { data, error } = await db
        .from("documentary_section_versions")
        .select("id, version, title, body, note, project_version, created_by, created_at")
        .eq("section_id", input.sectionId)
        .order("version", { ascending: false });
      if (error) fail("histórico", error);
      const people = await usersById(db, (data ?? []).map((row) => row.created_by as string | null));
      const history: DocSectionVersion[] = (data ?? []).map((row) => ({
        id: row.id as string,
        version: row.version as number,
        title: row.title as string,
        body: row.body as string,
        note: (row.note as string | null) ?? null,
        project_version: (row.project_version as string | null) ?? null,
        created_at: row.created_at as string,
        created_by_name: row.created_by ? shortName(people.get(row.created_by as string)?.name ?? "") || null : null,
      }));
      return { history };
    }
    case "section.restore": {
      requireEditor(viewer);
      const section = await sectionOfProject(db, project.id, input.sectionId);
      const { data, error } = await db
        .from("documentary_section_versions")
        .select("title, body")
        .eq("section_id", section.id)
        .eq("version", input.version)
        .maybeSingle();
      if (error) fail("versão", error);
      if (!data) throw new DocHttpError("Versão não encontrada.", 404, "NOT_FOUND");
      await writeSectionVersion(db, project, section, data.title as string, data.body as string, `Volta ao texto da versão ${input.version}`, viewer.user_id);
      return { sections: await loadSections(db, project.id) };
    }
    case "project.update": {
      requireEditor(viewer);
      const { error } = await db
        .from("documentary_projects")
        .update({ title: input.title, subtitle: input.subtitle, tagline: input.tagline, signature: input.signature, status_label: input.status_label })
        .eq("id", project.id);
      if (error) fail("projeto", error);
      const updated = await loadProject(db);
      const { event_task_id: _taskId, ...rest } = updated as DocProject & { event_task_id?: string | null };
      void _taskId;
      return { project: rest };
    }
    case "project.closeVersion": {
      requireEditor(viewer);
      const sections = await loadSections(db, project.id);
      const snapshot = Object.fromEntries(sections.map((section) => [section.slug, section.version]));
      const inserted = await db.from("documentary_project_versions").insert({
        project_id: project.id,
        version_label: input.label,
        note: input.note,
        section_versions: snapshot,
        created_by: viewer.user_id,
      });
      if (inserted.error) {
        if (inserted.error.code === "23505") throw new DocHttpError(`A versão ${input.label} já existe.`, 409, "DUPLICATE");
        fail("fechar versão", inserted.error);
      }
      const { error } = await db.from("documentary_projects").update({ version_label: input.label }).eq("id", project.id);
      if (error) fail("versão do projeto", error);
      return { versions: await loadVersions(db, project.id), version_label: input.label };
    }
    case "comment.add": {
      await sectionOfProject(db, project.id, input.sectionId);
      const { error } = await db
        .from("documentary_comments")
        .insert({ project_id: project.id, section_id: input.sectionId, body: input.body, author_user_id: viewer.user_id });
      if (error) fail("comentário", error);
      return { comments: await loadComments(db, project.id) };
    }
    case "comment.resolve":
    case "comment.delete": {
      const { data, error } = await db.from("documentary_comments").select("id, author_user_id").eq("id", input.id).eq("project_id", project.id).maybeSingle();
      if (error) fail("comentário", error);
      if (!data) throw new DocHttpError("Comentário não encontrado.", 404, "NOT_FOUND");
      const isAuthor = data.author_user_id === viewer.user_id;
      if (!isAuthor && !viewer.can_edit) throw new DocHttpError("Só quem escreveu ou a equipe de produção mexe neste comentário.", 403, "FORBIDDEN");
      const result =
        input.action === "comment.delete"
          ? await db.from("documentary_comments").delete().eq("id", input.id)
          : await db.from("documentary_comments").update({ resolved_at: input.resolved ? now : null }).eq("id", input.id);
      if (result.error) fail("comentário", result.error);
      return { comments: await loadComments(db, project.id) };
    }
    case "approval.decide": {
      const { data: item, error } = await db
        .from("documentary_approval_items")
        .select("id, approvers")
        .eq("id", input.itemId)
        .eq("project_id", project.id)
        .maybeSingle();
      if (error) fail("item", error);
      if (!item) throw new DocHttpError("Item não encontrado.", 404, "NOT_FOUND");
      if (!(item.approvers as string[]).includes(input.personKey)) throw new DocHttpError("Esta pessoa não aprova este item.", 400, "INVALID");
      const { data: person } = await db
        .from("documentary_people")
        .select("user_id")
        .eq("project_id", project.id)
        .eq("key", input.personKey)
        .maybeSingle();
      const isSelf = person?.user_id === viewer.user_id;
      if (!isSelf && !viewer.can_edit) throw new DocHttpError("Você só registra as suas próprias decisões.", 403, "FORBIDDEN");
      if ((input.status === "ajustar" || input.status === "recusado") && !input.note) {
        throw new DocHttpError("Escreva o ajuste ou o motivo.", 400, "INVALID");
      }
      const inserted = await db.from("documentary_approval_decisions").insert({
        item_id: input.itemId,
        person_key: input.personKey,
        status: input.status,
        note: input.note,
        decided_on: input.status === "pendente" ? null : input.decidedOn ?? todayInSaoPaulo(),
        project_version: project.version_label,
        recorded_by: viewer.user_id,
      });
      if (inserted.error) fail("decisão", inserted.error);
      return { approvals: await loadApprovals(db, project.id) };
    }
    case "approval.save": {
      requireEditor(viewer);
      const payload = {
        stage: input.stage,
        title: input.title,
        context: input.context,
        sensitive: input.sensitive,
        approvers: input.approvers,
      };
      if (input.id) {
        await ensureItemInProject(db, "documentary_approval_items", input.id, project.id);
        const { error } = await db.from("documentary_approval_items").update(payload).eq("id", input.id);
        if (error) fail("item", error);
      } else {
        const { data: last } = await db
          .from("documentary_approval_items")
          .select("sort")
          .eq("project_id", project.id)
          .eq("stage", input.stage)
          .order("sort", { ascending: false })
          .limit(1);
        const { error } = await db
          .from("documentary_approval_items")
          .insert({ ...payload, project_id: project.id, sort: ((last?.[0]?.sort as number | undefined) ?? 0) + 10, source: "Criado no sistema" });
        if (error) fail("item", error);
      }
      return { approvals: await loadApprovals(db, project.id) };
    }
    case "approval.delete": {
      requireEditor(viewer);
      await ensureItemInProject(db, "documentary_approval_items", input.id, project.id);
      const { error } = await db.from("documentary_approval_items").delete().eq("id", input.id);
      if (error) fail("item", error);
      return { approvals: await loadApprovals(db, project.id) };
    }
    case "shoot.save": {
      requireEditor(viewer);
      const status = input.scheduled_date && input.status === "a_marcar" ? "marcada" : input.status;
      const payload = {
        kind: input.kind,
        title: input.title,
        person_keys: input.person_keys,
        estimate: input.estimate,
        optional: input.optional,
        scheduled_date: input.scheduled_date,
        start_time: input.start_time,
        end_time: input.end_time,
        location: input.location,
        participants: input.participants,
        status,
        notes: input.notes,
      };
      if (input.id) {
        await ensureItemInProject(db, "documentary_shoots", input.id, project.id);
        const { error } = await db.from("documentary_shoots").update(payload).eq("id", input.id);
        if (error) fail("gravação", error);
      } else {
        const { data: last } = await db.from("documentary_shoots").select("sort").eq("project_id", project.id).order("sort", { ascending: false }).limit(1);
        const { error } = await db
          .from("documentary_shoots")
          .insert({ ...payload, project_id: project.id, sort: ((last?.[0]?.sort as number | undefined) ?? 0) + 10 });
        if (error) fail("gravação", error);
      }
      return { shoots: await loadShoots(db, project.id) };
    }
    case "shoot.delete": {
      requireEditor(viewer);
      await ensureItemInProject(db, "documentary_shoots", input.id, project.id);
      const { error } = await db.from("documentary_shoots").delete().eq("id", input.id);
      if (error) fail("gravação", error);
      return { shoots: await loadShoots(db, project.id) };
    }
    case "shoot.timer": {
      requireEditor(viewer);
      const { data, error } = await db
        .from("documentary_shoots")
        .select("id, timer_started_at, timer_elapsed_seconds")
        .eq("id", input.id)
        .eq("project_id", project.id)
        .maybeSingle();
      if (error) fail("cronômetro", error);
      if (!data) throw new DocHttpError("Gravação não encontrada.", 404, "NOT_FOUND");
      const started = data.timer_started_at ? new Date(data.timer_started_at as string).getTime() : null;
      const elapsed = (data.timer_elapsed_seconds as number) + (started ? Math.floor((Date.now() - started) / 1000) : 0);
      const patch =
        input.op === "start"
          ? started
            ? {}
            : { timer_started_at: now }
          : input.op === "pause"
            ? { timer_started_at: null, timer_elapsed_seconds: elapsed }
            : { timer_started_at: null, timer_elapsed_seconds: 0 };
      if (Object.keys(patch).length) {
        const update = await db.from("documentary_shoots").update(patch).eq("id", input.id);
        if (update.error) fail("cronômetro", update.error);
      }
      return { shoots: await loadShoots(db, project.id) };
    }
    case "question.save": {
      requireEditor(viewer);
      if (input.approval_item_id) await ensureItemInProject(db, "documentary_approval_items", input.approval_item_id, project.id);
      const payload = {
        audience: input.audience,
        text: input.text,
        note: input.note,
        sensitive: input.sensitive,
        approval_item_id: input.approval_item_id,
      };
      let id = input.id;
      if (id) {
        await ensureItemInProject(db, "documentary_questions", id, project.id);
        const { error } = await db.from("documentary_questions").update(payload).eq("id", id);
        if (error) fail("pergunta", error);
      } else {
        const { data: last } = await db
          .from("documentary_questions")
          .select("sort")
          .eq("project_id", project.id)
          .eq("audience", input.audience)
          .order("sort", { ascending: false })
          .limit(1);
        const { data, error } = await db
          .from("documentary_questions")
          .insert({ ...payload, project_id: project.id, sort: ((last?.[0]?.sort as number | undefined) ?? 0) + 10, added_on_day: input.added_on_day ?? false })
          .select("id")
          .single();
        if (error) fail("pergunta", error);
        id = data.id as string;
      }
      return { question: await loadQuestion(db, id) };
    }
    case "question.priority": {
      requireEditor(viewer);
      await ensureItemInProject(db, "documentary_questions", input.id, project.id);
      const { error } = await db.from("documentary_questions").update({ priority: input.priority }).eq("id", input.id);
      if (error) fail("pergunta", error);
      return { question: await loadQuestion(db, input.id) };
    }
    case "question.move": {
      requireEditor(viewer);
      const current = await loadQuestion(db, input.id);
      const { data, error } = await db
        .from("documentary_questions")
        .select("id, sort")
        .eq("project_id", project.id)
        .eq("audience", current.audience)
        .order("sort");
      if (error) fail("ordem", error);
      const list = data ?? [];
      const index = list.findIndex((row) => row.id === input.id);
      const swapWith = input.direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapWith < 0 || swapWith >= list.length) return { questions: list };
      const ordered = [...list];
      [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];
      for (const [position, row] of ordered.entries()) {
        const sort = (position + 1) * 10;
        if (row.sort !== sort) {
          const update = await db.from("documentary_questions").update({ sort }).eq("id", row.id);
          if (update.error) fail("ordem", update.error);
        }
      }
      const refreshed = await db.from("documentary_questions").select(QUESTION_COLUMNS).eq("project_id", project.id).order("sort");
      if (refreshed.error) fail("perguntas", refreshed.error);
      return { questions: refreshed.data ?? [] };
    }
    case "question.delete": {
      requireEditor(viewer);
      await ensureItemInProject(db, "documentary_questions", input.id, project.id);
      const { error } = await db.from("documentary_questions").delete().eq("id", input.id);
      if (error) fail("pergunta", error);
      return { deleted: input.id };
    }
    case "take.save": {
      requireEditor(viewer);
      await ensureItemInProject(db, "documentary_questions", input.questionId, project.id);
      await ensureItemInProject(db, "documentary_shoots", input.shootId, project.id);
      const { data: existing } = await db
        .from("documentary_question_takes")
        .select("asked, asked_at, time_mark, strong, note")
        .eq("question_id", input.questionId)
        .eq("shoot_id", input.shootId)
        .maybeSingle();
      const asked = input.asked ?? (existing?.asked as boolean | undefined) ?? false;
      const row = {
        question_id: input.questionId,
        shoot_id: input.shootId,
        asked,
        asked_at: asked ? (existing?.asked && existing.asked_at ? existing.asked_at : now) : null,
        time_mark: input.time_mark !== undefined ? input.time_mark : ((existing?.time_mark as string | null) ?? null),
        strong: input.strong ?? (existing?.strong as boolean | undefined) ?? false,
        note: input.note !== undefined ? input.note : ((existing?.note as string | null) ?? null),
        updated_by: viewer.user_id,
        updated_at: now,
      };
      const { error } = await db.from("documentary_question_takes").upsert(row, { onConflict: "question_id,shoot_id" });
      if (error) fail("pergunta feita", error);
      const take: DocTake = {
        question_id: row.question_id,
        shoot_id: row.shoot_id,
        asked: row.asked,
        asked_at: row.asked_at as string | null,
        time_mark: row.time_mark,
        strong: row.strong,
        note: row.note,
      };
      return { take };
    }
    case "checklist.toggle": {
      requireEditor(viewer);
      await ensureItemInProject(db, "documentary_checklist_items", input.itemId, project.id);
      const { error } = await db
        .from("documentary_checklist_items")
        .update({ done_at: input.done ? now : null, done_by: input.done ? viewer.user_id : null })
        .eq("id", input.itemId);
      if (error) fail("checklist", error);
      const checklist = await loadChecklist(db, project.id);
      return { checklist: checklist.items };
    }
    case "shootCheck.toggle": {
      requireEditor(viewer);
      await ensureItemInProject(db, "documentary_shoots", input.shootId, project.id);
      await ensureItemInProject(db, "documentary_checklist_items", input.itemId, project.id);
      const result = input.done
        ? await db
            .from("documentary_shoot_checks")
            .upsert({ shoot_id: input.shootId, item_id: input.itemId, done_at: now, done_by: viewer.user_id }, { onConflict: "shoot_id,item_id" })
        : await db.from("documentary_shoot_checks").delete().eq("shoot_id", input.shootId).eq("item_id", input.itemId);
      if (result.error) fail("checklist do dia", result.error);
      const checklist = await loadChecklist(db, project.id);
      return { shootChecks: checklist.checks };
    }
    case "archive.create": {
      requireEditor(viewer);
      const prefix = `acervo/${project.id}/`;
      if (input.items.some((item) => !item.storage_path.startsWith(prefix) || (item.thumb_path && !item.thumb_path.startsWith(prefix)))) {
        throw new DocHttpError("Arquivo fora da pasta do projeto.", 400, "INVALID");
      }
      const rows = input.items.map((item) => ({ ...item, project_id: project.id, created_by: viewer.user_id }));
      const { data, error } = await db.from("documentary_archive_items").insert(rows).select(ARCHIVE_COLUMNS);
      if (error) fail("acervo", error);
      return { items: await mapArchive(db, (data ?? []) as Record<string, unknown>[]) };
    }
    case "archive.update":
    case "archive.bulk": {
      requireEditor(viewer);
      const ids = input.action === "archive.update" ? [input.id] : input.ids;
      const fields = Object.fromEntries(Object.entries(input.fields).filter(([, value]) => value !== undefined));
      if (!Object.keys(fields).length) throw new DocHttpError("Nada para salvar.", 400, "INVALID");
      const { data, error } = await db
        .from("documentary_archive_items")
        .update(fields)
        .in("id", ids)
        .eq("project_id", project.id)
        .select(ARCHIVE_COLUMNS);
      if (error) fail("acervo", error);
      return { items: await mapArchive(db, (data ?? []) as Record<string, unknown>[]) };
    }
    case "archive.delete": {
      requireEditor(viewer);
      const { data, error } = await db
        .from("documentary_archive_items")
        .select("id, storage_path, thumb_path")
        .in("id", input.ids)
        .eq("project_id", project.id);
      if (error) fail("acervo", error);
      const rows = data ?? [];
      const removed = await db.from("documentary_archive_items").delete().in("id", rows.map((row) => row.id as string));
      if (removed.error) fail("acervo", removed.error);
      const paths = rows.flatMap((row) => [row.storage_path as string, row.thumb_path as string | null].filter(Boolean) as string[]);
      if (paths.length) {
        const storage = await db.storage.from(DOC_BUCKET).remove(paths);
        if (storage.error) console.error(`[${LOG}] remover arquivos:`, storage.error);
      }
      return { deleted: rows.map((row) => row.id as string) };
    }
  }
}
