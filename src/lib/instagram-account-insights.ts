import { createClient } from "@supabase/supabase-js";
import type { MetaAccountInsightsDay } from "./instagram-meta";
import { SYNC_SINCE_DEFAULT } from "./instagram-meta";
import { fetchAllRows } from "./social-metrics/paginate";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface InstagramAccountInsightDay extends MetaAccountInsightsDay {
  id: string;
  collected_at: string | null;
}

const NUMERIC_FIELDS = [
  "reach",
  "views",
  "reach_followers",
  "reach_non_followers",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "saves",
  "shares",
  "replies",
  "follows",
  "unfollows",
  "profile_links_taps",
  "reposts",
  "new_followers",
  "views_reels",
  "views_stories",
  "views_carousel",
  "views_posts",
] as const satisfies readonly (keyof MetaAccountInsightsDay)[];

/** Campos que podem vir sem dado da Meta (null), em vez de zero. */
export const NULLABLE_INSIGHT_FIELDS = new Set<string>([
  "reach_followers",
  "reach_non_followers",
  "follows",
  "unfollows",
  "new_followers",
  "views_reels",
  "views_stories",
  "views_carousel",
  "views_posts",
]);

function mapInsightRow(row: Record<string, unknown>): InstagramAccountInsightDay {
  const day = {
    id: String(row.id ?? ""),
    date: String(row.date ?? ""),
    collected_at: (row.collected_at as string | null) ?? null,
  } as Record<string, unknown>;
  for (const field of NUMERIC_FIELDS) {
    const raw = row[field];
    day[field] = raw === null || raw === undefined ? (NULLABLE_INSIGHT_FIELDS.has(field) ? null : 0) : Number(raw) || 0;
  }
  return day as unknown as InstagramAccountInsightDay;
}

/** Histórico diário gravado no banco (a Meta só guarda um tempo; o banco acumula). */
export async function fetchAccountInsightsHistory(
  sinceIso: string = SYNC_SINCE_DEFAULT
): Promise<InstagramAccountInsightDay[]> {
  const supabase = getServiceClient();
  const sinceDate = sinceIso.slice(0, 10);
  const data = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase.from("instagram_account_insights").select("*").gte("date", sinceDate).order("date", { ascending: true }).range(from, to)
  );
  return data.map((row) => mapInsightRow(row));
}

/**
 * Grava os dias coletados por cima do que havia. A coleta nova pede cada dia
 * do jeito certo (total do dia), então não precisa mais guardar o "maior valor":
 * isso preservava números errados da coleta antiga.
 */
export async function upsertAccountInsights(days: MetaAccountInsightsDay[]): Promise<number> {
  if (days.length === 0) return 0;

  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const rows = days.map((day) => {
    const row: Record<string, unknown> = { date: day.date, updated_at: now, collected_at: now };
    for (const field of NUMERIC_FIELDS) {
      row[field] = day[field] ?? (NULLABLE_INSIGHT_FIELDS.has(field) ? null : 0);
    }
    return row;
  });

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("instagram_account_insights")
      .upsert(rows.slice(i, i + 500), { onConflict: "date" });
    if (error) throw new Error(error.message);
  }
  return rows.length;
}
