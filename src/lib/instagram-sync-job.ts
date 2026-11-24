/**
 * Coleta do Instagram: UMA rotina para o cron e para o botão "Atualizar agora".
 *
 * - daily (cron 6h e botão): posts dos últimos 45 dias, números da conta dos
 *   últimos dias (com repescagem se o cron falhou), demografia, stories e
 *   foto do dia dos concorrentes.
 * - full (cron semanal): todos os posts desde 2025 (métricas antigas ainda mudam pouco).
 * - stories (cron a cada 4 h): stories no ar, antes de sumirem em 24 h.
 *
 * Antes o cron e o botão gravavam campos diferentes: o cron zerava tipo do post,
 * seguidores ganhos, visitas e cliques. Cada execução fica em instagram_sync_runs
 * (selo "Atualizado há X h" e alerta de falha na tela).
 */
import { createClient } from "@supabase/supabase-js";
import {
  SYNC_SINCE_DEFAULT,
  accountInsightDates,
  fetchAccountDailyInsights,
  fetchAccountStats,
  fetchAudienceDemographics as fetchMetaDemographics,
  fetchMediaSince,
  getInstagramAccountId,
  syncStories,
  type SyncedMediaPost,
} from "@/lib/instagram-meta";
import {
  refreshAllInstagramPostTags,
  upsertAccountStats,
  upsertInstagramPosts,
} from "@/lib/instagram-posts";
import { upsertAccountInsights } from "@/lib/instagram-account-insights";
import { replaceAudienceDemographics } from "@/lib/instagram-demographics";
import { upsertInstagramStories } from "@/lib/instagram-stories";
import { saveMissingPostCovers, saveMissingStoryCovers } from "@/lib/instagram-covers";
import { syncReferenceAccounts } from "@/lib/content-generator/references-server";

export type InstagramSyncKind = "daily" | "full" | "stories";
export type InstagramSyncTrigger = "cron" | "button" | "script";

const DAY_MS = 86_400_000;
/** Posts mais novos que isso entram na coleta diária (as métricas ainda mudam). */
export const DAILY_POSTS_WINDOW_DAYS = 45;
/** A Meta ainda ajusta os números da conta por ~48 h: repete os últimos dias. */
const DAILY_ACCOUNT_REPEAT_DAYS = 3;
/** Repescagem máxima quando o cron ficou dias sem rodar. */
const ACCOUNT_CATCH_UP_MAX_DAYS = 60;

export interface InstagramSyncResult {
  runId: string | null;
  kind: InstagramSyncKind;
  status: "success" | "partial" | "error";
  postsSynced: number;
  storiesSynced: number;
  daysSynced: number;
  coversSaved: number;
  warnings: string[];
  followers: number | null;
}

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key);
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function toPostRow(p: SyncedMediaPost) {
  return {
    id: p.id,
    caption: p.caption,
    media_type: p.media_type,
    media_product_type: p.media_product_type,
    media_url: p.media_url,
    thumbnail_url: p.thumbnail_url,
    permalink: p.permalink,
    published_at: p.published_at,
    likes: p.likes,
    comments: p.comments,
    reach: p.reach,
    views: p.views,
    saves: p.saves,
    shares: p.shares,
    total_interactions: p.total_interactions,
    follows: p.follows,
    profile_visits: p.profile_visits,
    reposts: p.reposts,
    profile_activity: p.profile_activity,
    link_clicks: p.link_clicks,
    reels_avg_watch_time: p.reels_avg_watch_time,
    reels_total_watch_time: p.reels_total_watch_time,
  };
}

