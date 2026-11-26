import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hasCleaningAccess, hasFacilitiesAccess } from "@/lib/access-control";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { awardPhotoUrl } from "@/lib/rh/bp-awards/format";
import { feriadosNacionais } from "@/lib/vistagem/dias-uteis";
import { carregarFeriados } from "@/lib/vistagem/feriados";
import {
  CLEANING_KINDS,
  monthWeeks,
  mondayOf,
  NOT_DONE_REASONS,
  scheduleSlot,
  todayInSaoPaulo,
  type CalendarWeek,
  type CleaningKind,
  type NotDoneReason,
} from "./cleaning";
import { isCleaningGuide, type CleaningGuide } from "./cleaning-guide";
import { createFacilitiesAdminClient, FacilitiesHttpError, optionalText, parse, safeFileName, SIGNED_URL_SECONDS } from "./server";
import { FACILITIES_BUCKET } from "./types";

/* ------------------------------------------------------------------ tipos */

export interface CleaningArea {
  id: string;
  name: string;
  position: number;
  active: boolean;
}

export interface CleaningCheck {
  day: string;
  area_id: string;
  status: "limpo" | "nao_limpo";
  reason: NotDoneReason | null;
  note: string | null;
  kind: CleaningKind | null;
  checked_at: string;
  checked_by_name: string | null;
}

export interface CleaningDayRecord {
  day: string;
  closed_at: string | null;
  closed_by_name: string | null;
  closed_by_avatar: string | null;
  close_note: string | null;
  no_cleaning_reason: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  reviewed_by_avatar: string | null;
  review_result: "ok" | "ressalvas" | null;
  review_note: string | null;
}

export interface CleaningIssue {
  id: string;
  day: string;
  area_id: string | null;
  area_name: string | null;
  description: string;
  has_photo: boolean;
  reported_by_name: string | null;
  created_at: string;
  status: "aberto" | "resolvido" | "manutencao";
  resolution_note: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  maintenance_plan_id: string | null;
}

export interface CleaningDayView {
  day: string;
  today: string;
  business: boolean;
  holiday: boolean;
  weekOfMonth: number | null;
  scheduleWeek: number | null;
  areas: Array<{ id: string; name: string; kind: CleaningKind | null; check: CleaningCheck | null }>;
  record: CleaningDayRecord | null;
  issues: CleaningIssue[];
  canManage: boolean;
  user: CleaningPerson;
}

export interface CleaningPerson {
  id: string;
  name: string;
  avatar: string | null;
}

export interface CleaningMonthView {
  month: string;
  today: string;
  /** Primeiro dia com registro no sistema: antes dele a limpeza era na planilha e não conta. */
  startedOn: string;
  weeks: CalendarWeek[];
  areas: CleaningArea[];
  /** "areaId:semana:dia" → tipo. */
  schedule: Record<string, CleaningKind>;
  checks: CleaningCheck[];
  days: CleaningDayRecord[];
  issues: CleaningIssue[];
  weekNotes: Record<string, { note: string; updated_by_name: string | null; updated_at: string }>;
  /** Quem faz a limpeza (chave /limpeza), com foto. */
  team: CleaningPerson[];
}

export interface CleaningScheduleView {
  areas: CleaningArea[];
  cells: Array<{ area_id: string; week: number; weekday: number; kind: CleaningKind }>;
}

/* ------------------------------------------------------------------ acesso */

interface CleaningUser {
  profileId: string;
  name: string;
  /** Facilities (Letícia, admin): confere, assina e mexe em qualquer dia. */
  canManage: boolean;
}

async function currentUser(): Promise<CleaningUser> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new FacilitiesHttpError("Não autenticado.", 401, "UNAUTHENTICATED");
  const { data, error } = await createFacilitiesAdminClient()
    .from("users")
    .select("id, name, role, permissions")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (error || !data) throw new FacilitiesHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  const profile = { role: data.role as string | null, permissions: data.permissions as string[] | null };
  if (!hasCleaningAccess(profile)) throw new FacilitiesHttpError("Você não tem acesso à limpeza.", 403, "FORBIDDEN");
  return { profileId: data.id as string, name: data.name as string, canManage: hasFacilitiesAccess(profile) };
}

export async function requireCleaningUser(): Promise<CleaningUser> {
  return currentUser();
}

