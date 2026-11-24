import "server-only";

import { z } from "zod";
import { ONE_ON_ONE_HR_ONLY } from "@/lib/access-control";
import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";
import { isActionOverdue, planProgress, todayInBrasilia } from "@/lib/rh/pdi/progress";
import type { PdiPerson } from "@/lib/rh/pdi/types";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import { personOf, resolveTeamContext, type TeamContext } from "@/lib/rh/team-context";
import { cancelEvent, createEvent, freeBusy, invitationBody, mailboxOf, outlookReady, updateEvent } from "./outlook";
import { cadenceOf, dayGrid, daysSince, displayStatus, isoToLocal, localToIso, recurrenceDates } from "./rules";
import {
  ONLINE_ROOM_KEY,
  type AvailabilityInput,
  type AvailabilityResult,
  type OneOnOneAction,
  type OneOnOneCategory,
  type OneOnOneHrOverview,
  type OneOnOneMeeting,
  type OneOnOneOverview,
  type OneOnOnePairDetail,
  type OneOnOnePairSummary,
  type OneOnOneSettings,
  type OneOnOneSuggestion,
  type OneOnOneTopicSource,
  type OneOnOneViewerRole,
  type ScheduleInput,
} from "./types";

type Ctx = TeamContext;

function failed(context: string, error: unknown): never {
  console.error(`[1-1] ${context}:`, error);
  throw new RhHttpError("Falha ao consultar as 1:1.", 500, "QUERY_FAILED");
}

function resolveCtx(): Promise<Ctx> {
  return resolveTeamContext("1-1", ({ isHr }) => {
    if (ONE_ON_ONE_HR_ONLY && !isHr) {
      throw new RhHttpError("As 1:1 ainda estão em teste e só abrem para Pessoas e Cultura e administradores.", 403, "FORBIDDEN");
    }
  });
}

async function requireHr(): Promise<Ctx> {
  const ctx = await resolveCtx();
  if (!ctx.isHr) throw new RhHttpError("Você não tem acesso à gestão das 1:1.", 403, "FORBIDDEN");
  return ctx;
}

const uuid = z.string().uuid();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new RhHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID_INPUT");
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Configurações e categorias.
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: OneOnOneSettings = {
  private_notes_readers: "rh",
  email_agenda_enabled: false,
  email_reminder_enabled: false,
  overdue_days: 30,
  member_can_schedule: true,
  member_can_reschedule: true,
  member_can_rate: true,
  rooms: [],
};

async function loadSettings(ctx: Ctx): Promise<OneOnOneSettings> {
  const { data, error } = await ctx.db
    .from("hr_one_on_one_settings")
    .select("private_notes_readers, email_agenda_enabled, email_reminder_enabled, overdue_days, member_can_schedule, member_can_reschedule, member_can_rate, rooms")
    .eq("id", true)
    .maybeSingle();
  if (error) failed("configurações", error);
  return { ...DEFAULT_SETTINGS, ...((data ?? {}) as Partial<OneOnOneSettings>) };
}

async function loadCategories(ctx: Ctx): Promise<OneOnOneCategory[]> {
  const { data, error } = await ctx.db
    .from("hr_one_on_one_categories")
    .select("id, name, suggested_topics, is_active")
    .order("sort_order")
    .order("name");
  if (error) failed("categorias", error);
  return (data ?? []) as OneOnOneCategory[];
}

function canReadOthersNotes(ctx: Ctx, settings: OneOnOneSettings): boolean {
  if (settings.private_notes_readers === "rh") return ctx.isHr;
  if (settings.private_notes_readers === "admin") return ctx.isAdmin;
  return false;
}

function roomLabel(settings: OneOnOneSettings, key: string | null): string | null {
  if (!key) return null;
  if (key === ONLINE_ROOM_KEY) return "Somente online";
  return settings.rooms.find((room) => room.key === key)?.label ?? key;
}

// ---------------------------------------------------------------------------
// Quem pode o quê na dupla.
// ---------------------------------------------------------------------------

/** O líder conduz a 1:1 com quem ele lidera (gestor direto, indireto ou liderança por área). */
function leaderChainOf(ctx: Ctx, memberId: string): Set<string> {
  const chain = new Set<string>();
  let current = ctx.links.get(memberId)?.manager_employee_id ?? null;
  while (current && !chain.has(current)) {
    chain.add(current);
    current = ctx.links.get(current)?.manager_employee_id ?? null;
  }
  return chain;
}

function roleIn(ctx: Ctx, leaderId: string, memberId: string): OneOnOneViewerRole | null {
  if (ctx.employeeId === leaderId) return "lider";
  if (ctx.employeeId === memberId) return "liderado";
  if (ctx.isHr) return "rh";
  return null;
}

function assertPairAccess(ctx: Ctx, leaderId: string, memberId: string): OneOnOneViewerRole {
  const role = roleIn(ctx, leaderId, memberId);
  if (!role) throw new RhHttpError("Você não participa desta 1:1.", 403, "FORBIDDEN");
  return role;
}

/** Pode marcar uma 1:1 entre este líder e este liderado? */
function assertCanSchedule(ctx: Ctx, settings: OneOnOneSettings, leaderId: string, memberId: string) {
  if (leaderId === memberId) throw new RhHttpError("Escolha duas pessoas diferentes.", 400, "INVALID_INPUT");
  if (!ctx.people.get(leaderId)?.is_active || !ctx.people.get(memberId)?.is_active) {
    throw new RhHttpError("Líder ou liderado não encontrado no cadastro ativo.", 400, "INVALID_INPUT");
  }
  if (ctx.isHr) return;
  if (ctx.employeeId === leaderId && ctx.team.has(memberId)) return;
  if (ctx.employeeId === memberId && settings.member_can_schedule && leaderChainOf(ctx, memberId).has(leaderId)) return;
  throw new RhHttpError("A 1:1 é entre líder e liderado: escolha alguém que você lidera ou o seu gestor.", 403, "FORBIDDEN");
}

// ---------------------------------------------------------------------------
// Leitura.
// ---------------------------------------------------------------------------

