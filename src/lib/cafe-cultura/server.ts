import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildCafeWindow, getCheckinWindowState } from "./dates";
import { buildCafeEditionDraft, summarizeCafeParticipants } from "./domain";
import { isCafeRosterEligible, planCafeRosterSync } from "./roster";
import type {
  CafeAdminData,
  CafeAdminEdition,
  CafeCheckinSource,
  CafeCurrentView,
  CafeExpectationSource,
  CafeExpectationStatus,
} from "./types";

const CAFE_SERIES_SLUG = "cafe-com-cultura";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export class CafeCulturaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

export function createCafeAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new CafeCulturaError("Serviço temporariamente indisponível.", 503, "SERVICE_UNAVAILABLE");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function saoPauloYearMonth(now: Date): { year: number; monthIndex: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { year, monthIndex: month - 1 };
}

async function getCafeSeriesId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .from("event_series")
    .select("id")
    .eq("slug", CAFE_SERIES_SLUG)
    .maybeSingle();
  if (error || !data) {
    throw new CafeCulturaError("A série Café com Cultura ainda não está configurada.", 503, "SERIES_NOT_FOUND");
  }
  return String(data.id);
}

async function ensureEdition(
  admin: SupabaseClient,
  seriesId: string,
  year: number,
  monthIndex: number
): Promise<string> {
  const draft = buildCafeEditionDraft(year, monthIndex);
  const { data: existing, error: lookupError } = await admin
    .from("events")
    .select("id")
    .eq("year", year)
    .eq("name", draft.name)
    .maybeSingle();
  if (lookupError) throw new CafeCulturaError("Não foi possível consultar a edição mensal.", 500, "EDITION_LOOKUP_FAILED");
  if (existing?.id) return String(existing.id);

  const { data, error } = await admin
    .from("events")
    .insert({
      year,
      name: draft.name,
      series_id: seriesId,
      kind: "evento",
      month_label: draft.monthLabel,
      event_date: draft.eventDate,
      status: "em_andamento",
      objectives: "Encontro mensal obrigatório de integração, conteúdo e cultura do escritório.",
      event_type: "interno",
      target_audience: "Colaboradores",
      requesting_area: "Pessoas e Cultura",
      priority: "normal",
      stage_status: "em_producao",
      risk_level: "baixo",
      checkin_opens_at: draft.checkinOpensAt,
      checkin_closes_at: draft.checkinClosesAt,
    })
    .select("id")
    .single();
  if (!error && data?.id) return String(data.id);

  const { data: concurrent } = await admin
    .from("events")
    .select("id")
    .eq("year", year)
    .eq("name", draft.name)
    .maybeSingle();
  if (concurrent?.id) return String(concurrent.id);
  throw new CafeCulturaError("Não foi possível criar a edição mensal.", 500, "EDITION_CREATE_FAILED");
}

export async function refreshCafeEventCounts(
  eventId: string,
  admin: SupabaseClient = createCafeAdminClient()
) {
  const { data, error } = await admin
    .from("event_participants")
    .select("expectation_status, checkin_at")
    .eq("event_id", eventId);
  if (error) throw new CafeCulturaError("Não foi possível atualizar os indicadores.", 500, "COUNT_LOOKUP_FAILED");
  const summary = summarizeCafeParticipants(
    (data ?? []).map((row) => ({
      expectationStatus: row.expectation_status as CafeExpectationStatus,
      checkinAt: (row.checkin_at as string | null) ?? null,
    }))
  );
  const { error: updateError } = await admin
    .from("events")
    .update({ participants_expected: summary.expected, participants_actual: summary.present })
    .eq("id", eventId);
  if (updateError) throw new CafeCulturaError("Não foi possível atualizar os indicadores.", 500, "COUNT_UPDATE_FAILED");
  return summary;
}

