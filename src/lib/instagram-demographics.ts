import { createClient } from "@supabase/supabase-js";
import type { MetaDemographicEntry } from "./instagram-meta";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface InstagramDemographicRow extends MetaDemographicEntry {
  id: string;
  snapshot_date: string;
  updated_at: string;
}

export async function fetchAudienceDemographics(): Promise<InstagramDemographicRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("instagram_demographics")
    .select("*")
    .order("value", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as InstagramDemographicRow[];
}

/**
 * Substitui o snapshot atual de demografia. A demografia é sempre um retrato
 * do momento (não histórico), então sobrescrevemos por (kind, breakdown, label).
 */
export async function replaceAudienceDemographics(
  entries: MetaDemographicEntry[]
): Promise<number> {
  if (entries.length === 0) return 0;

  const supabase = getServiceClient();
  const snapshot = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const rows = entries.map((e) => ({
    kind: e.kind,
    breakdown: e.breakdown,
    label: e.label,
    value: e.value,
    snapshot_date: snapshot,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("instagram_demographics")
    .upsert(rows, { onConflict: "kind,breakdown,label" });

  if (error) throw new Error(error.message);

  // Remove entradas antigas que não vieram neste snapshot.
  const { error: cleanupError } = await supabase
    .from("instagram_demographics")
    .delete()
    .lt("snapshot_date", snapshot);

  if (cleanupError) throw new Error(cleanupError.message);

  return rows.length;
}