interface MeetingRow {
  id: string;
  leader_employee_id: string;
  member_employee_id: string;
  category_id: string | null;
  series_id: string | null;
  starts_at: string;
  ends_at: string;
  room_key: string | null;
  status: "agendada" | "realizada" | "cancelada";
  finished_at: string | null;
  outlook_event_id: string | null;
  outlook_organizer: string | null;
  teams_join_url: string | null;
  rating: number | null;
  rating_comment: string | null;
  created_by: string | null;
  feedz_id: number | null;
}

const MEETING_SELECT =
  "id, leader_employee_id, member_employee_id, category_id, series_id, starts_at, ends_at, room_key, status, finished_at, outlook_event_id, outlook_organizer, teams_join_url, rating, rating_comment, created_by, feedz_id";

interface ActionRow {
  id: string;
  leader_employee_id: string;
  member_employee_id: string;
  meeting_id: string | null;
  title: string;
  owner_employee_id: string | null;
  due_date: string | null;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
}

const ACTION_SELECT = "id, leader_employee_id, member_employee_id, meeting_id, title, owner_employee_id, due_date, done_at, created_by, created_at";

function pairKey(leaderId: string, memberId: string): string {
  return `${leaderId}:${memberId}`;
}

/** PDI ativo de cada pessoa: id, percentual (igual ao Feedz) e ações vencidas. */
async function loadPdiByMember(ctx: Ctx, memberIds: string[]): Promise<Map<string, OneOnOnePairSummary["pdi"]>> {
  const result = new Map<string, OneOnOnePairSummary["pdi"]>();
  if (memberIds.length === 0) return result;
  const { data: plans, error } = await ctx.db
    .from("hr_pdi_plans")
    .select("id, employee_id, start_date")
    .eq("status", "ativo")
    .in("employee_id", memberIds)
    .order("start_date", { ascending: false });
  if (error) failed("PDI", error);
  const latest = new Map<string, string>();
  for (const plan of plans ?? []) if (!latest.has(plan.employee_id as string)) latest.set(plan.employee_id as string, plan.id as string);
  if (latest.size === 0) return result;
  const { data: actions, error: actionsError } = await ctx.db
    .from("hr_pdi_actions")
    .select("plan_id, goal_id, progress, due_date")
    .in("plan_id", [...latest.values()]);
  if (actionsError) failed("ações do PDI", actionsError);
  const today = todayInBrasilia();
  for (const [employeeId, planId] of latest) {
    const planActions = (actions ?? []).filter((action) => action.plan_id === planId) as Array<{
      goal_id: string;
      progress: number;
      due_date: string | null;
    }>;
    result.set(employeeId, {
      id: planId,
      progress: planProgress(planActions),
      overdue_actions: planActions.filter((action) => isActionOverdue(action, today)).length,
    });
  }
  return result;
}

function summarizePair(
  ctx: Ctx,
  leaderId: string,
  memberId: string,
  meetings: MeetingRow[],
  actions: ActionRow[],
  pdi: OneOnOnePairSummary["pdi"] | undefined,
  settings: OneOnOneSettings,
  categories: Map<string, string>,
  now: Date
): OneOnOnePairSummary {
  const done = meetings.filter((meeting) => meeting.status === "realizada").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const upcoming = meetings
    .filter((meeting) => meeting.status === "agendada" && new Date(meeting.ends_at).getTime() >= now.getTime())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const last = done[0]?.starts_at ?? null;
  const next = upcoming[0] ?? null;
  return {
    leader: personOf(ctx, leaderId) as PdiPerson,
    member: personOf(ctx, memberId) as PdiPerson,
    viewer_role: roleIn(ctx, leaderId, memberId) ?? "rh",
    last_meeting_at: last,
    days_since_last: last ? daysSince(last, now) : null,
    next_meeting: next
      ? { id: next.id, starts_at: next.starts_at, category: next.category_id ? categories.get(next.category_id) ?? null : null, room: roomLabel(settings, next.room_key) }
      : null,
    cadence: cadenceOf(last, next?.starts_at ?? null, settings.overdue_days, now),
    open_actions: actions.filter((action) => !action.done_at).length,
    meetings_done: done.length,
    late_meetings: meetings.filter((meeting) => displayStatus(meeting.status, meeting.ends_at, now) === "atrasada").length,
    pdi: pdi ?? null,
  };
}

async function loadPairsData(ctx: Ctx, filter: { employeeId?: string }) {
  let meetingsQuery = ctx.db.from("hr_one_on_one_meetings").select(MEETING_SELECT);
  let actionsQuery = ctx.db.from("hr_one_on_one_actions").select(ACTION_SELECT);
  if (filter.employeeId) {
    const or = `leader_employee_id.eq.${filter.employeeId},member_employee_id.eq.${filter.employeeId}`;
    meetingsQuery = meetingsQuery.or(or);
    actionsQuery = actionsQuery.or(or);
  }
  const [meetingsResult, actionsResult] = await Promise.all([meetingsQuery, actionsQuery]);
  if (meetingsResult.error) failed("reuniões", meetingsResult.error);
  if (actionsResult.error) failed("ações", actionsResult.error);
  return { meetings: (meetingsResult.data ?? []) as MeetingRow[], actions: (actionsResult.data ?? []) as ActionRow[] };
}