async function requireCleaningManager(): Promise<CleaningUser> {
  const user = await currentUser();
  if (!user.canManage) throw new FacilitiesHttpError("Só Facilities confere e assina a limpeza.", 403, "FORBIDDEN");
  return user;
}

/* ------------------------------------------------------------------ apoio */

function fail(label: string, error: { message: string } | null): never {
  console.error(`[limpeza] ${label}:`, error);
  throw new FacilitiesHttpError(`Falha ao ${label}.`, 500, "QUERY_FAILED");
}

/** Feriados da Controladoria (base do SIOE); se ela não responder, ficam os nacionais. */
async function loadHolidays(): Promise<Set<string>> {
  try {
    return new Set(await carregarFeriados());
  } catch (error) {
    console.error("[limpeza] feriados do SIOE indisponíveis, usando os nacionais:", error);
    const year = Number(todayInSaoPaulo().slice(0, 4));
    return new Set([year - 1, year, year + 1].flatMap(feriadosNacionais));
  }
}

type UserPhotoRow = { id: string; name: string; avatar_url: string | null; photo_onedrive_url: string | null };

function toPerson(row: UserPhotoRow): CleaningPerson {
  return { id: row.id, name: row.name, avatar: awardPhotoUrl(resolveEmployeeAvatarUrl(row.avatar_url, row.photo_onedrive_url), 160) };
}

/** Nome e foto de cada pessoa citada (quem marcou, encerrou, assinou...). */
async function peopleOf(db: SupabaseClient, ids: Array<string | null | undefined>): Promise<Map<string, CleaningPerson>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const { data } = await db.from("users").select("id, name, avatar_url, photo_onedrive_url").in("id", unique);
  return new Map(((data ?? []) as UserPhotoRow[]).map((u) => [u.id, toPerson(u)]));
}

/** Equipe da limpeza: usuários ativos com a chave /limpeza. */
async function loadTeam(db: SupabaseClient): Promise<CleaningPerson[]> {
  const { data } = await db
    .from("users")
    .select("id, name, avatar_url, photo_onedrive_url")
    .eq("is_active", true)
    .contains("permissions", ["/limpeza"])
    .order("name");
  return ((data ?? []) as UserPhotoRow[]).map(toPerson);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

type CheckRow = Omit<CleaningCheck, "checked_by_name"> & { checked_by: string | null };
type DayRow = Omit<CleaningDayRecord, "closed_by_name" | "closed_by_avatar" | "reviewed_by_name" | "reviewed_by_avatar"> & {
  closed_by: string | null;
  reviewed_by: string | null;
};
type IssueRow = Omit<CleaningIssue, "area_name" | "has_photo" | "reported_by_name" | "resolved_by_name"> & {
  photo_path: string | null;
  reported_by: string | null;
  resolved_by: string | null;
};

const CHECK_COLUMNS = "day, area_id, status, reason, note, kind, checked_at, checked_by";
const DAY_COLUMNS =
  "day, closed_at, closed_by, close_note, no_cleaning_reason, reviewed_at, reviewed_by, review_result, review_note";
const ISSUE_COLUMNS =
  "id, day, area_id, description, photo_path, reported_by, created_at, status, resolution_note, resolved_by, resolved_at, maintenance_plan_id";

function toIssues(rows: IssueRow[], names: Map<string, CleaningPerson>, areaNames: Map<string, string>): CleaningIssue[] {
  return rows.map(({ photo_path, reported_by, resolved_by, ...row }) => ({
    ...row,
    area_name: row.area_id ? areaNames.get(row.area_id) ?? null : null,
    has_photo: Boolean(photo_path),
    reported_by_name: reported_by ? names.get(reported_by)?.name ?? null : null,
    resolved_by_name: resolved_by ? names.get(resolved_by)?.name ?? null : null,
  }));
}

function toDay(row: DayRow, names: Map<string, CleaningPerson>): CleaningDayRecord {
  const { closed_by, reviewed_by, ...rest } = row;
  const closer = closed_by ? names.get(closed_by) : undefined;
  const reviewer = reviewed_by ? names.get(reviewed_by) : undefined;
  return {
    ...rest,
    closed_by_name: closer?.name ?? null,
    closed_by_avatar: closer?.avatar ?? null,
    reviewed_by_name: reviewer?.name ?? null,
    reviewed_by_avatar: reviewer?.avatar ?? null,
  };
}

async function loadAreas(db: SupabaseClient, includeInactive = false): Promise<CleaningArea[]> {
  let query = db.from("facility_cleaning_areas").select("id, name, position, active").order("position").order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) fail("carregar os ambientes", error);
  return (data ?? []) as CleaningArea[];
}

