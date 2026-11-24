/**
 * Resumo das Métricas (Instagram + LinkedIn + Site) para um período. Sem banco:
 * usado na tela e no texto que vai para a IA ("Leitura do período").
 */
import type { InstagramPost } from "@/lib/instagram-posts";
import { ENGAGEMENT_RATE_GOAL_PCT, REACH_GOAL_MONTHLY } from "@/lib/instagram-goals";
import type { FollowersPoint } from "@/lib/social-metrics/server";
import type { SourceFreshness } from "@/lib/social-metrics/freshness";
import { formatCompact, formatDelta, formatInt, formatPercent, formatSigned, deltaPercent } from "@/lib/social-metrics/format";
import { formatRange, isDateInRange, type ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import {
  computeFormatStats,
  computeInstagramKpis,
  computePeriodGoals,
  POST_FORMAT_LABELS,
  postsInRange,
  sortPosts,
  type InsightDay,
  type InstagramKpis,
} from "@/lib/social-metrics/instagram";

export interface SummaryLinkedinDay {
  date: string;
  impressions: number;
  clicks: number;
  reactions: number;
  comments: number;
  shares: number;
}

export interface SummaryLinkedinFollowerDay {
  date: string;
  newFollowers: number;
}

export interface SummaryLinkedinPost {
  id: string;
  caption: string | null;
  permalink: string | null;
  publishedAt: string | null;
  impressions: number;
  clicks: number;
  engagementRate: number;
  coverUrl: string | null;
}

export interface SummaryGa4Day {
  date: string;
  sessions: number;
  users: number;
  conversions: number;
  whatsapp: number;
}

export interface SummaryDateValue {
  date: string;
  value: number;
}

export interface SocialMetricsNote {
  periodStart: string;
  periodEnd: string;
  aiSummary: string | null;
  aiGeneratedAt: string | null;
  note: string | null;
  noteUpdatedAt: string | null;
  noteUpdatedBy: string | null;
}

export interface MetricsSummaryData {
  channels: { instagram: boolean; linkedin: boolean; site: boolean };
  instagram: {
    insights: InsightDay[];
    posts: InstagramPost[];
    followersHistory: FollowersPoint[];
    /** Meta mensal de posts (tela do Instagram). */
    monthlyGoal: number;
    freshness: SourceFreshness;
  } | null;
  linkedin: {
    days: SummaryLinkedinDay[];
    followers: SummaryLinkedinFollowerDay[];
    posts: SummaryLinkedinPost[];
    freshness: SourceFreshness;
  } | null;
  site: {
    days: SummaryGa4Day[];
    social: SummaryDateValue[];
    freshness: SourceFreshness;
  } | null;
  notes: SocialMetricsNote[];
}

/* ------------------------------------------------------------- LinkedIn */

export interface LinkedinTotals {
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  engagementRate: number | null;
  newFollowers: number | null;
  daysWithData: number;
}

export function summarizeLinkedin(days: SummaryLinkedinDay[], followers: SummaryLinkedinFollowerDay[], from: string, to: string): LinkedinTotals {
  const scoped = days.filter((day) => isDateInRange(day.date, from, to));
  const follows = followers.filter((day) => isDateInRange(day.date, from, to));
  if (scoped.length === 0 && follows.length === 0) {
    return { impressions: null, clicks: null, ctr: null, engagementRate: null, newFollowers: null, daysWithData: 0 };
  }
  const impressions = scoped.reduce((sum, day) => sum + day.impressions, 0);
  const clicks = scoped.reduce((sum, day) => sum + day.clicks, 0);
  const engagements = scoped.reduce((sum, day) => sum + day.clicks + day.reactions + day.comments + day.shares, 0);
  return {
    impressions: scoped.length ? impressions : null,
    clicks: scoped.length ? clicks : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    engagementRate: impressions > 0 ? (engagements / impressions) * 100 : null,
    newFollowers: follows.length ? follows.reduce((sum, day) => sum + day.newFollowers, 0) : null,
    daysWithData: scoped.length,
  };
}

/* ----------------------------------------------------------------- Site */

export interface SiteTotals {
  sessions: number | null;
  users: number | null;
  leads: number | null;
  whatsapp: number | null;
  socialSessions: number | null;
  socialShare: number | null;
  daysWithData: number;
}

export function summarizeSite(days: SummaryGa4Day[], social: SummaryDateValue[], from: string, to: string): SiteTotals {
  const scoped = days.filter((day) => isDateInRange(day.date, from, to));
  if (scoped.length === 0) {
    return { sessions: null, users: null, leads: null, whatsapp: null, socialSessions: null, socialShare: null, daysWithData: 0 };
  }
  const sessions = scoped.reduce((sum, day) => sum + day.sessions, 0);
  const socialSessions = social.filter((row) => isDateInRange(row.date, from, to)).reduce((sum, row) => sum + row.value, 0);
  return {
    sessions,
    users: scoped.reduce((sum, day) => sum + day.users, 0),
    leads: scoped.reduce((sum, day) => sum + day.conversions, 0),
    whatsapp: scoped.reduce((sum, day) => sum + day.whatsapp, 0),
    socialSessions,
    socialShare: sessions > 0 ? (socialSessions / sessions) * 100 : null,
    daysWithData: scoped.length,
  };
}

/* ------------------------------------------------------------ resumo */

export interface ChannelPair<T> {
  current: T;
  previous: T;
}

export interface MetricsSummary {
  instagram: ChannelPair<InstagramKpis> | null;
  linkedin: ChannelPair<LinkedinTotals> | null;
  site: ChannelPair<SiteTotals> | null;
}

export function computeMetricsSummary(data: MetricsSummaryData, period: ResolvedMetricsPeriod): MetricsSummary {
  const { from, to, compareFrom, compareTo } = period;
  return {
    instagram: data.instagram
      ? {
          current: computeInstagramKpis(data.instagram.insights, data.instagram.posts, from, to),
          previous: computeInstagramKpis(data.instagram.insights, data.instagram.posts, compareFrom, compareTo),
        }
      : null,
    linkedin: data.linkedin
      ? {
          current: summarizeLinkedin(data.linkedin.days, data.linkedin.followers, from, to),
          previous: summarizeLinkedin(data.linkedin.days, data.linkedin.followers, compareFrom, compareTo),
        }
      : null,
    site: data.site
      ? {
          current: summarizeSite(data.site.days, data.site.social, from, to),
          previous: summarizeSite(data.site.days, data.site.social, compareFrom, compareTo),
        }
      : null,
  };
}

function line(label: string, current: number | null, previous: number | null, format: (value: number | null) => string): string {
  return `- ${label}: ${format(current)} (antes: ${format(previous)}; variação ${formatDelta(deltaPercent(current, previous))})`;
}

/** Fatos do período em texto, para a IA escrever a leitura sem inventar número. */
export function buildSummaryFacts(data: MetricsSummaryData, period: ResolvedMetricsPeriod): string {
  const summary = computeMetricsSummary(data, period);
  const parts: string[] = [
    `Período: ${formatRange(period.from, period.to)} (${period.days} dias). Comparação: ${period.compareLabel}.`,
  ];

  if (summary.instagram && data.instagram) {
    const { current, previous } = summary.instagram;
    const posts = postsInRange(data.instagram.posts, period.from, period.to);
    const formats = computeFormatStats(posts).filter((stat) => stat.posts > 0);
    const top = sortPosts(posts, "reach").slice(0, 3);
    const goals = computePeriodGoals(current, period.days, {
      reachMonthly: REACH_GOAL_MONTHLY,
      engagementPct: ENGAGEMENT_RATE_GOAL_PCT,
      postsMonthly: data.instagram.monthlyGoal,
    });
    parts.push(
      "",
      "INSTAGRAM (@bismarchipires)",
      line("Alcance dos posts publicados (soma, a medida principal do escritório)", current.postsReach, previous.postsReach, formatCompact),
      `- Metas do período: alcance ${formatCompact(goals.reach.target)} (${goals.reach.pct === null ? "—" : Math.round(goals.reach.pct) + "% atingido"}); engajamento ${formatPercent(ENGAGEMENT_RATE_GOAL_PCT, 1)} (${goals.engagement.pct === null ? "—" : Math.round(goals.engagement.pct) + "% atingido"}); posts ${goals.posts.target} (${goals.posts.pct === null ? "—" : Math.round(goals.posts.pct) + "% atingido"})`,
      line("Visualizações (conta)", current.views, previous.views, formatCompact),
      line("Interações", current.interactions, previous.interactions, formatCompact),
      line("Taxa de engajamento dos posts (%)", current.engagementRate, previous.engagementRate, (v) => formatPercent(v, 2)),
      line("Saldo de seguidores", current.netFollowers, previous.netFollowers, formatSigned),
      line("Posts publicados", current.posts, previous.posts, formatInt),
      ...formats.map(
        (stat) => `- Formato ${POST_FORMAT_LABELS[stat.format]}: ${stat.posts} posts, alcance médio ${formatCompact(stat.avgReach)}, engajamento ${formatPercent(stat.engagementRate, 2)}`
      ),
      ...top.map((post, index) => `- Top ${index + 1} em alcance (${formatCompact(post.reach)}): ${(post.caption ?? "").replace(/\s+/g, " ").slice(0, 140)}`)
    );
  }

  if (summary.linkedin && data.linkedin) {
    const { current, previous } = summary.linkedin;
    parts.push("", "LINKEDIN (página da empresa, importação manual)");
    if (current.daysWithData === 0) {
      parts.push(`- Sem dados importados para o período (dados até ${data.linkedin.freshness.dataUntil ?? "?"}).`);
    } else {
      parts.push(
        line("Impressões", current.impressions, previous.impressions, formatCompact),
        line("Cliques", current.clicks, previous.clicks, formatInt),
        line("Taxa de engajamento (%)", current.engagementRate, previous.engagementRate, (v) => formatPercent(v, 2)),
        line("Novos seguidores", current.newFollowers, previous.newFollowers, formatInt)
      );
    }
  }

  if (summary.site) {
    const { current, previous } = summary.site;
    parts.push(
      "",
      "SITE (Google Analytics)",
      line("Sessões", current.sessions, previous.sessions, formatInt),
      line("Leads (formulários)", current.leads, previous.leads, formatInt),
      line("Cliques no WhatsApp", current.whatsapp, previous.whatsapp, formatInt),
      line("Sessões vindas das redes sociais", current.socialSessions, previous.socialSessions, formatInt)
    );
  }

  return parts.join("\n");
}