function groupByPair<T extends { leader_employee_id: string; member_employee_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = pairKey(row.leader_employee_id, row.member_employee_id);
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

export async function getOverview(): Promise<OneOnOneOverview> {
  const ctx = await resolveCtx();
  const settings = await loadSettings(ctx);
  const categories = new Map((await loadCategories(ctx)).map((category) => [category.id, category.name]));
  const me = ctx.employeeId;
  const now = new Date();
  if (!me) {
    return { me: null, asLeader: [], asMember: [], upcoming: [], overdue_days: settings.overdue_days, isHr: ctx.isHr };
  }
  const { meetings, actions } = await loadPairsData(ctx, { employeeId: me });
  const meetingsByPair = groupByPair(meetings);
  const actionsByPair = groupByPair(actions);

  // Liderados diretos sempre aparecem; outras duplas, se já tiverem reunião.
  const memberIds = new Set<string>();
  for (const link of ctx.links.values()) if (link.manager_employee_id === me && link.is_active) memberIds.add(link.id);
  const leaderIds = new Set<string>();
  const myManager = ctx.links.get(me)?.manager_employee_id;
  if (myManager) leaderIds.add(myManager);
  for (const meeting of meetings) {
    if (meeting.leader_employee_id === me) memberIds.add(meeting.member_employee_id);
    if (meeting.member_employee_id === me) leaderIds.add(meeting.leader_employee_id);
  }

  const pdi = await loadPdiByMember(ctx, [...memberIds]);
  const build = (leaderId: string, memberId: string) =>
    summarizePair(
      ctx,
      leaderId,
      memberId,
      meetingsByPair.get(pairKey(leaderId, memberId)) ?? [],
      actionsByPair.get(pairKey(leaderId, memberId)) ?? [],
      pdi.get(memberId),
      settings,
      categories,
      now
    );
  const order = { atrasada: 0, sem_reuniao: 1, em_dia: 2 } as const;
  const asLeader = [...memberIds]
    .filter((id) => ctx.people.has(id))
    .map((memberId) => build(me, memberId))
    .sort((a, b) => order[a.cadence] - order[b.cadence] || a.member.name.localeCompare(b.member.name, "pt-BR"));
  const asMember = [...leaderIds].filter((id) => ctx.people.has(id)).map((leaderId) => build(leaderId, me));

  const upcoming = meetings
    .filter((meeting) => meeting.status === "agendada" && new Date(meeting.ends_at).getTime() >= now.getTime() - 60 * 60 * 1000)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 8)
    .map((meeting) => ({
      id: meeting.id,
      starts_at: meeting.starts_at,
      ends_at: meeting.ends_at,
      with: personOf(ctx, meeting.leader_employee_id === me ? meeting.member_employee_id : meeting.leader_employee_id) as PdiPerson,
      category: meeting.category_id ? categories.get(meeting.category_id) ?? null : null,
      room: roomLabel(settings, meeting.room_key),
      leader_id: meeting.leader_employee_id,
      member_id: meeting.member_employee_id,
    }));

  return { me: personOf(ctx, me), asLeader, asMember, upcoming, overdue_days: settings.overdue_days, isHr: ctx.isHr };
}