async function loadDayRow(db: SupabaseClient, day: string): Promise<DayRow | null> {
  const { data, error } = await db.from("facility_cleaning_days").select(DAY_COLUMNS).eq("day", day).maybeSingle();
  if (error) fail("carregar o dia", error);
  return (data as DayRow | null) ?? null;
}

async function log(db: SupabaseClient, day: string, action: string, actor: string, reason: string | null = null) {
  await db.from("facility_cleaning_log").insert({ day, action, actor, reason });
}

/** O dia aceita marcação? (dia útil, não assinado, não marcado "sem limpeza"; a equipe só mexe no dia de hoje). */
async function assertDayOpen(db: SupabaseClient, user: CleaningUser, day: string): Promise<{ slot: { week: number; weekday: number } }> {
  const today = todayInSaoPaulo();
  if (!user.canManage && day !== today) throw new FacilitiesHttpError("Só dá para marcar a limpeza de hoje.", 409, "NOT_TODAY");
  if (day > today) throw new FacilitiesHttpError("Esse dia ainda não chegou.", 409, "FUTURE_DAY");
  const slot = scheduleSlot(day, await loadHolidays());
  if (!slot) throw new FacilitiesHttpError("Não tem limpeza nesse dia (fim de semana ou feriado).", 409, "NO_CLEANING_DAY");
  const row = await loadDayRow(db, day);
  if (row?.reviewed_at) throw new FacilitiesHttpError("O dia já foi conferido e assinado por Facilities.", 409, "DAY_SIGNED");
  if (row?.no_cleaning_reason) throw new FacilitiesHttpError("Esse dia está marcado como sem limpeza.", 409, "NO_CLEANING");
  return { slot };
}

/* ------------------------------------------------------------------ o dia (equipe da limpeza) */

export async function getCleaningDay(dayInput?: string | null): Promise<CleaningDayView> {
  const user = await currentUser();
  const db = createFacilitiesAdminClient();
  const today = todayInSaoPaulo();
  const day = dayInput ? parse(isoDate, dayInput) : today;
  const holidays = await loadHolidays();
  const slot = scheduleSlot(day, holidays);

  const [areas, schedule, checks, dayRow, issues] = await Promise.all([
    loadAreas(db),
    slot
      ? db.from("facility_cleaning_schedule").select("area_id, kind").eq("week", slot.week).eq("weekday", slot.weekday)
      : Promise.resolve({ data: [], error: null }),
    db.from("facility_cleaning_checks").select(CHECK_COLUMNS).eq("day", day),
    loadDayRow(db, day),
    db.from("facility_cleaning_issues").select(ISSUE_COLUMNS).eq("day", day).order("created_at"),
  ]);
  if (schedule.error) fail("carregar o cronograma", schedule.error);
  if (checks.error) fail("carregar as marcações", checks.error);
  if (issues.error) fail("carregar os avisos", issues.error);

  const checkRows = (checks.data ?? []) as unknown as CheckRow[];
  const issueRows = (issues.data ?? []) as unknown as IssueRow[];
  const names = await peopleOf(db, [
    user.profileId,
    ...checkRows.map((c) => c.checked_by),
    dayRow?.closed_by,
    dayRow?.reviewed_by,
    ...issueRows.flatMap((i) => [i.reported_by, i.resolved_by]),
  ]);
  const kindBy = new Map(((schedule.data ?? []) as Array<{ area_id: string; kind: CleaningKind }>).map((s) => [s.area_id, s.kind]));
  const checkBy = new Map(
    checkRows.map(({ checked_by, ...c }) => [c.area_id, { ...c, checked_by_name: checked_by ? names.get(checked_by)?.name ?? null : null }])
  );
  const areaNames = new Map(areas.map((a) => [a.id, a.name]));

  return {
    day,
    today,
    business: Boolean(slot),
    holiday: holidays.has(day),
    weekOfMonth: slot?.weekOfMonth ?? null,
    scheduleWeek: slot?.week ?? null,
    areas: slot ? areas.map((a) => ({ id: a.id, name: a.name, kind: kindBy.get(a.id) ?? null, check: checkBy.get(a.id) ?? null })) : [],
    record: dayRow ? toDay(dayRow, names) : null,
    issues: toIssues(issueRows, names, areaNames),
    canManage: user.canManage,
    user: names.get(user.profileId) ?? { id: user.profileId, name: user.name, avatar: null },
  };
}

