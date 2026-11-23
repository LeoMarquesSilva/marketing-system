import "server-only";

/**
 * Leitura das telas de Métricas: só banco. A coleta na Meta, no GA4 e a
 * importação do LinkedIn acontecem fora da visita (cron / botão / importação).
 */
import { createClient } from "@supabase/supabase-js";
import { fetchInstagramPosts, fetchLatestAccountStats } from "@/lib/instagram-posts";
import { fetchInstagramStories } from "@/lib/instagram-stories";
import { fetchAccountInsightsHistory } from "@/lib/instagram-account-insights";
import { fetchAudienceDemographics } from "@/lib/instagram-demographics";
import { fetchInstagramMonthlyGoal } from "@/lib/instagram-settings";
import { fetchAreas } from "@/lib/areas";
import { fetchUsers, type User } from "@/lib/users";
import {
  instagramCoverPublicUrl,
  sanitizeInstagramPostsForClient,
  sanitizeInstagramStoryForClient,
} from "@/lib/instagram-thumbnail-client";
import type { MetricsSummaryData, SocialMetricsNote, SummaryLinkedinPost } from "@/lib/social-metrics/summary";
import type { SourceFreshness } from "@/lib/social-metrics/freshness";
import { fetchAllRows } from "@/lib/social-metrics/paginate";

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key);
}

/** Tira os campos de controle da linha (id, collected_at) antes de mandar ao navegador. */
function stripInsightRow(row: Awaited<ReturnType<typeof fetchAccountInsightsHistory>>[number]) {
  const { id, collected_at, ...day } = row;
  void id;
  void collected_at;
  return day;
}

/* --------------------------------------------------------------- frescor */