export async function getPairDetail(leaderId: string, memberId: string): Promise<OneOnOnePairDetail> {
  parse(z.object({ leaderId: uuid, memberId: uuid }), { leaderId, memberId });
  const ctx = await resolveCtx();
  const role = assertPairAccess(ctx, leaderId, memberId);
  const [settings, categoriesList] = await Promise.all([loadSettings(ctx), loadCategories(ctx)]);
  const categories = new Map(categoriesList.map((category) => [category.id, category.name]));
  const now = new Date();

  const [meetingsResult, actionsResult, seriesResult] = await Promise.all([
    ctx.db.from("hr_one_on_one_meetings").select(MEETING_SELECT).eq("leader_employee_id", leaderId).eq("member_employee_id", memberId).order("starts_at", { ascending: false }),
    ctx.db.from("hr_one_on_one_actions").select(ACTION_SELECT).eq("leader_employee_id", leaderId).eq("member_employee_id", memberId).order("created_at", { ascending: false }),
    ctx.db.from("hr_one_on_one_series").select("id, frequency, start_time, ends_on, category_id").eq("leader_employee_id", leaderId).eq("member_employee_id", memberId),
  ]);
  if (meetingsResult.error) failed("reuniões", meetingsResult.error);
  if (actionsResult.error) failed("ações", actionsResult.error);
  if (seriesResult.error) failed("recorrências", seriesResult.error);
  const meetings = (meetingsResult.data ?? []) as MeetingRow[];
  const actions = (actionsResult.data ?? []) as ActionRow[];
  const meetingIds = meetings.map((meeting) => meeting.id);

  const [topicsResult, notesResult] = meetingIds.length
    ? await Promise.all([
        ctx.db.from("hr_one_on_one_topics").select("id, meeting_id, title, source, author_employee_id, discussed, sort_order").in("meeting_id", meetingIds).order("sort_order"),
        ctx.db.from("hr_one_on_one_notes").select("meeting_id, author_employee_id, body, updated_at").in("meeting_id", meetingIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (topicsResult.error) failed("pauta", topicsResult.error);
  if (notesResult.error) failed("anotações", notesResult.error);

  const readOthers = canReadOthersNotes(ctx, settings);
  const today = todayInBrasilia();
  const toAction = (row: ActionRow): OneOnOneAction => ({
    id: row.id,
    meeting_id: row.meeting_id,
    title: row.title,
    owner: personOf(ctx, row.owner_employee_id),
    due_date: row.due_date,
    done_at: row.done_at,
    overdue: !row.done_at && Boolean(row.due_date) && (row.due_date as string) < today,
    created_at: row.created_at,
  });
  const participant = role !== "rh";

  const meetingViews: OneOnOneMeeting[] = meetings.map((meeting) => {
    const status = displayStatus(meeting.status, meeting.ends_at, now);
    const open = meeting.status === "agendada";
    const notes = (notesResult.data ?? [])
      .filter((note) => note.meeting_id === meeting.id)
      .filter((note) => note.author_employee_id === ctx.employeeId || readOthers)
      .filter((note) => (note.body as string).trim().length > 0)
      .map((note) => ({
        author: personOf(ctx, note.author_employee_id as string) as PdiPerson,
        body: note.body as string,
        updated_at: note.updated_at as string,
        mine: note.author_employee_id === ctx.employeeId,
      }));
    const mine = (notesResult.data ?? []).find((note) => note.meeting_id === meeting.id && note.author_employee_id === ctx.employeeId);
    return {
      id: meeting.id,
      starts_at: meeting.starts_at,
      ends_at: meeting.ends_at,
      status: meeting.status,
      display_status: status,
      category: meeting.category_id ? { id: meeting.category_id, name: categories.get(meeting.category_id) ?? "Categoria" } : null,
      room: meeting.room_key ? { key: meeting.room_key, label: roomLabel(settings, meeting.room_key) ?? meeting.room_key } : null,
      teams_join_url: meeting.teams_join_url,
      in_outlook: Boolean(meeting.outlook_event_id),
      topics: (topicsResult.data ?? [])
        .filter((topic) => topic.meeting_id === meeting.id)
        .map((topic) => ({
          id: topic.id as string,
          title: topic.title as string,
          source: topic.source as OneOnOneTopicSource,
          author: personOf(ctx, (topic.author_employee_id as string | null) ?? null),
          discussed: Boolean(topic.discussed),
        })),
      actions: actions.filter((action) => action.meeting_id === meeting.id).map(toAction),
      notes,
      my_note: (mine?.body as string | undefined) ?? "",
      rating: meeting.rating,
      rating_comment: meeting.rating_comment,
      finished_at: meeting.finished_at,
      from_feedz: meeting.feedz_id !== null,
      permissions: {
        canEditAgenda: participant && meeting.status !== "cancelada",
        canFinish: role === "lider" && open,
        canReschedule: open && (role === "lider" || (role === "liderado" && settings.member_can_reschedule) || ctx.isHr),
        canCancel: open && (role === "lider" || (role === "liderado" && settings.member_can_reschedule) || ctx.isHr),
        canRate: role === "liderado" && settings.member_can_rate && meeting.status === "realizada",
        canSeeRating: role !== "liderado" || settings.member_can_rate,
        canWriteNote: participant && meeting.status !== "cancelada",
      },
    };
  });

  // Sugestões de pauta: ações do PDI vencidas ou paradas e o que ficou pendente da dupla.
  const suggestions: OneOnOneSuggestion[] = [];
  const pdi = (await loadPdiByMember(ctx, [memberId])).get(memberId) ?? null;
  if (pdi) {
    const { data: pdiActions } = await ctx.db
      .from("hr_pdi_actions")
      .select("id, title, progress, due_date, last_update_at")
      .eq("plan_id", pdi.id)
      .lt("progress", 100)
      .order("due_date", { ascending: true, nullsFirst: false });
    for (const action of pdiActions ?? []) {
      const overdue = isActionOverdue(action as { due_date: string | null; progress: number }, today);
      const stale = !action.last_update_at || daysSince(action.last_update_at as string, now) > 30;
      if (!overdue && !stale) continue;
      // Ações com o mesmo nome em frentes diferentes (ex.: "20% - Feedback") viram um tópico só.
      if (suggestions.some((item) => item.title === `PDI: ${action.title as string}`)) continue;
      suggestions.push({
        title: `PDI: ${action.title as string}`,
        source: "pdi",
        pdi_action_id: action.id as string,
        hint: overdue ? "prazo vencido" : `em ${action.progress}% e sem atualização recente`,
      });
      if (suggestions.length >= 6) break;
    }
  }
  for (const action of actions.filter((row) => !row.done_at).slice(0, 6)) {
    if (suggestions.some((item) => item.title === `Pendência: ${action.title}`)) continue;
    suggestions.push({ title: `Pendência: ${action.title}`, source: "pendencia", hint: action.due_date ? `prazo ${action.due_date}` : undefined });
  }

  const pairMeetings = meetings;
  const summary = summarizePair(ctx, leaderId, memberId, pairMeetings, actions, pdi, settings, categories, now);
  return {
    summary,
    meetings: meetingViews,
    actions: actions.map(toAction),
    series: (seriesResult.data ?? []).map((row) => ({
      id: row.id as string,
      frequency: row.frequency as "semanal" | "quinzenal" | "mensal",
      start_time: (row.start_time as string).slice(0, 5),
      ends_on: row.ends_on as string,
      category: row.category_id ? categories.get(row.category_id as string) ?? null : null,
    })),
    suggestions,
    categories: categoriesList.filter((category) => category.is_active),
    rooms: settings.rooms,
    permissions: {
      canSchedule: role === "lider" || ctx.isHr || (role === "liderado" && settings.member_can_schedule),
      canCreateAction: participant,
    },
    outlook_ready: outlookReady(),
    viewer_employee_id: ctx.employeeId,
  };
}

export async function getHrOverview(): Promise<OneOnOneHrOverview> {
  const ctx = await requireHr();
  const [settings, categoriesList, data] = await Promise.all([loadSettings(ctx), loadCategories(ctx), loadPairsData(ctx, {})]);
  const categories = new Map(categoriesList.map((category) => [category.id, category.name]));
  const now = new Date();
  const meetingsByPair = groupByPair(data.meetings);
  const actionsByPair = groupByPair(data.actions);

  const pairs = new Map<string, [string, string]>();
  for (const link of ctx.links.values()) {
    if (link.is_active && link.manager_employee_id && ctx.people.has(link.id) && ctx.people.has(link.manager_employee_id)) {
      pairs.set(pairKey(link.manager_employee_id, link.id), [link.manager_employee_id, link.id]);
    }
  }
  for (const meeting of data.meetings) {
    if (ctx.people.has(meeting.leader_employee_id) && ctx.people.has(meeting.member_employee_id)) {
      pairs.set(pairKey(meeting.leader_employee_id, meeting.member_employee_id), [meeting.leader_employee_id, meeting.member_employee_id]);
    }
  }
  const pdi = await loadPdiByMember(ctx, [...new Set([...pairs.values()].map(([, member]) => member))]);
  const summaries = [...pairs.entries()].map(([key, [leaderId, memberId]]) =>
    summarizePair(ctx, leaderId, memberId, meetingsByPair.get(key) ?? [], actionsByPair.get(key) ?? [], pdi.get(memberId), settings, categories, now)
  );

  const history = data.meetings
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, 400)
    .map((meeting) => ({
      id: meeting.id,
      leader: personOf(ctx, meeting.leader_employee_id) as PdiPerson,
      member: personOf(ctx, meeting.member_employee_id) as PdiPerson,
      starts_at: meeting.starts_at,
      status: displayStatus(meeting.status, meeting.ends_at, now),
      category: meeting.category_id ? categories.get(meeting.category_id) ?? null : null,
      rating: meeting.rating,
      from_feedz: meeting.feedz_id !== null,
    }));

  return { pairs: summaries, history, settings, categories: categoriesList };
}

// ---------------------------------------------------------------------------
// Agenda (livre/ocupado no Outlook).
// ---------------------------------------------------------------------------

async function emailsOf(ctx: Ctx, employeeIds: string[]): Promise<Map<string, string>> {
  const { data, error } = await ctx.db.from("hr_employees").select("id, email, user_id").in("id", employeeIds);
  if (error) failed("e-mails", error);
  const userIds = (data ?? []).map((row) => row.user_id).filter(Boolean) as string[];
  const users = new Map<string, string>();
  if (userIds.length) {
    const { data: userRows } = await ctx.db.from("users").select("id, email").in("id", userIds);
    for (const row of userRows ?? []) if (row.email) users.set(row.id as string, row.email as string);
  }
  const result = new Map<string, string>();
  for (const row of data ?? []) {
    const email = (row.user_id ? users.get(row.user_id as string) : null) ?? (row.email as string | null);
    if (email) result.set(row.id as string, email);
  }
  return result;
}

function organizerFor(ctx: Ctx, leaderId: string, memberId: string): string {
  // Quem marca organiza; o RH marcando em nome da dupla usa a agenda do líder.
  return ctx.employeeId === memberId ? memberId : leaderId;
}

export async function getAvailability(input: AvailabilityInput): Promise<AvailabilityResult> {
  const data = parse(
    z.object({
      leader_employee_id: uuid,
      member_employee_id: uuid,
      room_key: z.string().max(40).nullable(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      duration_minutes: z.number().int().min(15).max(240).optional(),
    }),
    input
  );
  const ctx = await resolveCtx();
  const settings = await loadSettings(ctx);
  assertCanSchedule(ctx, settings, data.leader_employee_id, data.member_employee_id);
  const empty: AvailabilityResult = { date: data.date, slots: dayGrid([], data.duration_minutes ?? 60), people: [], error: null };
  if (!outlookReady()) return { ...empty, error: "Agenda do Outlook indisponível agora: os horários aparecem livres, confira a agenda antes de marcar." };
  try {
    const emails = await emailsOf(ctx, [data.leader_employee_id, data.member_employee_id]);
    const organizerId = organizerFor(ctx, data.leader_employee_id, data.member_employee_id);
    const organizer = await mailboxOf(emails.get(organizerId) ?? "");
    const participants: Array<{ label: string; mailbox: string; kind: "pessoa" | "sala"; person: PdiPerson | null }> = [];
    for (const id of [data.leader_employee_id, data.member_employee_id]) {
      const email = emails.get(id);
      const person = ctx.people.get(id) ?? null;
      if (email) participants.push({ label: person?.name ?? "Participante", mailbox: await mailboxOf(email), kind: "pessoa", person });
    }
    const room = data.room_key && data.room_key !== ONLINE_ROOM_KEY ? settings.rooms.find((item) => item.key === data.room_key) : null;
    if (room) participants.push({ label: room.label, mailbox: room.email, kind: "sala", person: null });
    const views = await freeBusy(
      organizer,
      participants.map((item) => item.mailbox),
      localToIso(`${data.date}T08:00`),
      localToIso(`${data.date}T19:00`)
    );
    const rows = participants.map((item) => ({ ...item, view: views.get(item.mailbox.toLowerCase()) ?? "" }));
    return {
      date: data.date,
      slots: dayGrid(rows, data.duration_minutes ?? 60),
      people: rows.map((row) => ({ label: row.label, ok: row.view.length > 0, kind: row.kind, person: row.person, view: row.view })),
      error: null,
    };
  } catch (error) {
    console.error("[1-1] agenda:", error);
    return { ...empty, error: "Não consegui ler a agenda no Outlook agora: os horários aparecem livres, confira a agenda antes de marcar." };
  }
}

// ---------------------------------------------------------------------------
// Escrita: reuniões.
// ---------------------------------------------------------------------------

const topicSchema = z.object({
  title: z.string().trim().min(1, "Tópico vazio.").max(500),
  source: z.enum(["livre", "sugerido", "pdi", "pendencia"]).default("livre"),
  pdi_action_id: uuid.nullable().optional(),
});

const scheduleSchema = z.object({
  leader_employee_id: uuid,
  member_employee_id: uuid,
  category_id: uuid.nullable(),
  start_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Escolha data e horário."),
  duration_minutes: z.number().int().min(15).max(240),
  room_key: z.string().max(40).nullable(),
  topics: z.array(topicSchema).max(30),
  recurrence: z.object({ frequency: z.enum(["semanal", "quinzenal", "mensal"]), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).nullable(),
  create_in_outlook: z.boolean(),
});

function addMinutesLocal(local: string, minutes: number): string {
  return isoToLocal(new Date(new Date(localToIso(local)).getTime() + minutes * 60000).toISOString());
}

async function syncOutlook(
  ctx: Ctx,
  settings: OneOnOneSettings,
  meeting: { id: string; leader: string; member: string; startLocal: string; endLocal: string; roomKey: string | null; category: string | null; topics: string[]; eventId?: string | null; organizer?: string | null }
): Promise<{ id: string; joinUrl: string | null; organizer: string } | null> {
  const emails = await emailsOf(ctx, [meeting.leader, meeting.member]);
  const organizerId = organizerFor(ctx, meeting.leader, meeting.member);
  const organizer = meeting.organizer ?? (await mailboxOf(emails.get(organizerId) ?? ""));
  const otherId = organizerId === meeting.leader ? meeting.member : meeting.leader;
  const attendees: Array<{ email: string; name: string; resource?: boolean }> = [];
  const otherEmail = emails.get(otherId);
  if (otherEmail) attendees.push({ email: otherEmail, name: ctx.people.get(otherId)?.full_name ?? "" });
  const room = meeting.roomKey && meeting.roomKey !== ONLINE_ROOM_KEY ? settings.rooms.find((item) => item.key === meeting.roomKey) : null;
  if (room) attendees.push({ email: room.email, name: room.label, resource: true });
  const input = {
    organizer,
    subject: `1:1 · ${ctx.people.get(meeting.leader)?.name ?? "Líder"} e ${ctx.people.get(meeting.member)?.name ?? "Liderado"}`,
    startLocal: `${meeting.startLocal}:00`,
    endLocal: `${meeting.endLocal}:00`,
    attendees,
    location: room ? room.label : "Microsoft Teams",
    bodyHtml: invitationBody({
      category: meeting.category,
      topics: meeting.topics,
      link: `${PUBLIC_APP_ORIGIN}/1-1/${meeting.leader}/${meeting.member}`,
    }),
  };
  if (meeting.eventId) {
    await updateEvent(meeting.eventId, input);
    return { id: meeting.eventId, joinUrl: null, organizer };
  }
  const created = await createEvent(input);
  return { ...created, organizer };
}

export async function scheduleMeeting(input: ScheduleInput): Promise<{ ids: string[]; warning: string | null }> {
  const data = parse(scheduleSchema, input);
  const ctx = await resolveCtx();
  const settings = await loadSettings(ctx);
  assertCanSchedule(ctx, settings, data.leader_employee_id, data.member_employee_id);
  const categories = new Map((await loadCategories(ctx)).map((category) => [category.id, category.name]));

  const firstDate = data.start_local.slice(0, 10);
  const time = data.start_local.slice(11);
  const dates = data.recurrence ? recurrenceDates(firstDate, data.recurrence.frequency, data.recurrence.until, 26) : [firstDate];
  if (dates.length === 0) throw new RhHttpError("A data final da recorrência é antes da primeira reunião.", 400, "INVALID_INPUT");

  let seriesId: string | null = null;
  if (data.recurrence) {
    const { data: series, error } = await ctx.db
      .from("hr_one_on_one_series")
      .insert({
        leader_employee_id: data.leader_employee_id,
        member_employee_id: data.member_employee_id,
        category_id: data.category_id,
        frequency: data.recurrence.frequency,
        start_time: time,
        duration_minutes: data.duration_minutes,
        room_key: data.room_key,
        starts_on: firstDate,
        ends_on: data.recurrence.until,
        topics: data.topics.map((topic) => topic.title),
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !series) failed("recorrência", error);
    seriesId = series.id as string;
  }

  const ids: string[] = [];
  let warning: string | null = null;
  for (const date of dates) {
    const startLocal = `${date}T${time}`;
    const endLocal = addMinutesLocal(startLocal, data.duration_minutes);
    const { data: meeting, error } = await ctx.db
      .from("hr_one_on_one_meetings")
      .insert({
        leader_employee_id: data.leader_employee_id,
        member_employee_id: data.member_employee_id,
        category_id: data.category_id,
        series_id: seriesId,
        starts_at: localToIso(startLocal),
        ends_at: localToIso(endLocal),
        room_key: data.room_key,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !meeting) failed("reunião", error);
    ids.push(meeting.id as string);
    if (data.topics.length) {
      const { error: topicsError } = await ctx.db.from("hr_one_on_one_topics").insert(
        data.topics.map((topic, index) => ({
          meeting_id: meeting.id,
          title: topic.title,
          source: topic.source,
          pdi_action_id: topic.pdi_action_id ?? null,
          author_employee_id: ctx.employeeId,
          sort_order: index,
        }))
      );
      if (topicsError) failed("pauta", topicsError);
    }
    if (data.create_in_outlook && outlookReady()) {
      try {
        const event = await syncOutlook(ctx, settings, {
          id: meeting.id as string,
          leader: data.leader_employee_id,
          member: data.member_employee_id,
          startLocal,
          endLocal,
          roomKey: data.room_key,
          category: data.category_id ? categories.get(data.category_id) ?? null : null,
          topics: data.topics.map((topic) => topic.title),
        });
        if (event) {
          await ctx.db
            .from("hr_one_on_one_meetings")
            .update({ outlook_event_id: event.id, outlook_organizer: event.organizer, teams_join_url: event.joinUrl })
            .eq("id", meeting.id);
        }
      } catch (outlookError) {
        console.error("[1-1] outlook:", outlookError);
        warning = "A 1:1 foi salva, mas o convite no Outlook não foi criado. Confira a agenda e a sala.";
      }
    }
  }
  return { ids, warning };
}

async function loadMeeting(ctx: Ctx, meetingId: string): Promise<MeetingRow> {
  parse(uuid, meetingId);
  const { data, error } = await ctx.db.from("hr_one_on_one_meetings").select(MEETING_SELECT).eq("id", meetingId).maybeSingle();
  if (error) failed("reunião", error);
  if (!data) throw new RhHttpError("Reunião não encontrada.", 404, "NOT_FOUND");
  return data as MeetingRow;
}

export async function updateMeeting(
  meetingId: string,
  input: {
    action: "remarcar" | "finalizar" | "cancelar" | "avaliar" | "reabrir";
    start_local?: string;
    duration_minutes?: number;
    room_key?: string | null;
    reason?: string | null;
    rating?: number;
    rating_comment?: string | null;
  }
): Promise<{ warning: string | null }> {
  const ctx = await resolveCtx();
  const settings = await loadSettings(ctx);
  const meeting = await loadMeeting(ctx, meetingId);
  const role = assertPairAccess(ctx, meeting.leader_employee_id, meeting.member_employee_id);
  const now = new Date().toISOString();
  let warning: string | null = null;

  if (input.action === "finalizar") {
    if (role !== "lider") throw new RhHttpError("Só o líder finaliza a 1:1.", 403, "FORBIDDEN");
    const { error } = await ctx.db.from("hr_one_on_one_meetings").update({ status: "realizada", finished_at: now, finished_by: ctx.userId, updated_at: now }).eq("id", meetingId);
    if (error) failed("finalizar", error);
    return { warning };
  }
  if (input.action === "reabrir") {
    if (role !== "lider" && !ctx.isHr) throw new RhHttpError("Só o líder reabre a 1:1.", 403, "FORBIDDEN");
    const { error } = await ctx.db.from("hr_one_on_one_meetings").update({ status: "agendada", finished_at: null, finished_by: null, updated_at: now }).eq("id", meetingId);
    if (error) failed("reabrir", error);
    return { warning };
  }
  if (input.action === "avaliar") {
    if (role !== "liderado" || !settings.member_can_rate) throw new RhHttpError("Só o liderado avalia a 1:1.", 403, "FORBIDDEN");
    if (meeting.status !== "realizada") throw new RhHttpError("Dá para avaliar depois que a 1:1 for finalizada.", 400, "INVALID_INPUT");
    const rating = parse(z.number().int().min(1).max(5), input.rating);
    const comment = parse(z.string().trim().max(2000).nullable().optional(), input.rating_comment) || null;
    const { error } = await ctx.db.from("hr_one_on_one_meetings").update({ rating, rating_comment: comment, rated_at: now, updated_at: now }).eq("id", meetingId);
    if (error) failed("avaliar", error);
    return { warning };
  }

  const canChange = role === "lider" || ctx.isHr || (role === "liderado" && settings.member_can_reschedule);
  if (!canChange || meeting.status !== "agendada") throw new RhHttpError("Você não pode mudar esta 1:1.", 403, "FORBIDDEN");

  if (input.action === "cancelar") {
    const reason = parse(z.string().trim().max(1000).nullable().optional(), input.reason) || null;
    const { error } = await ctx.db.from("hr_one_on_one_meetings").update({ status: "cancelada", cancel_reason: reason, updated_at: now }).eq("id", meetingId);
    if (error) failed("cancelar", error);
    if (meeting.outlook_event_id && meeting.outlook_organizer) {
      try {
        await cancelEvent(meeting.outlook_organizer, meeting.outlook_event_id, reason ?? "1:1 cancelada no ORQESTRAI.");
      } catch (outlookError) {
        console.error("[1-1] cancelar no outlook:", outlookError);
        warning = "A 1:1 foi cancelada aqui, mas o convite no Outlook não. Cancele o convite na agenda.";
      }
    }
    return { warning };
  }

  // remarcar
  const data = parse(
    z.object({
      start_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Escolha data e horário."),
      duration_minutes: z.number().int().min(15).max(240),
      room_key: z.string().max(40).nullable(),
    }),
    { start_local: input.start_local, duration_minutes: input.duration_minutes, room_key: input.room_key ?? null }
  );
  const endLocal = addMinutesLocal(data.start_local, data.duration_minutes);
  const { error } = await ctx.db
    .from("hr_one_on_one_meetings")
    .update({ starts_at: localToIso(data.start_local), ends_at: localToIso(endLocal), room_key: data.room_key, updated_at: now })
    .eq("id", meetingId);
  if (error) failed("remarcar", error);
  if (meeting.outlook_event_id && meeting.outlook_organizer) {
    try {
      const categories = new Map((await loadCategories(ctx)).map((category) => [category.id, category.name]));
      const { data: topics } = await ctx.db.from("hr_one_on_one_topics").select("title").eq("meeting_id", meetingId).order("sort_order");
      await syncOutlook(ctx, settings, {
        id: meetingId,
        leader: meeting.leader_employee_id,
        member: meeting.member_employee_id,
        startLocal: data.start_local,
        endLocal,
        roomKey: data.room_key,
        category: meeting.category_id ? categories.get(meeting.category_id) ?? null : null,
        topics: (topics ?? []).map((topic) => topic.title as string),
        eventId: meeting.outlook_event_id,
        organizer: meeting.outlook_organizer,
      });
    } catch (outlookError) {
      console.error("[1-1] remarcar no outlook:", outlookError);
      warning = "A 1:1 foi remarcada aqui, mas o convite no Outlook não mudou. Ajuste a agenda.";
    }
  }
  return { warning };
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  const ctx = await resolveCtx();
  const meeting = await loadMeeting(ctx, meetingId);
  const role = assertPairAccess(ctx, meeting.leader_employee_id, meeting.member_employee_id);
  if (role !== "lider" && !ctx.isHr && meeting.created_by !== ctx.userId) {
    throw new RhHttpError("Só o líder ou o RH excluem a 1:1.", 403, "FORBIDDEN");
  }
  if (meeting.status === "agendada" && meeting.outlook_event_id && meeting.outlook_organizer) {
    await cancelEvent(meeting.outlook_organizer, meeting.outlook_event_id, "1:1 excluída no ORQESTRAI.").catch((error) =>
      console.error("[1-1] excluir no outlook:", error)
    );
  }
  // A pauta e as anotações saem em cascata; as ações combinadas nesta reunião também vão embora.
  const { error: actionsError } = await ctx.db.from("hr_one_on_one_actions").delete().eq("meeting_id", meetingId);
  if (actionsError) failed("excluir as ações da reunião", actionsError);
  const { error } = await ctx.db.from("hr_one_on_one_meetings").delete().eq("id", meetingId);
  if (error) failed("excluir", error);
}

// ---------------------------------------------------------------------------
// Escrita: pauta, ações e anotações.
// ---------------------------------------------------------------------------

async function assertParticipant(ctx: Ctx, meeting: MeetingRow) {
  const role = assertPairAccess(ctx, meeting.leader_employee_id, meeting.member_employee_id);
  if (role === "rh") throw new RhHttpError("Só os participantes mexem na pauta e nas anotações.", 403, "FORBIDDEN");
  if (meeting.status === "cancelada") throw new RhHttpError("Esta 1:1 foi cancelada.", 400, "INVALID_INPUT");
  return role;
}

export async function addTopic(meetingId: string, input: { title: string; source?: OneOnOneTopicSource; pdi_action_id?: string | null }) {
  const ctx = await resolveCtx();
  const meeting = await loadMeeting(ctx, meetingId);
  await assertParticipant(ctx, meeting);
  const data = parse(topicSchema, input);
  const { count } = await ctx.db.from("hr_one_on_one_topics").select("id", { count: "exact", head: true }).eq("meeting_id", meetingId);
  const { error } = await ctx.db.from("hr_one_on_one_topics").insert({
    meeting_id: meetingId,
    title: data.title,
    source: data.source,
    pdi_action_id: data.pdi_action_id ?? null,
    author_employee_id: ctx.employeeId,
    sort_order: count ?? 0,
  });
  if (error) failed("pauta", error);
}

async function loadTopicMeeting(ctx: Ctx, topicId: string) {
  parse(uuid, topicId);
  const { data, error } = await ctx.db.from("hr_one_on_one_topics").select("id, meeting_id, author_employee_id").eq("id", topicId).maybeSingle();
  if (error) failed("tópico", error);
  if (!data) throw new RhHttpError("Tópico não encontrado.", 404, "NOT_FOUND");
  const meeting = await loadMeeting(ctx, data.meeting_id as string);
  const role = await assertParticipant(ctx, meeting);
  return { topic: data, role };
}

export async function updateTopic(topicId: string, input: { discussed?: boolean; title?: string }) {
  const ctx = await resolveCtx();
  await loadTopicMeeting(ctx, topicId);
  const data = parse(z.object({ discussed: z.boolean().optional(), title: z.string().trim().min(1).max(500).optional() }), input);
  const { error } = await ctx.db.from("hr_one_on_one_topics").update(data).eq("id", topicId);
  if (error) failed("tópico", error);
}

export async function deleteTopic(topicId: string) {
  const ctx = await resolveCtx();
  const { topic, role } = await loadTopicMeeting(ctx, topicId);
  if (role !== "lider" && topic.author_employee_id !== ctx.employeeId) {
    throw new RhHttpError("Só quem incluiu o tópico ou o líder podem tirar.", 403, "FORBIDDEN");
  }
  const { error } = await ctx.db.from("hr_one_on_one_topics").delete().eq("id", topicId);
  if (error) failed("tópico", error);
}

export async function createAction(input: {
  leader_employee_id: string;
  member_employee_id: string;
  meeting_id?: string | null;
  title: string;
  owner_employee_id: string | null;
  due_date: string | null;
}) {
  const data = parse(
    z.object({
      leader_employee_id: uuid,
      member_employee_id: uuid,
      meeting_id: uuid.nullable().optional(),
      title: z.string().trim().min(2, "Descreva a ação.").max(1000),
      owner_employee_id: uuid.nullable(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    }),
    input
  );
  const ctx = await resolveCtx();
  const role = assertPairAccess(ctx, data.leader_employee_id, data.member_employee_id);
  if (role === "rh") throw new RhHttpError("Só os participantes registram ações.", 403, "FORBIDDEN");
  if (data.owner_employee_id && ![data.leader_employee_id, data.member_employee_id].includes(data.owner_employee_id)) {
    throw new RhHttpError("O responsável é o líder ou o liderado.", 400, "INVALID_INPUT");
  }
  const { error } = await ctx.db.from("hr_one_on_one_actions").insert({ ...data, meeting_id: data.meeting_id ?? null, created_by: ctx.userId });
  if (error) failed("ação", error);
}

export async function updateAction(actionId: string, input: { done?: boolean; title?: string; due_date?: string | null }) {
  parse(uuid, actionId);
  const ctx = await resolveCtx();
  const { data: action, error } = await ctx.db.from("hr_one_on_one_actions").select(ACTION_SELECT).eq("id", actionId).maybeSingle();
  if (error) failed("ação", error);
  if (!action) throw new RhHttpError("Ação não encontrada.", 404, "NOT_FOUND");
  const role = assertPairAccess(ctx, action.leader_employee_id as string, action.member_employee_id as string);
  if (role === "rh") throw new RhHttpError("Só os participantes mexem nas ações.", 403, "FORBIDDEN");
  const data = parse(
    z.object({ done: z.boolean().optional(), title: z.string().trim().min(2).max(1000).optional(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }),
    input
  );
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (data.title !== undefined) patch.title = data.title;
  if (data.due_date !== undefined) patch.due_date = data.due_date;
  if (data.done !== undefined) {
    patch.done_at = data.done ? now : null;
    patch.done_by = data.done ? ctx.userId : null;
  }
  const { error: updateError } = await ctx.db.from("hr_one_on_one_actions").update(patch).eq("id", actionId);
  if (updateError) failed("ação", updateError);
}

export async function deleteAction(actionId: string) {
  parse(uuid, actionId);
  const ctx = await resolveCtx();
  const { data: action, error } = await ctx.db.from("hr_one_on_one_actions").select(ACTION_SELECT).eq("id", actionId).maybeSingle();
  if (error) failed("ação", error);
  if (!action) throw new RhHttpError("Ação não encontrada.", 404, "NOT_FOUND");
  const role = assertPairAccess(ctx, action.leader_employee_id as string, action.member_employee_id as string);
  if (role !== "lider" && action.created_by !== ctx.userId) throw new RhHttpError("Só quem criou a ação ou o líder podem excluir.", 403, "FORBIDDEN");
  const { error: deleteError } = await ctx.db.from("hr_one_on_one_actions").delete().eq("id", actionId);
  if (deleteError) failed("ação", deleteError);
}

export async function saveNote(meetingId: string, body: string) {
  const ctx = await resolveCtx();
  const meeting = await loadMeeting(ctx, meetingId);
  await assertParticipant(ctx, meeting);
  const text = parse(z.string().max(30000, "Anotação muito longa."), body);
  const { error } = await ctx.db
    .from("hr_one_on_one_notes")
    .upsert({ meeting_id: meetingId, author_employee_id: ctx.employeeId, body: text, updated_at: new Date().toISOString() }, { onConflict: "meeting_id,author_employee_id" });
  if (error) failed("anotação", error);
}

// ---------------------------------------------------------------------------
// RH: configurações e categorias.
// ---------------------------------------------------------------------------

export async function saveSettings(input: Partial<OneOnOneSettings>) {
  const ctx = await requireHr();
  const data = parse(
    z.object({
      private_notes_readers: z.enum(["nenhum", "admin", "rh"]).optional(),
      email_agenda_enabled: z.boolean().optional(),
      email_reminder_enabled: z.boolean().optional(),
      overdue_days: z.number().int().min(7).max(180).optional(),
      member_can_schedule: z.boolean().optional(),
      member_can_reschedule: z.boolean().optional(),
      member_can_rate: z.boolean().optional(),
      rooms: z
        .array(z.object({ key: z.string().trim().min(1).max(40), label: z.string().trim().min(1).max(60), email: z.string().trim().email() }))
        .max(20)
        .optional(),
    }),
    input
  );
  const { error } = await ctx.db
    .from("hr_one_on_one_settings")
    .update({ ...data, updated_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq("id", true);
  if (error) failed("configurações", error);
}

export async function saveCategory(input: { id?: string; name: string; suggested_topics: string[]; is_active: boolean }) {
  const ctx = await requireHr();
  const data = parse(
    z.object({
      id: uuid.optional(),
      name: z.string().trim().min(2).max(120),
      suggested_topics: z.array(z.string().trim().min(1).max(300)).max(20),
      is_active: z.boolean(),
    }),
    input
  );
  const row = { name: data.name, suggested_topics: data.suggested_topics, is_active: data.is_active };
  const { data: saved, error } = data.id
    ? await ctx.db.from("hr_one_on_one_categories").update(row).eq("id", data.id).select("id").single()
    : await ctx.db.from("hr_one_on_one_categories").insert({ ...row, sort_order: 100 }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new RhHttpError("Já existe uma categoria com esse nome.", 409, "DUPLICATE");
    failed("categoria", error);
  }
  return { id: saved?.id as string };
}