const markSchema = z
  .object({
    day: isoDate,
    area_id: z.string().uuid(),
    status: z.enum(["limpo", "nao_limpo"]),
    reason: z.enum(NOT_DONE_REASONS).nullable().optional(),
    note: optionalText(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "nao_limpo" && !value.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Diga por que não deu para limpar." });
  });

export async function markArea(input: unknown): Promise<CleaningDayView> {
  const user = await currentUser();
  const db = createFacilitiesAdminClient();
  const value = parse(markSchema, input);
  const { slot } = await assertDayOpen(db, user, value.day);
  const { data: cell } = await db
    .from("facility_cleaning_schedule")
    .select("kind")
    .eq("area_id", value.area_id)
    .eq("week", slot.week)
    .eq("weekday", slot.weekday)
    .maybeSingle();
  const { error } = await db.from("facility_cleaning_checks").upsert({
    day: value.day,
    area_id: value.area_id,
    status: value.status,
    reason: value.status === "nao_limpo" ? value.reason : null,
    note: value.note ?? null,
    kind: (cell?.kind as string | undefined) ?? null,
    checked_by: user.profileId,
    checked_at: new Date().toISOString(),
  });
  if (error) fail("marcar o ambiente", error);
  return getCleaningDay(value.day);
}

export async function unmarkArea(input: unknown): Promise<CleaningDayView> {
  const user = await currentUser();
  const db = createFacilitiesAdminClient();
  const value = parse(z.object({ day: isoDate, area_id: z.string().uuid() }), input);
  await assertDayOpen(db, user, value.day);
  const { error } = await db.from("facility_cleaning_checks").delete().eq("day", value.day).eq("area_id", value.area_id);
  if (error) fail("desfazer a marcação", error);
  return getCleaningDay(value.day);
}

export async function closeDay(input: unknown): Promise<CleaningDayView> {
  const user = await currentUser();
  const db = createFacilitiesAdminClient();
  const value = parse(z.object({ day: isoDate, note: optionalText(1000).optional() }), input);
  await assertDayOpen(db, user, value.day);
  const { error } = await db.from("facility_cleaning_days").upsert({
    day: value.day,
    closed_by: user.profileId,
    closed_at: new Date().toISOString(),
    close_note: value.note ?? null,
  });
  if (error) fail("encerrar o dia", error);
  await log(db, value.day, "encerrou", user.profileId, value.note ?? null);
  return getCleaningDay(value.day);
}

export async function undoCloseDay(input: unknown): Promise<CleaningDayView> {
  const user = await currentUser();
  const db = createFacilitiesAdminClient();
  const value = parse(z.object({ day: isoDate }), input);
  await assertDayOpen(db, user, value.day);
  const { error } = await db.from("facility_cleaning_days").update({ closed_by: null, closed_at: null, close_note: null }).eq("day", value.day);
  if (error) fail("reabrir o dia", error);
  await log(db, value.day, "desfez o encerramento", user.profileId);
  return getCleaningDay(value.day);
}

/* ------------------------------------------------------------------ avisos (problemas) */

const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function createIssueUpload(input: unknown): Promise<{ path: string; token: string; content_type: string }> {
  await currentUser();
  const value = parse(z.object({ day: isoDate, file_name: z.string().trim().min(1).max(255), size_bytes: z.number().int().positive() }), input);
  const ext = value.file_name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = IMAGE_TYPES[ext];
  if (!contentType) throw new FacilitiesHttpError("Envie uma foto (JPG, PNG ou WebP).", 415, "UNSUPPORTED_TYPE");
  if (value.size_bytes > 15 * 1024 * 1024) throw new FacilitiesHttpError("A foto passa de 15 MB.", 413, "TOO_LARGE");
  const path = `limpeza/${value.day}/${Date.now()}-${safeFileName(value.file_name)}`;
  const { data, error } = await createFacilitiesAdminClient().storage.from(FACILITIES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) fail("preparar o envio da foto", error);
  return { path: data.path, token: data.token, content_type: contentType };
}

export async function createIssue(input: unknown): Promise<CleaningDayView> {
  const user = await currentUser();
  const db = createFacilitiesAdminClient();
  const value = parse(
    z.object({
      day: isoDate,
      area_id: z.string().uuid().nullable(),
      description: z.string().trim().min(3, "Conte o que aconteceu.").max(1000),
      photo_path: z.string().max(500).nullable(),
    }),
    input
  );
  if (value.photo_path && !value.photo_path.startsWith(`limpeza/${value.day}/`)) {
    throw new FacilitiesHttpError("Foto inválida.", 400, "INVALID_INPUT");
  }
  const { error } = await db.from("facility_cleaning_issues").insert({ ...value, reported_by: user.profileId });
  if (error) fail("registrar o aviso", error);
  return getCleaningDay(value.day);
}

export async function issuePhotoUrl(id: string): Promise<string> {
  await currentUser();
  const db = createFacilitiesAdminClient();
  const { data } = await db.from("facility_cleaning_issues").select("photo_path").eq("id", id).maybeSingle();
  if (!data?.photo_path) throw new FacilitiesHttpError("Foto não encontrada.", 404, "NOT_FOUND");
  const { data: signed, error } = await db.storage.from(FACILITIES_BUCKET).createSignedUrl(data.photo_path as string, SIGNED_URL_SECONDS);
  if (error || !signed) fail("abrir a foto", error);
  return signed.signedUrl;
}

/* ------------------------------------------------------------------ acompanhamento (Facilities) */

export async function getCleaningMonth(monthInput?: string | null): Promise<CleaningMonthView> {
  await requireCleaningManager();
  const db = createFacilitiesAdminClient();
  const today = todayInSaoPaulo();
  const month = monthInput && /^\d{4}-\d{2}$/.test(monthInput) ? monthInput : today.slice(0, 7);
  const holidays = await loadHolidays();
  const weeks = monthWeeks(month, holidays);
  const first = weeks[0]?.monday ?? `${month}-01`;
  const last = weeks.at(-1)?.days.at(-1)?.iso ?? `${month}-28`;

  const [areas, schedule, checks, days, issues, notes, firstCheck, firstDay] = await Promise.all([
    loadAreas(db),
    db.from("facility_cleaning_schedule").select("area_id, week, weekday, kind"),
    db.from("facility_cleaning_checks").select(CHECK_COLUMNS).gte("day", first).lte("day", last),
    db.from("facility_cleaning_days").select(DAY_COLUMNS).gte("day", first).lte("day", last),
    // Avisos do mês e os que seguem abertos de antes.
    db.from("facility_cleaning_issues").select(ISSUE_COLUMNS).or(`status.eq.aberto,and(day.gte.${first},day.lte.${last})`).order("created_at", { ascending: false }),
    db.from("facility_cleaning_week_notes").select("week_start, note, updated_by, updated_at").gte("week_start", first).lte("week_start", last),
    db.from("facility_cleaning_checks").select("day").order("day").limit(1).maybeSingle(),
    db.from("facility_cleaning_days").select("day").order("day").limit(1).maybeSingle(),
  ]);
  for (const result of [schedule, checks, days, issues, notes]) if (result.error) fail("carregar o acompanhamento", result.error);

  const checkRows = (checks.data ?? []) as unknown as CheckRow[];
  const dayRows = (days.data ?? []) as unknown as DayRow[];
  const issueRows = (issues.data ?? []) as unknown as IssueRow[];
  const noteRows = (notes.data ?? []) as Array<{ week_start: string; note: string; updated_by: string | null; updated_at: string }>;
  const names = await peopleOf(db, [
    ...checkRows.map((c) => c.checked_by),
    ...dayRows.flatMap((d) => [d.closed_by, d.reviewed_by]),
    ...issueRows.flatMap((i) => [i.reported_by, i.resolved_by]),
    ...noteRows.map((n) => n.updated_by),
  ]);
  const areaNames = new Map((await loadAreas(db, true)).map((a) => [a.id, a.name]));

  const starts = [firstCheck.data?.day, firstDay.data?.day].filter((d): d is string => Boolean(d)).sort();
  return {
    month,
    today,
    startedOn: starts[0] && starts[0] < today ? starts[0] : today,
    weeks,
    areas,
    schedule: Object.fromEntries(
      ((schedule.data ?? []) as Array<{ area_id: string; week: number; weekday: number; kind: CleaningKind }>).map((s) => [
        `${s.area_id}:${s.week}:${s.weekday}`,
        s.kind,
      ])
    ),
    checks: checkRows.map(({ checked_by, ...c }) => ({ ...c, checked_by_name: checked_by ? names.get(checked_by)?.name ?? null : null })),
    days: dayRows.map((d) => toDay(d, names)),
    issues: toIssues(issueRows, names, areaNames),
    weekNotes: Object.fromEntries(
      noteRows.map((n) => [n.week_start, { note: n.note, updated_by_name: n.updated_by ? names.get(n.updated_by)?.name ?? null : null, updated_at: n.updated_at }])
    ),
    team: await loadTeam(db),
  };
}

const dayActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assinar"), result: z.enum(["ok", "ressalvas"]), note: optionalText(2000).optional() }),
  z.object({ action: z.literal("reabrir"), reason: z.string().trim().min(3, "Diga por que vai reabrir o dia.").max(500) }),
  z.object({ action: z.literal("sem_limpeza"), reason: z.string().trim().min(3, "Diga o motivo (ex.: falta, evento).").max(500) }),
  z.object({ action: z.literal("com_limpeza") }),
]);