export async function ensureEventRoster(
  eventId: string,
  admin: SupabaseClient = createCafeAdminClient()
): Promise<{ added: number; total: number }> {
  await assertCafeEvent(admin, eventId);
  const [employeesResult, existingResult] = await Promise.all([
    admin
      .from("hr_employees")
      .select("user_id")
      .eq("is_active", true)
      .not("user_id", "is", null),
    admin
      .from("event_participants")
      .select("id, user_id, expectation_source, checkin_at")
      .eq("event_id", eventId),
  ]);
  if (employeesResult.error || existingResult.error) {
    throw new CafeCulturaError("Não foi possível atualizar a lista de colaboradores.", 500, "ROSTER_LOOKUP_FAILED");
  }

  const officialUserIds = [
    ...new Set(
      (employeesResult.data ?? [])
        .map((row) => row.user_id as string | null)
        .filter((userId): userId is string => Boolean(userId))
    ),
  ];
  const plan = planCafeRosterSync(
    officialUserIds,
    (existingResult.data ?? []).map((row) => ({
      participantId: String(row.id),
      userId: String(row.user_id),
      expectationSource: row.expectation_source as CafeExpectationSource,
      checkinAt: (row.checkin_at as string | null) ?? null,
    }))
  );

  if (plan.removableParticipantIds.length) {
    const { error } = await admin
      .from("event_participants")
      .delete()
      .in("id", plan.removableParticipantIds);
    if (error) {
      throw new CafeCulturaError("Não foi possível remover contas fora do cadastro oficial.", 500, "ROSTER_CLEANUP_FAILED");
    }
  }

  if (plan.missingUserIds.length) {
    const { error } = await admin.from("event_participants").insert(
      plan.missingUserIds.map((userId) => ({
        event_id: eventId,
        user_id: userId,
        expectation_status: "confirmed",
        expectation_source: "automatic_roster",
      }))
    );
    if (error) throw new CafeCulturaError("Não foi possível incluir os colaboradores.", 500, "ROSTER_INSERT_FAILED");
  }
  const summary = await refreshCafeEventCounts(eventId, admin);
  return { added: plan.missingUserIds.length, total: summary.total };
}

export async function ensureCafeEditions(
  now: Date = new Date(),
  admin: SupabaseClient = createCafeAdminClient()
): Promise<string[]> {
  const seriesId = await getCafeSeriesId(admin);
  const current = saoPauloYearMonth(now);
  const nextDate = new Date(Date.UTC(current.year, current.monthIndex + 1, 1, 12));
  const editions = [
    current,
    { year: nextDate.getUTCFullYear(), monthIndex: nextDate.getUTCMonth() },
  ];
  const eventIds: string[] = [];
  for (const edition of editions) {
    const eventId = await ensureEdition(admin, seriesId, edition.year, edition.monthIndex);
    await ensureEventRoster(eventId, admin);
    eventIds.push(eventId);
  }
  return eventIds;
}

export async function listCafeAdminEditions(
  now: Date = new Date(),
  admin: SupabaseClient = createCafeAdminClient()
): Promise<CafeAdminEdition[]> {
  await ensureCafeEditions(now, admin);
  const seriesId = await getCafeSeriesId(admin);
  const { data: events, error } = await admin
    .from("events")
    .select("id,name,event_date,location,attendance_cutoff_at,checkin_opens_at,checkin_closes_at")
    .eq("series_id", seriesId)
    .order("event_date", { ascending: false });
  if (error) {
    throw new CafeCulturaError("Não foi possível carregar as edições.", 500, "EDITIONS_LOOKUP_FAILED");
  }

  const ids = (events ?? []).map((event) => String(event.id));
  const { data: participantRows, error: participantError } = ids.length
    ? await admin
        .from("event_participants")
        .select("event_id,expectation_status,checkin_at")
        .in("event_id", ids)
    : { data: [], error: null };
  if (participantError) {
    throw new CafeCulturaError("Não foi possível carregar os indicadores das edições.", 500, "EDITIONS_COUNTS_FAILED");
  }

  const participantsByEvent = new Map<
    string,
    Array<{ expectationStatus: CafeExpectationStatus; checkinAt: string | null }>
  >();
  for (const row of participantRows ?? []) {
    const eventId = String(row.event_id);
    const current = participantsByEvent.get(eventId) ?? [];
    current.push({
      expectationStatus: row.expectation_status as CafeExpectationStatus,
      checkinAt: (row.checkin_at as string | null) ?? null,
    });
    participantsByEvent.set(eventId, current);
  }

  return (events ?? []).map((event) => {
    const eventDate = String(event.event_date);
    const fallback = buildCafeWindow(eventDate);
    return {
      id: String(event.id),
      name: String(event.name),
      eventDate,
      location: (event.location as string | null) ?? null,
      attendanceCutoffAt: (event.attendance_cutoff_at as string | null) ?? null,
      checkinOpensAt: (event.checkin_opens_at as string | null) ?? fallback.opensAt,
      checkinClosesAt: (event.checkin_closes_at as string | null) ?? fallback.closesAt,
      summary: summarizeCafeParticipants(participantsByEvent.get(String(event.id)) ?? []),
    };
  });
}

