"use client";

import { supabase } from "@/utils/supabase/client";
import type { SlaStageChange, SlaTimeEntry } from "@/lib/sla-metrics";

const PAGE = 1000;

async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }> }
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await build().range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Todo o timesheet e histórico de etapas — a base para os tempos por tipo. */
export async function fetchSlaSources(): Promise<{
  timeEntries: SlaTimeEntry[];
  stageChanges: SlaStageChange[];
}> {
  const [timeEntries, stageChanges] = await Promise.all([
    fetchAll<SlaTimeEntry>(() =>
      supabase.from("time_entries").select("request_id, started_at, ended_at").order("started_at")
    ),
    fetchAll<SlaStageChange>(() =>
      supabase
        .from("request_activity_log")
        .select("request_id, to_value, created_at")
        .eq("action", "stage_changed")
        .order("created_at")
    ),
  ]);
  return { timeEntries, stageChanges };
}