/** Conferir e assinar, reabrir ou marcar o dia como "sem limpeza". */
export async function updateCleaningDay(dayInput: string, input: unknown): Promise<CleaningMonthView> {
  const user = await requireCleaningManager();
  const db = createFacilitiesAdminClient();
  const day = parse(isoDate, dayInput);
  const value = parse(dayActionSchema, input);
  const today = todayInSaoPaulo();
  if (day > today) throw new FacilitiesHttpError("Esse dia ainda não chegou.", 409, "FUTURE_DAY");
  const row = await loadDayRow(db, day);
  const now = new Date().toISOString();

  let patch: Record<string, unknown>;
  if (value.action === "assinar") {
    if (row?.reviewed_at) throw new FacilitiesHttpError("O dia já está assinado.", 409, "DAY_SIGNED");
    // Assinar trava a lista da equipe: o dia de hoje só depois que ela encerrar.
    if (day === today && !row?.closed_at) {
      throw new FacilitiesHttpError("A equipe ainda não encerrou o dia de hoje. Assine depois do encerramento.", 409, "DAY_OPEN");
    }
    patch = { reviewed_by: user.profileId, reviewed_at: now, review_result: value.result, review_note: value.note ?? null };
  } else if (value.action === "reabrir") {
    if (!row?.reviewed_at) throw new FacilitiesHttpError("O dia não está assinado.", 409, "NOT_SIGNED");
    patch = { reviewed_by: null, reviewed_at: null, review_result: null, review_note: null };
  } else if (value.action === "sem_limpeza") {
    if (row?.reviewed_at) throw new FacilitiesHttpError("Reabra o dia antes de mudar.", 409, "DAY_SIGNED");
    patch = { no_cleaning_reason: value.reason, no_cleaning_by: user.profileId, no_cleaning_at: now };
  } else {
    if (row?.reviewed_at) throw new FacilitiesHttpError("Reabra o dia antes de mudar.", 409, "DAY_SIGNED");
    patch = { no_cleaning_reason: null, no_cleaning_by: null, no_cleaning_at: null };
  }
  const { error } = await db.from("facility_cleaning_days").upsert({ day, ...patch });
  if (error) fail("salvar o dia", error);
  const reason = value.action === "reabrir" || value.action === "sem_limpeza" ? value.reason : value.action === "assinar" ? value.note ?? null : null;
  await log(db, day, value.action, user.profileId, reason);
  return getCleaningMonth(day.slice(0, 7));
}