/** Dias da conta a coletar: os últimos 3 completos + o que faltou desde a última coleta. */
export async function pendingAccountDates(now = Date.now()): Promise<string[]> {
  const yesterday = isoDate(now - DAY_MS);
  let from = isoDate(now - DAILY_ACCOUNT_REPEAT_DAYS * DAY_MS);
  const { data } = await adminDb()
    .from("instagram_account_insights")
    .select("date")
    .not("collected_at", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastCollected = (data?.date as string | undefined) ?? null;
  const floor = isoDate(now - ACCOUNT_CATCH_UP_MAX_DAYS * DAY_MS);
  if (!lastCollected || lastCollected < from) {
    const next = lastCollected ? isoDate(Date.parse(`${lastCollected}T00:00:00Z`) + DAY_MS) : floor;
    from = next < floor ? floor : next < from ? next : from;
  }
  return accountInsightDates(from, yesterday);
}

/** Foto do dia dos perfis cadastrados no Gerador de conteúdo (seguidores e nº de posts). */
async function snapshotCompetitors(): Promise<number> {
  await syncReferenceAccounts();
  const db = adminDb();
  const { data, error } = await db
    .from("content_reference_accounts")
    .select("id, followers_count, media_count")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const today = isoDate(Date.now());
  const rows = (data ?? [])
    .filter((row) => row.followers_count !== null)
    .map((row) => ({
      account_id: row.id as string,
      snapshot_date: today,
      followers_count: row.followers_count as number,
      media_count: (row.media_count as number | null) ?? null,
    }));
  if (rows.length === 0) return 0;
  const { error: upsertError } = await db
    .from("instagram_competitor_snapshots")
    .upsert(rows, { onConflict: "account_id,snapshot_date" });
  if (upsertError) throw new Error(upsertError.message);
  return rows.length;
}

async function step<T>(warnings: string[], label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    warnings.push(`${label}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300));
    return null;
  }
}

export async function runInstagramSync(
  kind: InstagramSyncKind,
  options: { trigger?: InstagramSyncTrigger; accountDates?: string[] } = {}
): Promise<InstagramSyncResult> {
  const db = adminDb();
  const trigger = options.trigger ?? "cron";
  const { data: runRow } = await db
    .from("instagram_sync_runs")
    .insert({ kind, trigger, status: "running" })
    .select("id")
    .single();
  const runId = (runRow?.id as string | undefined) ?? null;

  const result: InstagramSyncResult = {
    runId,
    kind,
    status: "success",
    postsSynced: 0,
    storiesSynced: 0,
    daysSynced: 0,
    coversSaved: 0,
    warnings: [],
    followers: null,
  };
  const warnings = result.warnings;

  try {
    const igAccountId = await getInstagramAccountId();

    if (kind === "daily" || kind === "full") {
      const account = await fetchAccountStats(igAccountId);
      await upsertAccountStats(account);
      result.followers = account.followers_count;

      const since = kind === "full" ? SYNC_SINCE_DEFAULT : new Date(Date.now() - DAILY_POSTS_WINDOW_DAYS * DAY_MS).toISOString();
      const posts = await fetchMediaSince(igAccountId, since);
      result.postsSynced = await upsertInstagramPosts(posts.map(toPostRow));
      await step(warnings, "Tags", () => refreshAllInstagramPostTags());
      const covers = await step(warnings, "Capas dos posts", () => saveMissingPostCovers());
      result.coversSaved += covers?.saved ?? 0;
    }

    if (kind === "daily") {
      const dates = options.accountDates ?? (await pendingAccountDates());
      const insights = await step(warnings, "Números da conta", () => fetchAccountDailyInsights(igAccountId, dates));
      if (insights) {
        result.daysSynced = await upsertAccountInsights(insights.days);
        if (insights.failedDates.length) {
          warnings.push(`A Meta não devolveu ${insights.failedDates.length} dia(s): ${insights.failedDates.slice(0, 5).join(", ")}`);
        }
      }
      await step(warnings, "Demografia", async () => {
        const entries = await fetchMetaDemographics(igAccountId);
        return replaceAudienceDemographics(entries);
      });
      await step(warnings, "Concorrentes", () => snapshotCompetitors());
    }

    if (kind === "daily" || kind === "stories") {
      const stories = await step(warnings, "Stories", async () => {
        const { stories: live } = await syncStories();
        return upsertInstagramStories(live);
      });
      result.storiesSynced = stories ?? 0;
      const covers = await step(warnings, "Capas dos stories", () => saveMissingStoryCovers());
      result.coversSaved += covers?.saved ?? 0;
    }

    result.status = warnings.length ? "partial" : "success";
  } catch (err) {
    result.status = "error";
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await db
        .from("instagram_sync_runs")
        .update({ status: "error", finished_at: new Date().toISOString(), error: message.slice(0, 1000), warnings })
        .eq("id", runId);
    }
    throw err;
  }

  if (runId) {
    await db
      .from("instagram_sync_runs")
      .update({
        status: result.status,
        finished_at: new Date().toISOString(),
        posts_synced: result.postsSynced,
        stories_synced: result.storiesSynced,
        days_synced: result.daysSynced,
        covers_saved: result.coversSaved,
        warnings,
      })
      .eq("id", runId);
  }
  return result;
}
