import { createClient } from "@supabase/supabase-js";
import type { MetaAccountInsightsDay } from "./instagram-meta";
import { SYNC_SINCE_DEFAULT } from "./instagram-meta";

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
}

/** Histórico diário persistido no banco (API Meta só expõe ~90 dias por vez; acumula com sync). */
export async function fetchAccountInsightsHistory(
  sinceIso: string = SYNC_SINCE_DEFAULT
): Promise<InstagramAccountInsightDay[]> {
  const supabase = getServiceClient();
  const sinceDate = sinceIso.slice(0, 10);
  const { data, error } = await supabase
    .from("instagram_account_insights")
    .select("*")
    .gte("date", sinceDate)
    .order("date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as InstagramAccountInsightDay[];
}

/**
 * Persiste os insights diários. Para cada dia, mantém o maior valor já visto
 * (a API pode reportar 0 quando os dados ainda não consolidaram).
 */
export async function upsertAccountInsights(
  days: MetaAccountInsightsDay[]
): Promise<number> {
  if (days.length === 0) return 0;

  const supabase = getServiceClient();
  const dates = days.map((d) => d.date);

  const { data: existingRows } = await supabase
    .from("instagram_account_insights")
    .select("*")
    .in("date", dates);

  const existingMap = new Map(
    (existingRows ?? []).map((r) => [r.date as string, r])
  );

  const keepMax = (next: number, prev: unknown) =>
    Math.max(next ?? 0, (prev as number) ?? 0);

  const now = new Date().toISOString();
  const rows = days.map((d) => {
    const e = existingMap.get(d.date);
    return {
      date: d.date,
      reach: keepMax(d.reach, e?.reach),
      views: keepMax(d.views, e?.views),
      reach_followers: keepMax(d.reach_followers, e?.reach_followers),
      reach_non_followers: keepMax(d.reach_non_followers, e?.reach_non_followers),
      accounts_engaged: keepMax(d.accounts_engaged, e?.accounts_engaged),
      total_interactions: keepMax(d.total_interactions, e?.total_interactions),
      likes: keepMax(d.likes, e?.likes),
      comments: keepMax(d.comments, e?.comments),
      saves: keepMax(d.saves, e?.saves),
      shares: keepMax(d.shares, e?.shares),
      replies: keepMax(d.replies, e?.replies),
      follows: keepMax(d.follows, e?.follows),
      unfollows: keepMax(d.unfollows, e?.unfollows),
      profile_links_taps: keepMax(d.profile_links_taps, e?.profile_links_taps),
      updated_at: now,
    };
  });

  const { error } = await supabase
    .from("instagram_account_insights")
    .upsert(rows, { onConflict: "date" });

  if (error) throw new Error(error.message);
  return rows.length;
}
