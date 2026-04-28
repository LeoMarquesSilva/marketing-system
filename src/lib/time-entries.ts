import { supabase } from "@/utils/supabase/client";

export interface TimeEntry {
  id: string;
  request_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  /** Populated by fetchTimeEntriesForRequest join */
  user_name?: string | null;
  user_avatar_url?: string | null;
}

export async function fetchTimeEntriesForRequest(
  requestId: string
): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*, users(name, avatar_url)")
    .eq("request_id", requestId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar time entries:", error);
    return [];
  }

  return ((data ?? []) as unknown as Array<
    Omit<TimeEntry, "user_name" | "user_avatar_url"> & {
      users: { name: string; avatar_url: string | null } | null;
    }
  >).map((e) => ({
    ...e,
    user_name: e.users?.name ?? null,
    user_avatar_url: e.users?.avatar_url ?? null,
    users: undefined,
  })) as TimeEntry[];
}

export async function getActiveTimeEntry(
  requestId: string,
  userId: string
): Promise<TimeEntry | null> {
  const { data } = await supabase
    .from("time_entries")
    .select("*")
    .eq("request_id", requestId)
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as TimeEntry | null;
}

export async function getActiveTimeEntryForUser(userId: string): Promise<{
  entry: TimeEntry;
  requestTitle: string;
} | null> {
  const { data } = await supabase
    .from("time_entries")
    .select("*, marketing_requests(title)")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    entry: data as TimeEntry,
    requestTitle: (data as unknown as { marketing_requests: { title: string } | null })
      .marketing_requests?.title ?? "Tarefa",
  };
}

export async function startTimeEntry(
  requestId: string,
  userId: string
): Promise<{ data: TimeEntry | null; error: string | null }> {
  const active = await getActiveTimeEntry(requestId, userId);
  if (active) {
    return { data: null, error: "Já existe um registro ativo. Pause ou finalize antes de iniciar." };
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      request_id: requestId,
      user_id: userId,
      started_at: new Date().toISOString(),
      ended_at: null,
    })
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as TimeEntry, error: null };
}

export async function pauseTimeEntry(
  entryId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function endTimeEntry(
  entryId: string
): Promise<{ error: string | null }> {
  return pauseTimeEntry(entryId);
}

export function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const ms = end - start;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

export interface TimesheetRawEntry {
  id: string;
  request_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  user_name: string | null;
  request_title: string | null;
}

interface FetchTimesheetForDashboardOptions {
  from?: Date | null;
  to?: Date | null;
}

export async function fetchTimesheetForDashboard(
  days = 30,
  options?: FetchTimesheetForDashboardOptions
): Promise<TimesheetRawEntry[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  let query = supabase
    .from("time_entries")
    .select("id, request_id, user_id, started_at, ended_at, users(name), marketing_requests(title)")
    .gte("started_at", (options?.from ?? since).toISOString());

  if (options?.to) {
    query = query.lte("started_at", options.to.toISOString());
  }

  const { data } = await query;

  if (!data) return [];

  return (data as unknown as Array<{
    id: string;
    request_id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    users: { name: string } | null;
    marketing_requests: { title: string } | null;
  }>).map((e) => ({
    id: e.id,
    request_id: e.request_id,
    user_id: e.user_id,
    started_at: e.started_at,
    ended_at: e.ended_at,
    user_name: e.users?.name ?? null,
    request_title: e.marketing_requests?.title ?? null,
  }));
}

export async function fetchTimeTotalsByRequest(
  requestIds: string[],
  userId: string
): Promise<Record<string, string>> {
  if (requestIds.length === 0) return {};
  const { data } = await supabase
    .from("time_entries")
    .select("*")
    .in("request_id", requestIds)
    .eq("user_id", userId);
  const entries = (data ?? []) as TimeEntry[];
  const byRequest: Record<string, TimeEntry[]> = {};
  for (const e of entries) {
    if (!byRequest[e.request_id]) byRequest[e.request_id] = [];
    byRequest[e.request_id].push(e);
  }
  const result: Record<string, string> = {};
  for (const id of requestIds) {
    result[id] = totalDurationForEntries(byRequest[id] ?? []);
  }
  return result;
}

export function totalDurationForEntries(entries: TimeEntry[]): string {
  let totalMs = 0;
  for (const e of entries) {
    const start = new Date(e.started_at).getTime();
    const end = e.ended_at ? new Date(e.ended_at).getTime() : Date.now();
    totalMs += end - start;
  }
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

/** Exclui um registro de timesheet (uso admin) */
export async function deleteTimeEntry(entryId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
  if (error) return { error: error.message };
  return { error: null };
}