export async function fetchInstagramFreshness(): Promise<SourceFreshness> {
  const db = adminDb();
  const [{ data: success }, { data: attempt }, { data: lastDay }] = await Promise.all([
    db
      .from("instagram_sync_runs")
      .select("finished_at")
      .in("kind", ["daily", "full"])
      .in("status", ["success", "partial"])
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("instagram_sync_runs")
      .select("started_at, status, error")
      .in("kind", ["daily", "full"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("instagram_account_insights")
      .select("date")
      .not("collected_at", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    source: "instagram",
    label: "Instagram",
    lastSuccessAt: (success?.finished_at as string | null) ?? null,
    lastAttemptAt: (attempt?.started_at as string | null) ?? null,
    lastError: attempt?.status === "error" ? ((attempt?.error as string | null) ?? "Falha na coleta") : null,
    dataUntil: (lastDay?.date as string | null) ?? null,
    staleAfterHours: 30,
    howItArrives: "Coleta automática todo dia às 6h; stories a cada 4 h.",
  };
}

export async function fetchGa4Freshness(): Promise<SourceFreshness> {
  const db = adminDb();
  const [{ data: success }, { data: attempt }, { data: lastDay }] = await Promise.all([
    db.from("ga4_imports").select("imported_at").eq("status", "completed").order("imported_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ga4_imports").select("imported_at, status, error").order("imported_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ga4_daily_metrics").select("metric_date").order("metric_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    source: "ga4",
    label: "Site (GA4)",
    lastSuccessAt: (success?.imported_at as string | null) ?? null,
    lastAttemptAt: (attempt?.imported_at as string | null) ?? null,
    lastError: attempt?.status === "failed" ? ((attempt?.error as string | null) ?? "Falha na coleta") : null,
    dataUntil: (lastDay?.metric_date as string | null) ?? null,
    staleAfterHours: 30,
    howItArrives: "Coleta automática todo dia às 7h.",
  };
}

export interface LinkedinReportFreshness {
  reportType: string;
  label: string;
  importedAt: string | null;
  dataUntil: string | null;
}

const LINKEDIN_REPORTS: { type: string; label: string }[] = [
  { type: "content", label: "Conteúdo" },
  { type: "followers", label: "Seguidores" },
  { type: "visitors", label: "Visitantes" },
  { type: "competitors", label: "Concorrentes" },
];

export async function fetchLinkedinFreshness(): Promise<{ freshness: SourceFreshness; reports: LinkedinReportFreshness[] }> {
  const { data } = await adminDb()
    .from("linkedin_imports")
    .select("report_type, imported_at, date_to, status")
    .eq("status", "completed")
    .order("imported_at", { ascending: false });
  const rows = (data ?? []) as { report_type: string | null; imported_at: string; date_to: string | null }[];
  const reports = LINKEDIN_REPORTS.map(({ type, label }) => {
    const latest = rows.find((row) => (row.report_type ?? "content") === type);
    return { reportType: type, label, importedAt: latest?.imported_at ?? null, dataUntil: latest?.date_to ?? null };
  });
  const content = reports[0];
  return {
    reports,
    freshness: {
      source: "linkedin",
      label: "LinkedIn",
      lastSuccessAt: rows[0]?.imported_at ?? null,
      lastAttemptAt: rows[0]?.imported_at ?? null,
      lastError: null,
      dataUntil: content.dataUntil,
      // Importação manual: o ideal é uma por mês.
      staleAfterHours: 24 * 35,
      howItArrives: "Importação manual das planilhas exportadas da página do LinkedIn (uma vez por mês).",
    },
  };
}

/* ------------------------------------------------------------- Instagram */

export interface FollowersPoint {
  fetched_at: string;
  followers_count: number;
}

async function fetchFollowersHistory(): Promise<FollowersPoint[]> {
  const db = adminDb();
  return fetchAllRows<FollowersPoint>((from, to) =>
    db.from("instagram_account_stats").select("fetched_at, followers_count").order("fetched_at", { ascending: true }).range(from, to)
  );
}

export interface CompetitorAccount {
  id: string;
  username: string;
  displayName: string | null;
  kind: string;
  followersCount: number | null;
  mediaCount: number | null;
  profilePictureUrl: string | null;
  lastSyncedAt: string | null;
}

export interface CompetitorSnapshot {
  accountId: string;
  date: string;
  followers: number | null;
}

export interface CompetitorPost {
  accountId: string;
  publishedAt: string | null;
  likes: number | null;
  comments: number | null;
  followersAtSync: number | null;
  mediaType: string | null;
  mediaProductType: string | null;
  permalink: string | null;
  caption: string | null;
}

export interface CompetitorsData {
  accounts: CompetitorAccount[];
  snapshots: CompetitorSnapshot[];
  posts: CompetitorPost[];
}

export async function fetchCompetitorsData(): Promise<CompetitorsData> {
  const db = adminDb();
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const [{ data: accounts }, { data: snapshots }, { data: posts }] = await Promise.all([
    db
      .from("content_reference_accounts")
      .select("id, username, display_name, kind, followers_count, media_count, profile_picture_url, last_synced_at")
      .eq("is_active", true)
      .order("followers_count", { ascending: false }),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      db.from("instagram_competitor_snapshots").select("account_id, snapshot_date, followers_count").order("snapshot_date", { ascending: true }).range(from, to)
    ).then((data) => ({ data })),
    db
      .from("content_reference_posts")
      .select("account_id, published_at, like_count, comments_count, followers_at_sync, media_type, media_product_type, permalink, caption")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(2000),
  ]);
  return {
    accounts: (accounts ?? []).map((row) => ({
      id: row.id as string,
      username: row.username as string,
      displayName: (row.display_name as string | null) ?? null,
      kind: row.kind as string,
      followersCount: (row.followers_count as number | null) ?? null,
      mediaCount: (row.media_count as number | null) ?? null,
      profilePictureUrl: (row.profile_picture_url as string | null) ?? null,
      lastSyncedAt: (row.last_synced_at as string | null) ?? null,
    })),
    snapshots: (snapshots ?? []).map((row) => ({
      accountId: row.account_id as string,
      date: row.snapshot_date as string,
      followers: (row.followers_count as number | null) ?? null,
    })),
    posts: (posts ?? []).map((row) => ({
      accountId: row.account_id as string,
      publishedAt: (row.published_at as string | null) ?? null,
      likes: (row.like_count as number | null) ?? null,
      comments: (row.comments_count as number | null) ?? null,
      followersAtSync: (row.followers_at_sync as number | null) ?? null,
      mediaType: (row.media_type as string | null) ?? null,
      mediaProductType: (row.media_product_type as string | null) ?? null,
      permalink: (row.permalink as string | null) ?? null,
      caption: (row.caption as string | null) ?? null,
    })),
  };
}

export async function fetchInstagramMetricsData() {
  const [posts, accountStats, followersHistory, insights, stories, demographics, areas, users, monthlyGoal, freshness, competitors] =
    await Promise.all([
      fetchInstagramPosts(),
      fetchLatestAccountStats(),
      fetchFollowersHistory(),
      fetchAccountInsightsHistory(),
      fetchInstagramStories(),
      fetchAudienceDemographics(),
      fetchAreas(),
      fetchUsers(),
      fetchInstagramMonthlyGoal(),
      fetchInstagramFreshness(),
      fetchCompetitorsData(),
    ]);

  return {
    posts: sanitizeInstagramPostsForClient(posts),
    accountStats,
    followersHistory,
    insights: insights.map(stripInsightRow),
    stories: stories.map((story) => sanitizeInstagramStoryForClient({ ...story, id: story.ig_story_id })),
    demographics,
    areas,
    // Só o que a tela usa (foto, nome, área): a lista completa traz permissões e e-mails.
    users: users
      .filter((user) => user.is_active !== false)
      .map(
        (user): User => ({
          id: user.id,
          name: user.name,
          email: null,
          department: user.department,
          avatar_url: user.avatar_url,
          is_active: true,
        })
      ),
    monthlyGoal,
    freshness,
    competitors,
  };
}

export type InstagramMetricsData = Awaited<ReturnType<typeof fetchInstagramMetricsData>>;

/* ---------------------------------------------------------------- Resumo */


const SUMMARY_HISTORY_DAYS = 800;

function sinceDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function fetchLinkedinSummary(): Promise<NonNullable<MetricsSummaryData["linkedin"]>> {
  const db = adminDb();
  const since = sinceDate(SUMMARY_HISTORY_DAYS);
  const [days, followers, { data: posts }, { freshness }] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) =>
      db
        .from("linkedin_daily_metrics")
        .select("metric_date, total_impressions, total_clicks, total_reactions, total_comments, total_shares")
        .gte("metric_date", since)
        .order("metric_date", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      db.from("linkedin_follower_daily_metrics").select("metric_date, total_followers").gte("metric_date", since).order("metric_date", { ascending: true }).range(from, to)
    ),
    db
      .from("linkedin_posts")
      .select("id, caption, permalink, published_at, impressions, clicks, engagement_rate, instagram_post_id")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(1000),
    fetchLinkedinFreshness(),
  ]);

  const instagramIds = (posts ?? []).map((post) => post.instagram_post_id as string | null).filter((id): id is string => Boolean(id));
  const covers = new Map<string, string | null>();
  if (instagramIds.length) {
    const { data } = await db.from("instagram_posts").select("id, cover_path").in("id", instagramIds);
    for (const row of data ?? []) covers.set(row.id as string, instagramCoverPublicUrl(row.cover_path as string | null));
  }

  return {
    days: days.map((row) => ({
      date: row.metric_date as string,
      impressions: Number(row.total_impressions ?? 0),
      clicks: Number(row.total_clicks ?? 0),
      reactions: Number(row.total_reactions ?? 0),
      comments: Number(row.total_comments ?? 0),
      shares: Number(row.total_shares ?? 0),
    })),
    followers: followers.map((row) => ({ date: row.metric_date as string, newFollowers: Number(row.total_followers ?? 0) })),
    posts: (posts ?? []).map(
      (row): SummaryLinkedinPost => ({
        id: row.id as string,
        caption: (row.caption as string | null) ?? null,
        permalink: (row.permalink as string | null) ?? null,
        publishedAt: (row.published_at as string | null) ?? null,
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        engagementRate: Number(row.engagement_rate ?? 0),
        coverUrl: row.instagram_post_id ? covers.get(row.instagram_post_id as string) ?? null : null,
      })
    ),
    freshness,
  };
}

async function fetchSiteSummary(): Promise<NonNullable<MetricsSummaryData["site"]>> {
  const db = adminDb();
  const since = sinceDate(SUMMARY_HISTORY_DAYS);
  const [days, social, freshness] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) =>
      db
        .from("ga4_daily_metrics")
        .select("metric_date, sessions, active_users, conversions, whatsapp_clicks")
        .gte("metric_date", since)
        .order("metric_date", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      db
        .from("ga4_channel_daily_metrics")
        .select("metric_date, sessions")
        .in("channel_group", ["Organic Social", "Paid Social"])
        .gte("metric_date", since)
        .order("metric_date", { ascending: true })
        .range(from, to)
    ),
    fetchGa4Freshness(),
  ]);
  const socialByDate = new Map<string, number>();
  for (const row of social) {
    const date = row.metric_date as string;
    socialByDate.set(date, (socialByDate.get(date) ?? 0) + Number(row.sessions ?? 0));
  }
  return {
    days: days.map((row) => ({
      date: row.metric_date as string,
      sessions: Number(row.sessions ?? 0),
      users: Number(row.active_users ?? 0),
      conversions: Number(row.conversions ?? 0),
      whatsapp: Number(row.whatsapp_clicks ?? 0),
    })),
    social: [...socialByDate.entries()].map(([date, value]) => ({ date, value })),
    freshness,
  };
}