export async function getCafeProfileForAuthUser(
  authUserId: string,
  admin: SupabaseClient = createCafeAdminClient()
): Promise<{ id: string; name: string; avatarUrl: string | null }> {
  const { data, error } = await admin
    .from("users")
    .select("id, name, avatar_url, is_active")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error || !data) {
    throw new CafeCulturaError("Seu usuário não está ativo no cadastro de colaboradores.", 403, "PROFILE_UNAVAILABLE");
  }

  const { data: employee, error: employeeError } = await admin
    .from("hr_employees")
    .select("id")
    .eq("user_id", data.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (
    employeeError ||
    !isCafeRosterEligible({
      userActive: data.is_active !== false,
      hasActiveEmployee: Boolean(employee),
    })
  ) {
    throw new CafeCulturaError("Seu usuário não consta no cadastro oficial de colaboradores.", 403, "PROFILE_UNAVAILABLE");
  }
  return { id: String(data.id), name: String(data.name), avatarUrl: (data.avatar_url as string | null) ?? null };
}

function monthBounds(now: Date): { first: string; last: string } {
  const { year, monthIndex } = saoPauloYearMonth(now);
  const month = String(monthIndex + 1).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return { first: `${year}-${month}-01`, last: `${year}-${month}-${String(lastDay).padStart(2, "0")}` };
}

async function loadCurrentEvent(admin: SupabaseClient, now: Date) {
  const seriesId = await getCafeSeriesId(admin);
  const bounds = monthBounds(now);
  const { data, error } = await admin
    .from("events")
    .select("id, name, event_date, location, attendance_cutoff_at, checkin_opens_at, checkin_closes_at")
    .eq("series_id", seriesId)
    .gte("event_date", bounds.first)
    .lte("event_date", bounds.last)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new CafeCulturaError("Não foi possível consultar o encontro deste mês.", 500, "CURRENT_EVENT_LOOKUP_FAILED");
  if (!data) throw new CafeCulturaError("O Café com Cultura deste mês ainda não foi configurado.", 404, "CURRENT_EVENT_NOT_FOUND");
  const eventDate = String(data.event_date);
  const fallback = buildCafeWindow(eventDate);
  return {
    id: String(data.id),
    name: String(data.name),
    eventDate,
    location: (data.location as string | null) ?? null,
    attendanceCutoffAt: (data.attendance_cutoff_at as string | null) ?? null,
    checkinOpensAt: (data.checkin_opens_at as string | null) ?? fallback.opensAt,
    checkinClosesAt: (data.checkin_closes_at as string | null) ?? fallback.closesAt,
  };
}

export async function getCurrentCafeForUser(
  profileId: string,
  now: Date = new Date(),
  admin: SupabaseClient = createCafeAdminClient()
): Promise<CafeCurrentView> {
  const event = await loadCurrentEvent(admin, now);
  const { data: existingParticipant, error } = await admin
    .from("event_participants")
    .select("id, expectation_status, checkin_at")
    .eq("event_id", event.id)
    .eq("user_id", profileId)
    .maybeSingle();
  if (error) throw new CafeCulturaError("Não foi possível consultar sua participação.", 500, "PARTICIPANT_LOOKUP_FAILED");
  let participant = existingParticipant;
  if (!participant) {
    const { data, error: insertError } = await admin
      .from("event_participants")
      .insert({ event_id: event.id, user_id: profileId })
      .select("id, expectation_status, checkin_at")
      .single();
    if (insertError || !data) throw new CafeCulturaError("Você não está na lista desta edição.", 409, "PARTICIPANT_CREATE_FAILED");
    participant = data;
    await refreshCafeEventCounts(event.id, admin);
  }
  const { data: user } = await admin
    .from("users")
    .select("name, avatar_url")
    .eq("id", profileId)
    .maybeSingle();
  if (!user) throw new CafeCulturaError("Colaborador não encontrado.", 404, "USER_NOT_FOUND");
  return {
    event,
    collaborator: {
      id: profileId,
      name: String(user.name),
      avatarUrl: (user.avatar_url as string | null) ?? null,
      expectationStatus: participant.expectation_status as CafeExpectationStatus,
      checkinAt: (participant.checkin_at as string | null) ?? null,
    },
    windowState: getCheckinWindowState(now, event.checkinOpensAt, event.checkinClosesAt),
  };
}