export async function saveWeekNote(mondayInput: string, input: unknown): Promise<CleaningMonthView> {
  const user = await requireCleaningManager();
  const db = createFacilitiesAdminClient();
  const monday = mondayOf(parse(isoDate, mondayInput));
  const value = parse(z.object({ note: z.string().trim().max(4000), month: z.string().regex(/^\d{4}-\d{2}$/) }), input);
  const { error } = value.note
    ? await db.from("facility_cleaning_week_notes").upsert({ week_start: monday, note: value.note, updated_by: user.profileId, updated_at: new Date().toISOString() })
    : await db.from("facility_cleaning_week_notes").delete().eq("week_start", monday);
  if (error) fail("salvar a anotação da semana", error);
  return getCleaningMonth(value.month);
}

const issueActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolver"), note: optionalText(1000).optional(), month: z.string().regex(/^\d{4}-\d{2}$/) }),
  z.object({ action: z.literal("reabrir"), month: z.string().regex(/^\d{4}-\d{2}$/) }),
  z.object({ action: z.literal("manutencao"), month: z.string().regex(/^\d{4}-\d{2}$/) }),
]);

/** Resolver o aviso, reabrir ou virar manutenção corretiva no plano de manutenção. */
export async function updateIssue(id: string, input: unknown): Promise<CleaningMonthView> {
  const user = await requireCleaningManager();
  const db = createFacilitiesAdminClient();
  const value = parse(issueActionSchema, input);
  const { data: issue } = await db.from("facility_cleaning_issues").select("id, day, area_id, description, maintenance_plan_id").eq("id", id).maybeSingle();
  if (!issue) throw new FacilitiesHttpError("Aviso não encontrado.", 404, "NOT_FOUND");
  const now = new Date().toISOString();

  if (value.action === "resolver") {
    const { error } = await db
      .from("facility_cleaning_issues")
      .update({ status: "resolvido", resolved_by: user.profileId, resolved_at: now, resolution_note: value.note ?? null })
      .eq("id", id);
    if (error) fail("resolver o aviso", error);
  } else if (value.action === "reabrir") {
    const { error } = await db
      .from("facility_cleaning_issues")
      .update({ status: "aberto", resolved_by: null, resolved_at: null, resolution_note: null })
      .eq("id", id);
    if (error) fail("reabrir o aviso", error);
  } else {
    if (issue.maintenance_plan_id) throw new FacilitiesHttpError("Esse aviso já virou manutenção.", 409, "ALREADY_PLANNED");
    const { data: area } = issue.area_id
      ? await db.from("facility_cleaning_areas").select("name").eq("id", issue.area_id).maybeSingle()
      : { data: null };
    const description = String(issue.description);
    const title = `${area?.name ? `${area.name}: ` : ""}${description}`.slice(0, 200);
    const { data: plan, error } = await db
      .from("maintenance_plans")
      .insert({
        title,
        maintenance_type: "corretiva",
        periodicity: "emergencial",
        next_due_on: todayInSaoPaulo(),
        status: "ativo",
        responsible_user_id: user.profileId,
        notes: `Aviso da limpeza de ${String(issue.day).split("-").reverse().join("/")}: ${description}`,
        created_by: user.profileId,
        updated_by: user.profileId,
      })
      .select("id")
      .single();
    if (error || !plan) fail("abrir a manutenção corretiva", error);
    const { error: linkError } = await db
      .from("facility_cleaning_issues")
      .update({ status: "manutencao", maintenance_plan_id: plan.id, resolved_by: user.profileId, resolved_at: now })
      .eq("id", id);
    if (linkError) fail("ligar o aviso à manutenção", linkError);
  }
  return getCleaningMonth(value.month);
}