export async function fetchSocialMetricsNotes(): Promise<SocialMetricsNote[]> {
  const { data } = await adminDb()
    .from("social_metrics_notes")
    .select("period_start, period_end, ai_summary, ai_generated_at, note, note_updated_at, note_updated_by, users:note_updated_by(name)")
    .order("period_end", { ascending: false })
    .limit(200);
  return (data ?? []).map((row) => ({
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    aiSummary: (row.ai_summary as string | null) ?? null,
    aiGeneratedAt: (row.ai_generated_at as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    noteUpdatedAt: (row.note_updated_at as string | null) ?? null,
    noteUpdatedBy: ((row.users as { name?: string } | { name?: string }[] | null) && (Array.isArray(row.users) ? row.users[0]?.name : (row.users as { name?: string }).name)) || null,
  }));
}

/** Dados do Resumo só dos canais que a pessoa pode ver. */
export async function fetchMetricsSummaryData(channels: MetricsSummaryData["channels"]): Promise<MetricsSummaryData> {
  const [instagram, linkedin, site, notes] = await Promise.all([
    channels.instagram
      ? Promise.all([fetchInstagramPosts(), fetchAccountInsightsHistory(), fetchFollowersHistory(), fetchInstagramFreshness()]).then(
          ([posts, insights, followersHistory, freshness]) => ({
            posts: sanitizeInstagramPostsForClient(posts),
            insights: insights.map(stripInsightRow),
            followersHistory,
            freshness,
          })
        )
      : null,
    channels.linkedin ? fetchLinkedinSummary() : null,
    channels.site ? fetchSiteSummary() : null,
    fetchSocialMetricsNotes(),
  ]);
  return { channels, instagram, linkedin, site, notes };
}
