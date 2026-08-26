import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  mapResponsumAbsences,
  selectResponsumServiceKey,
  type ResponsumAbsenceTicket,
} from "./responsum-domain";
import {
  CafeCulturaError,
  createCafeAdminClient,
  ensureCafeEditions,
  ensureEventRoster,
  refreshCafeEventCounts,
} from "./server";

const RESPONSUM_PROJECT_REF = "jhgbrbarfpvgdaaznldj";
const responsumUrl = process.env.RESPONSUM_SUPABASE_URL ?? `https://${RESPONSUM_PROJECT_REF}.supabase.co`;
const responsumServiceKey = process.env.RESPONSUM_SUPABASE_SERVICE_KEY ?? "";
let cachedResponsumClient: Promise<SupabaseClient> | null = null;

function buildResponsumClient(serviceKey: string): SupabaseClient {
  return createClient(responsumUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function createResponsumClient(): Promise<SupabaseClient> {
  if (responsumServiceKey) return buildResponsumClient(responsumServiceKey);
  if (cachedResponsumClient) return cachedResponsumClient;

  cachedResponsumClient = (async () => {
    const managementToken = process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN?.trim();
    if (!managementToken) {
      throw new CafeCulturaError(
        "A integração com o RESPONSUM ainda não está configurada.",
        503,
        "RESPONSUM_NOT_CONFIGURED"
      );
    }
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${RESPONSUM_PROJECT_REF}/api-keys`,
      { headers: { Authorization: `Bearer ${managementToken}` }, cache: "no-store" }
    );
    if (!response.ok) {
      throw new CafeCulturaError(
        "Não foi possível autorizar a integração com o RESPONSUM.",
        502,
        "RESPONSUM_KEY_LOOKUP_FAILED"
      );
    }
    const serviceKey = selectResponsumServiceKey(await response.json());
    if (!serviceKey) {
      throw new CafeCulturaError(
        "A chave de serviço do RESPONSUM não foi encontrada.",
        503,
        "RESPONSUM_SERVICE_KEY_MISSING"
      );
    }
    return buildResponsumClient(serviceKey);
  })().catch((error) => {
    cachedResponsumClient = null;
    throw error;
  });
  return cachedResponsumClient;
}

function sanitizedMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Falha desconhecida na sincronização.";
  return message.replace(/(?:sbp_|eyJ)[A-Za-z0-9._-]+/g, "[redacted]").slice(0, 500);
}

export async function fetchResponsumAbsenceTickets(
  responsum?: SupabaseClient
): Promise<ResponsumAbsenceTicket[]> {
  const client = responsum ?? (await createResponsumClient());
  const { data: tickets, error } = await client
    .from("app_c009c0e4f1_tickets")
    .select("id,title,description,created_by")
    .eq("category", "cafe_com_cultura")
    .eq("subcategory", "justificativa_de_ausencia");
  if (error) throw new CafeCulturaError("Não foi possível consultar as justificativas no RESPONSUM.", 502, "RESPONSUM_TICKETS_FAILED");
  const creatorIds = [...new Set((tickets ?? []).map((ticket) => String(ticket.created_by)).filter(Boolean))];
  const creatorEmails = new Map<string, string | null>();
  if (creatorIds.length) {
    const { data: creators, error: creatorsError } = await client
      .from("app_c009c0e4f1_users")
      .select("id,email")
      .in("id", creatorIds);
    if (creatorsError) throw new CafeCulturaError("Não foi possível identificar os solicitantes no RESPONSUM.", 502, "RESPONSUM_USERS_FAILED");
    for (const creator of creators ?? []) {
      creatorEmails.set(String(creator.id), (creator.email as string | null) ?? null);
    }
  }
  return (tickets ?? []).map((ticket) => ({
    id: String(ticket.id),
    title: String(ticket.title ?? ""),
    description: (ticket.description as string | null) ?? null,
    createdBy: String(ticket.created_by),
    createdByEmail: creatorEmails.get(String(ticket.created_by)) ?? null,
  }));
}

export async function syncResponsumAbsences(
  eventId: string,
  triggerSource: "cron" | "admin",
  actorProfileId: string | null = null,
  admin: SupabaseClient = createCafeAdminClient(),
  responsum?: SupabaseClient
): Promise<{ ticketsFound: number; participantsUpdated: number; unmatchedTickets: number }> {
  const { data: run, error: runError } = await admin
    .from("event_attendance_sync_runs")
    .insert({ event_id: eventId, trigger_source: triggerSource, actor_user_id: actorProfileId })
    .select("id")
    .single();
  if (runError || !run) throw new CafeCulturaError("Não foi possível iniciar a sincronização.", 500, "SYNC_RUN_CREATE_FAILED");

  try {
    const [{ data: event, error: eventError }, tickets, { data: localUsers, error: usersError }] = await Promise.all([
      admin.from("events").select("event_date").eq("id", eventId).maybeSingle(),
      fetchResponsumAbsenceTickets(responsum),
      admin.from("users").select("id,email").eq("is_active", true),
    ]);
    if (eventError || !event?.event_date) throw new CafeCulturaError("Evento sem data válida.", 409, "EVENT_DATE_MISSING");
    if (usersError) throw new CafeCulturaError("Não foi possível consultar os colaboradores.", 500, "LOCAL_USERS_FAILED");

    await ensureEventRoster(eventId, admin);
    const mapped = mapResponsumAbsences(
      tickets,
      (localUsers ?? []).map((user) => ({ id: String(user.id), email: (user.email as string | null) ?? null })),
      String(event.event_date)
    );
    const matchedUserIds = new Set(mapped.matches.map((match) => match.userId));
    let participantsUpdated = 0;

    for (const match of mapped.matches) {
      const { data, error } = await admin
        .from("event_participants")
        .update({
          expectation_status: "excused_absence",
          expectation_source: "responsum",
          responsum_ticket_ids: match.ticketIds,
          responsum_justifications: match.justifications,
          responsum_synced_at: new Date().toISOString(),
        })
        .eq("event_id", eventId)
        .eq("user_id", match.userId)
        .neq("expectation_source", "admin")
        .select("id");
      if (error) throw new CafeCulturaError("Não foi possível aplicar uma justificativa.", 500, "ABSENCE_APPLY_FAILED");
      participantsUpdated += data?.length ?? 0;
    }

    const { data: previousResponsum, error: previousError } = await admin
      .from("event_participants")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("expectation_source", "responsum");
    if (previousError) throw new CafeCulturaError("Não foi possível reconciliar as justificativas.", 500, "ABSENCE_RECONCILE_FAILED");
    const restoredIds = (previousResponsum ?? [])
      .map((row) => String(row.user_id))
      .filter((userId) => !matchedUserIds.has(userId));
    if (restoredIds.length) {
      const { data, error } = await admin
        .from("event_participants")
        .update({
          expectation_status: "confirmed",
          expectation_source: "automatic_roster",
          responsum_ticket_ids: [],
          responsum_justifications: [],
          responsum_synced_at: new Date().toISOString(),
        })
        .eq("event_id", eventId)
        .eq("expectation_source", "responsum")
        .in("user_id", restoredIds)
        .select("id");
      if (error) throw new CafeCulturaError("Não foi possível reconciliar as justificativas.", 500, "ABSENCE_RESTORE_FAILED");
      participantsUpdated += data?.length ?? 0;
    }

    await refreshCafeEventCounts(eventId, admin);
    const result = {
      ticketsFound: mapped.matches.reduce((sum, match) => sum + match.ticketIds.length, 0),
      participantsUpdated,
      unmatchedTickets: mapped.unmatchedTicketIds.length,
    };
    await Promise.all([
      admin
        .from("event_attendance_sync_runs")
        .update({
          status: "success",
          tickets_found: result.ticketsFound,
          participants_updated: result.participantsUpdated,
          unmatched_tickets: result.unmatchedTickets,
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id),
      admin.from("event_history").insert({
        event_id: eventId,
        action_type: "presenca_sync",
        action_label: "Justificativas sincronizadas com o RESPONSUM",
        actor_user_id: actorProfileId,
        payload: result,
      }),
    ]);
    return result;
  } catch (error) {
    await admin
      .from("event_attendance_sync_runs")
      .update({ status: "error", error_message_sanitized: sanitizedMessage(error), finished_at: new Date().toISOString() })
      .eq("id", run.id);
    throw error;
  }
}

export async function runCafeCulturaAutomation(now: Date = new Date()) {
  const admin = createCafeAdminClient();
  const eventIds = await ensureCafeEditions(now, admin);
  const results: Array<{ eventId: string; success: boolean; error?: string }> = [];
  for (const eventId of eventIds) {
    try {
      await syncResponsumAbsences(eventId, "cron", null, admin);
      results.push({ eventId, success: true });
    } catch (error) {
      results.push({ eventId, success: false, error: sanitizedMessage(error) });
    }
  }
  return { editions: eventIds.length, results };
}