/* ------------------------------------------------------------------ cronograma */

export async function getCleaningSchedule(): Promise<CleaningScheduleView> {
  await requireCleaningManager();
  const db = createFacilitiesAdminClient();
  const [areas, cells] = await Promise.all([loadAreas(db, true), db.from("facility_cleaning_schedule").select("area_id, week, weekday, kind")]);
  if (cells.error) fail("carregar o cronograma", cells.error);
  return { areas, cells: (cells.data ?? []) as CleaningScheduleView["cells"] };
}

const scheduleActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("celula"),
    area_id: z.string().uuid(),
    week: z.number().int().min(1).max(4),
    weekday: z.number().int().min(1).max(5),
    kind: z.enum(CLEANING_KINDS),
  }),
  z.object({ action: z.literal("novo_ambiente"), name: z.string().trim().min(2, "Dê um nome ao ambiente.").max(120) }),
  z.object({ action: z.literal("renomear"), area_id: z.string().uuid(), name: z.string().trim().min(2).max(120) }),
  z.object({ action: z.literal("ativo"), area_id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal("mover"), area_id: z.string().uuid(), direction: z.enum(["subir", "descer"]) }),
]);

export async function updateCleaningSchedule(input: unknown): Promise<CleaningScheduleView> {
  const user = await requireCleaningManager();
  const db = createFacilitiesAdminClient();
  const value = parse(scheduleActionSchema, input);

  if (value.action === "celula") {
    const { error } = await db.from("facility_cleaning_schedule").upsert({
      area_id: value.area_id,
      week: value.week,
      weekday: value.weekday,
      kind: value.kind,
      updated_by: user.profileId,
      updated_at: new Date().toISOString(),
    });
    if (error) fail("salvar o cronograma", error);
  } else if (value.action === "novo_ambiente") {
    const areas = await loadAreas(db, true);
    if (areas.some((a) => a.name.toLowerCase() === value.name.toLowerCase())) {
      throw new FacilitiesHttpError("Já existe um ambiente com esse nome.", 409, "DUPLICATE_NAME");
    }
    const { data, error } = await db
      .from("facility_cleaning_areas")
      .insert({ name: value.name, position: Math.max(0, ...areas.map((a) => a.position)) + 10 })
      .select("id")
      .single();
    if (error || !data) fail("cadastrar o ambiente", error);
    // Começa com limpeza simples em todos os dias; Facilities ajusta na grade.
    const cells = [1, 2, 3, 4].flatMap((week) => [1, 2, 3, 4, 5].map((weekday) => ({ area_id: data.id, week, weekday, kind: "simples", updated_by: user.profileId })));
    const { error: cellsError } = await db.from("facility_cleaning_schedule").insert(cells);
    if (cellsError) fail("montar o cronograma do ambiente", cellsError);
  } else if (value.action === "renomear") {
    const { error } = await db.from("facility_cleaning_areas").update({ name: value.name }).eq("id", value.area_id);
    if (error) fail("renomear o ambiente", error);
  } else if (value.action === "ativo") {
    const { error } = await db.from("facility_cleaning_areas").update({ active: value.active }).eq("id", value.area_id);
    if (error) fail("salvar o ambiente", error);
  } else {
    const areas = await loadAreas(db, true);
    const index = areas.findIndex((a) => a.id === value.area_id);
    const target = value.direction === "subir" ? index - 1 : index + 1;
    if (index >= 0 && target >= 0 && target < areas.length) {
      // Troca os dois de lugar e renumera a lista (10, 20, 30...).
      const order = [...areas];
      [order[index], order[target]] = [order[target], order[index]];
      for (const [i, area] of order.entries()) {
        if (area.position !== (i + 1) * 10) {
          const { error } = await db.from("facility_cleaning_areas").update({ position: (i + 1) * 10 }).eq("id", area.id);
          if (error) fail("mudar a ordem", error);
        }
      }
    }
  }
  return getCleaningSchedule();
}