export async function registerCafeCheckin(
  profileId: string,
  now: Date = new Date(),
  source: Exclude<CafeCheckinSource, "admin"> = "nfc",
  admin: SupabaseClient = createCafeAdminClient()
): Promise<CafeCurrentView> {
  const current = await getCurrentCafeForUser(profileId, now, admin);
  if (current.windowState === "before") {
    throw new CafeCulturaError("O check-in ainda não foi aberto.", 409, "CHECKIN_NOT_OPEN");
  }
  if (current.windowState === "closed") {
    throw new CafeCulturaError("A janela de check-in desta edição foi encerrada.", 409, "CHECKIN_CLOSED");
  }
  if (current.collaborator.expectationStatus === "excluded") {
    throw new CafeCulturaError("Seu cadastro não está incluído nesta edição.", 403, "PARTICIPANT_EXCLUDED");
  }
  if (current.collaborator.checkinAt) return current;

  const checkedInAt = now.toISOString();
  const { error } = await admin
    .from("event_participants")
    .update({ checkin_at: checkedInAt, checkin_source: source })
    .eq("event_id", current.event.id)
    .eq("user_id", profileId)
    .is("checkin_at", null);
  if (error) throw new CafeCulturaError("Não foi possível registrar sua presença.", 500, "CHECKIN_SAVE_FAILED");
  await Promise.all([
    refreshCafeEventCounts(current.event.id, admin),
    admin.from("event_history").insert({
      event_id: current.event.id,
      action_type: "presenca",
      action_label: `Check-in registrado por ${current.collaborator.name}`,
      actor_user_id: profileId,
      payload: { userId: profileId, source },
    }),
  ]);
  return {
    ...current,
    collaborator: { ...current.collaborator, checkinAt: checkedInAt },
  };
}

async function assertCafeEvent(admin: SupabaseClient, eventId: string) {
  const { data, error } = await admin
    .from("events")
    .select("id, name, event_date, location, attendance_cutoff_at, checkin_opens_at, checkin_closes_at, series_id")
    .eq("id", eventId)
    .maybeSingle();
  if (error || !data) throw new CafeCulturaError("Evento não encontrado.", 404, "EVENT_NOT_FOUND");
  const { data: series } = await admin.from("event_series").select("slug").eq("id", data.series_id).maybeSingle();
  if (series?.slug !== CAFE_SERIES_SLUG) {
    throw new CafeCulturaError("Este evento não pertence ao Café com Cultura.", 409, "WRONG_EVENT_SERIES");
  }
  const eventDate = String(data.event_date);
  const fallback = buildCafeWindow(eventDate);
  return {
    id: String(data.id),
    name: String(data.name),
    eventDate,
    location: (data.location as string | null) ?? null,
    attendanceCutoffAt: (data.attendance_cutoff_at as string | null) ?? null,
    checkinOpensAt: (data.checkin_opens_at as string | null) ?? fallback.opensAt,
    checkinClosesAt: (data.checkin_closes_at as string | null) ?? fallback.closesAt,
  };
}

