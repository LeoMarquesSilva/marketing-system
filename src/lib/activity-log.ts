"use client";

import { supabase } from "@/utils/supabase/client";

export interface ActivityLogEntry {
  id: string;
  request_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export async function logActivity(
  requestId: string,
  action: string,
  fromValue: string | null,
  toValue: string | null,
  userId?: string | null,
  userName?: string | null
) {
  await supabase.from("request_activity_log").insert({
    request_id: requestId,
    action,
    from_value: fromValue,
    to_value: toValue,
    user_id: userId ?? null,
    user_name: userName ?? null,
  });
}

export async function fetchActivityLog(requestId: string): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from("request_activity_log")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}