/* ------------------------------------------------------------------ guias */

/**
 * A pessoa já viu o guia desta tela? Guardado em user_tour_views (o mesmo dos tours de novidades). Sem resposta do
 * banco, conta como visto: o guia não abre sozinho, mas continua no botão "Ver guia".
 */
export async function cleaningGuideSeen(guide: CleaningGuide): Promise<boolean> {
  try {
    const user = await currentUser();
    const { data, error } = await createFacilitiesAdminClient()
      .from("user_tour_views")
      .select("tour_id")
      .eq("user_id", user.profileId)
      .eq("tour_id", guide)
      .maybeSingle();
    if (error) return true;
    return Boolean(data);
  } catch {
    return true;
  }
}

/** Marca o guia como visto (até o fim ou pulando): não abre sozinho de novo. */
export async function markCleaningGuideSeen(input: unknown): Promise<{ guide: CleaningGuide }> {
  const user = await currentUser();
  const guide = (input as { guide?: unknown } | null)?.guide;
  if (!isCleaningGuide(guide)) throw new FacilitiesHttpError("Guia inválido.", 400, "INVALID_GUIDE");
  const { error } = await createFacilitiesAdminClient()
    .from("user_tour_views")
    .upsert({ user_id: user.profileId, tour_id: guide, completed_at: new Date().toISOString() }, { onConflict: "user_id,tour_id" });
  if (error) fail("guardar o guia", error);
  return { guide };
}