export async function getCafeAdminData(
  eventId: string,
  admin: SupabaseClient = createCafeAdminClient()
): Promise<CafeAdminData> {
  const event = await assertCafeEvent(admin, eventId);
  const [{ data, error }, { data: lastSync }] = await Promise.all([
    admin
      .from("event_participants")
      .select("id, user_id, expectation_status, expectation_source, checkin_at, checkin_source, responsum_ticket_ids, users:user_id(name,email,department,avatar_url)")
      .eq("event_id", eventId),
    admin
      .from("event_attendance_sync_runs")
      .select("status,tickets_found,participants_updated,unmatched_tickets,started_at,finished_at")
      .eq("event_id", eventId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) throw new CafeCulturaError("Não foi possível carregar as presenças.", 500, "ADMIN_ATTENDANCE_FAILED");
  const participants = (data ?? []).map((row) => {
    const raw = row.users as unknown;
    const user = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      name: String(user?.name ?? "Colaborador"),
      email: (user?.email as string | null) ?? null,
      department: (user?.department as string | null) ?? null,
      avatarUrl: (user?.avatar_url as string | null) ?? null,
      expectationStatus: row.expectation_status as CafeExpectationStatus,
      expectationSource: row.expectation_source as CafeAdminData["participants"][number]["expectationSource"],
      checkinAt: (row.checkin_at as string | null) ?? null,
      checkinSource: (row.checkin_source as CafeCheckinSource | null) ?? null,
      responsumTicketCount: Array.isArray(row.responsum_ticket_ids) ? row.responsum_ticket_ids.length : 0,
    };
  });
  const summary = summarizeCafeParticipants(participants);
  return {
    event,
    summary,
    participants: participants.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    lastSync: lastSync
      ? {
          status: lastSync.status as "running" | "success" | "error",
          ticketsFound: Number(lastSync.tickets_found),
          participantsUpdated: Number(lastSync.participants_updated),
          unmatchedTickets: Number(lastSync.unmatched_tickets),
          startedAt: String(lastSync.started_at),
          finishedAt: (lastSync.finished_at as string | null) ?? null,
        }
      : null,
  };
}

export async function updateCafeEventSettings(
  eventId: string,
  input: {
    name?: string;
    eventDate?: string;
    location?: string | null;
    attendanceCutoffAt?: string | null;
    checkinOpensAt?: string;
    checkinClosesAt?: string;
  },
  actorProfileId: string,
  admin: SupabaseClient = createCafeAdminClient()
) {
  const previous = await assertCafeEvent(admin, eventId);
  const name = input.name?.trim();
  if (input.name !== undefined && !name) {
    throw new CafeCulturaError("Informe o nome da edição.", 400, "INVALID_EDITION_NAME");
  }
  const eventDate = input.eventDate ?? previous.eventDate;
  const defaultWindow = buildCafeWindow(eventDate);
  const payload = {
    name: name ?? previous.name,
    event_date: eventDate,
    location: input.location === undefined ? previous.location : input.location,
    attendance_cutoff_at:
      input.attendanceCutoffAt === undefined ? previous.attendanceCutoffAt : input.attendanceCutoffAt,
    checkin_opens_at: input.checkinOpensAt ?? (input.eventDate ? defaultWindow.opensAt : previous.checkinOpensAt),
    checkin_closes_at: input.checkinClosesAt ?? (input.eventDate ? defaultWindow.closesAt : previous.checkinClosesAt),
  };
  if (new Date(payload.checkin_closes_at) <= new Date(payload.checkin_opens_at)) {
    throw new CafeCulturaError("O encerramento deve ocorrer depois da abertura.", 400, "INVALID_CHECKIN_WINDOW");
  }
  const { error } = await admin.from("events").update(payload).eq("id", eventId);
  if (error) throw new CafeCulturaError("Não foi possível salvar a configuração.", 500, "SETTINGS_SAVE_FAILED");
  await admin.from("event_history").insert({
    event_id: eventId,
    action_type: "presenca_configuracao",
    action_label: "Configuração de presença atualizada",
    actor_user_id: actorProfileId,
    payload: { previous, next: payload },
  });
  return getCafeAdminData(eventId, admin);
}

export async function updateCafeParticipant(
  eventId: string,
  userId: string,
  input: { expectationStatus?: CafeExpectationStatus; present?: boolean },
  actorProfileId: string,
  admin: SupabaseClient = createCafeAdminClient()
) {
  await assertCafeEvent(admin, eventId);
  const { data: previous } = await admin
    .from("event_participants")
    .select("expectation_status,expectation_source,checkin_at,checkin_source")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!previous) throw new CafeCulturaError("Colaborador não encontrado nesta edição.", 404, "PARTICIPANT_NOT_FOUND");
  const patch: Record<string, unknown> = {};
  if (input.expectationStatus) {
    patch.expectation_status = input.expectationStatus;
    patch.expectation_source = "admin";
  }
  if (input.present !== undefined) {
    patch.checkin_at = input.present ? new Date().toISOString() : null;
    patch.checkin_source = input.present ? "admin" : null;
  }
  if (!Object.keys(patch).length) throw new CafeCulturaError("Nenhuma alteração informada.", 400, "EMPTY_UPDATE");
  const { error } = await admin
    .from("event_participants")
    .update(patch)
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new CafeCulturaError("Não foi possível corrigir a participação.", 500, "PARTICIPANT_UPDATE_FAILED");
  await Promise.all([
    refreshCafeEventCounts(eventId, admin),
    admin.from("event_history").insert({
      event_id: eventId,
      action_type: "presenca_correcao",
      action_label: "Participação corrigida manualmente",
      actor_user_id: actorProfileId,
      payload: { userId, previous, next: patch },
    }),
  ]);
  return getCafeAdminData(eventId, admin);
}
