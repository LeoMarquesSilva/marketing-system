import type {
  LinkedinDailyMetric,
  LinkedinFollowerDailyMetric,
  LinkedinPost,
  LinkedinVisitorDailyMetric,
} from "@/lib/linkedin-types";

export type LinkedinTrendGranularity = "day" | "month";

export interface LinkedinSummary {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  reactions: number;
  comments: number;
  shares: number;
  actions: number;
  engagementRate: number;
  ctr: number;
  sponsoredImpressions: number;
}

export interface LinkedinTrendPoint {
  key: string;
  label: string;
  impressions: number;
  clicks: number;
  engagementRate: number;
  ctr: number;
}

export interface LinkedinAudienceSummary {
  newFollowers: number;
  organicFollowers: number;
  sponsoredFollowers: number;
  autoInvitedFollowers: number;
  pageViews: number;
  uniqueVisitors: number;
  desktopViews: number;
  mobileViews: number;
  viewsPerVisitor: number;
}

export interface LinkedinAudienceTrendPoint {
  key: string;
  label: string;
  newFollowers: number;
  pageViews: number;
  uniqueVisitors: number;
}

export interface LinkedinGroupPerformance {
  label: string;
  posts: number;
  impressions: number;
  actions: number;
  engagementRate: number;
  avatarUrl?: string | null;
}

export function aggregateLinkedinDailyMetrics(
  rows: LinkedinDailyMetric[]
): LinkedinSummary {
  const summary = rows.reduce(
    (total, row) => ({
      impressions: total.impressions + row.total_impressions,
      uniqueImpressions: total.uniqueImpressions + row.unique_organic_impressions,
      clicks: total.clicks + row.total_clicks,
      reactions: total.reactions + row.total_reactions,
      comments: total.comments + row.total_comments,
      shares: total.shares + row.total_shares,
      sponsoredImpressions: total.sponsoredImpressions + row.sponsored_impressions,
    }),
    {
      impressions: 0,
      uniqueImpressions: 0,
      clicks: 0,
      reactions: 0,
      comments: 0,
      shares: 0,
      sponsoredImpressions: 0,
    }
  );
  const actions = summary.clicks + summary.reactions + summary.comments + summary.shares;
  return {
    ...summary,
    actions,
    engagementRate: summary.impressions > 0 ? actions / summary.impressions : 0,
    ctr: summary.impressions > 0 ? summary.clicks / summary.impressions : 0,
  };
}

function trendKey(date: string, granularity: LinkedinTrendGranularity): string {
  return granularity === "month" ? date.slice(0, 7) : date.slice(0, 10);
}

function trendLabel(key: string, granularity: LinkedinTrendGranularity): string {
  const date = new Date(`${granularity === "month" ? `${key}-01` : key}T12:00:00.000Z`);
  return date.toLocaleDateString("pt-BR", granularity === "month"
    ? { month: "short", year: "2-digit", timeZone: "UTC" }
    : { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function buildLinkedinMonthlyTrend(
  rows: LinkedinDailyMetric[],
  granularity: LinkedinTrendGranularity = "month"
): LinkedinTrendPoint[] {
  const grouped = new Map<string, LinkedinDailyMetric[]>();
  for (const row of rows) {
    const key = trendKey(row.metric_date, granularity);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => {
      const summary = aggregateLinkedinDailyMetrics(group);
      return {
        key,
        label: trendLabel(key, granularity),
        impressions: summary.impressions,
        clicks: summary.clicks,
        engagementRate: summary.engagementRate * 100,
        ctr: summary.ctr * 100,
      };
    });
}

export function aggregateLinkedinAudienceMetrics(
  followerRows: LinkedinFollowerDailyMetric[],
  visitorRows: LinkedinVisitorDailyMetric[]
): LinkedinAudienceSummary {
  const followers = followerRows.reduce(
    (total, row) => ({
      newFollowers: total.newFollowers + row.total_followers,
      organicFollowers: total.organicFollowers + row.organic_followers,
      sponsoredFollowers: total.sponsoredFollowers + row.sponsored_followers,
      autoInvitedFollowers: total.autoInvitedFollowers + row.auto_invited_followers,
    }),
    { newFollowers: 0, organicFollowers: 0, sponsoredFollowers: 0, autoInvitedFollowers: 0 }
  );
  const visitors = visitorRows.reduce(
    (total, row) => ({
      pageViews: total.pageViews + row.total_views_total,
      uniqueVisitors: total.uniqueVisitors + row.total_unique_total,
      desktopViews: total.desktopViews + row.total_views_desktop,
      mobileViews: total.mobileViews + row.total_views_mobile,
    }),
    { pageViews: 0, uniqueVisitors: 0, desktopViews: 0, mobileViews: 0 }
  );
  return {
    ...followers,
    ...visitors,
    viewsPerVisitor: visitors.uniqueVisitors > 0 ? visitors.pageViews / visitors.uniqueVisitors : 0,
  };
}

export function buildLinkedinAudienceTrend(
  followerRows: LinkedinFollowerDailyMetric[],
  visitorRows: LinkedinVisitorDailyMetric[],
  granularity: LinkedinTrendGranularity = "month"
): LinkedinAudienceTrendPoint[] {
  const grouped = new Map<string, { followers: LinkedinFollowerDailyMetric[]; visitors: LinkedinVisitorDailyMetric[] }>();
  for (const row of followerRows) {
    const key = trendKey(row.metric_date, granularity);
    const group = grouped.get(key) ?? { followers: [], visitors: [] };
    group.followers.push(row);
    grouped.set(key, group);
  }
  for (const row of visitorRows) {
    const key = trendKey(row.metric_date, granularity);
    const group = grouped.get(key) ?? { followers: [], visitors: [] };
    group.visitors.push(row);
    grouped.set(key, group);
  }
  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => {
      const summary = aggregateLinkedinAudienceMetrics(group.followers, group.visitors);
      return {
        key,
        label: trendLabel(key, granularity),
        newFollowers: summary.newFollowers,
        pageViews: summary.pageViews,
        uniqueVisitors: summary.uniqueVisitors,
      };
    });
}

export function getLinkedinPostActions(post: LinkedinPost): number {
  return post.clicks + post.likes + post.comments + post.shares + post.followers;
}

function performanceRows(map: Map<string, LinkedinGroupPerformance>): LinkedinGroupPerformance[] {
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      engagementRate: row.impressions > 0 ? (row.actions / row.impressions) * 100 : 0,
    }))
    .sort((left, right) => right.engagementRate - left.engagementRate || right.impressions - left.impressions);
}

export function computeLinkedinPerformanceByArea(
  posts: LinkedinPost[]
): LinkedinGroupPerformance[] {
  const map = new Map<string, LinkedinGroupPerformance>();
  for (const post of posts) {
    const areas = post.instagram_post?.areas?.length
      ? post.instagram_post.areas
      : post.instagram_post?.area
        ? [post.instagram_post.area]
        : [];
    for (const area of areas) {
      const current = map.get(area) ?? {
        label: area,
        posts: 0,
        impressions: 0,
        actions: 0,
        engagementRate: 0,
      };
      current.posts += 1;
      current.impressions += post.impressions;
      current.actions += getLinkedinPostActions(post);
      map.set(area, current);
    }
  }
  return performanceRows(map);
}

export function computeLinkedinPerformanceByAuthor(
  posts: LinkedinPost[]
): LinkedinGroupPerformance[] {
  const map = new Map<string, LinkedinGroupPerformance>();
  for (const post of posts) {
    const authors = post.instagram_post?.solicitantes ?? [];
    if (authors.length === 0 && post.byline) {
      const current = map.get(post.byline) ?? {
        label: post.byline,
        posts: 0,
        impressions: 0,
        actions: 0,
        engagementRate: 0,
      };
      current.posts += 1;
      current.impressions += post.impressions;
      current.actions += getLinkedinPostActions(post);
      map.set(post.byline, current);
      continue;
    }

    for (const author of authors) {
      const current = map.get(author.id) ?? {
        label: author.name,
        posts: 0,
        impressions: 0,
        actions: 0,
        engagementRate: 0,
      };
      current.posts += 1;
      current.impressions += post.impressions;
      current.actions += getLinkedinPostActions(post);
      map.set(author.id, current);
    }
  }
  return performanceRows(map);
}

export function computeLinkedinPerformanceByFormat(
  posts: LinkedinPost[]
): LinkedinGroupPerformance[] {
  const map = new Map<string, LinkedinGroupPerformance>();
  for (const post of posts) {
    const label = post.content_type === "Vídeo" || post.instagram_post?.media_type === "VIDEO"
      ? "Vídeo"
      : post.instagram_post?.media_type === "CAROUSEL_ALBUM"
        ? "Carrossel"
        : "Imagem / texto";
    const current = map.get(label) ?? {
      label,
      posts: 0,
      impressions: 0,
      actions: 0,
      engagementRate: 0,
    };
    current.posts += 1;
    current.impressions += post.impressions;
    current.actions += getLinkedinPostActions(post);
    map.set(label, current);
  }
  return performanceRows(map);
}

export function getLinkedinPostTitle(caption: string | null, max = 100): string {
  if (!caption) return "Publicação sem legenda";
  const lines = caption.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const firstMeaningful = lines.find((line) => !/^.{0,12}tempo de leitura/i.test(line)) ?? lines[0];
  if (!firstMeaningful) return "Publicação sem legenda";
  return firstMeaningful.length > max ? `${firstMeaningful.slice(0, max)}…` : firstMeaningful;
}

export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/* ------------------------------------------------------------------
 * Período das telas de Métricas (datas AAAA-MM-DD, fuso de São Paulo).
 * Sem nenhum dia importado no período, o número vira null (e não zero):
 * assim a tela mostra "sem dado" em vez de uma queda de 100%.
 * ------------------------------------------------------------------ */

export interface LinkedinPeriodTotals {
  contentDays: number;
  impressions: number | null;
  organicImpressions: number | null;
  sponsoredImpressions: number | null;
  uniqueImpressions: number | null;
  clicks: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  /** Em % (0–100). */
  ctr: number | null;
  /** (cliques + reações + comentários + compartilhamentos) ÷ impressões, em %. */
  engagementRate: number | null;
  followerDays: number;
  newFollowers: number | null;
  organicFollowers: number | null;
  sponsoredFollowers: number | null;
  autoInvitedFollowers: number | null;
  visitorDays: number;
  pageViews: number | null;
  uniqueVisitors: number | null;
  mobileViews: number | null;
  desktopViews: number | null;
  overviewViews: number | null;
  lifeViews: number | null;
  jobsViews: number | null;
  viewsPerVisitor: number | null;
}

function inDateRange(date: string, from: string, to: string): boolean {
  const day = date.slice(0, 10);
  return day >= from && day <= to;
}

export function computeLinkedinPeriodTotals(
  data: {
    dailyMetrics: LinkedinDailyMetric[];
    followerDailyMetrics: LinkedinFollowerDailyMetric[];
    visitorDailyMetrics: LinkedinVisitorDailyMetric[];
  },
  from: string,
  to: string
): LinkedinPeriodTotals {
  const content = data.dailyMetrics.filter((row) => inDateRange(row.metric_date, from, to));
  const followers = data.followerDailyMetrics.filter((row) => inDateRange(row.metric_date, from, to));
  const visitors = data.visitorDailyMetrics.filter((row) => inDateRange(row.metric_date, from, to));
  const summary = aggregateLinkedinDailyMetrics(content);
  const audience = aggregateLinkedinAudienceMetrics(followers, visitors);
  const hasContent = content.length > 0;
  const hasFollowers = followers.length > 0;
  const hasVisitors = visitors.length > 0;
  const ifContent = (value: number) => (hasContent ? value : null);
  const ifFollowers = (value: number) => (hasFollowers ? value : null);
  const ifVisitors = (value: number) => (hasVisitors ? value : null);
  const visitorSections = visitors.reduce(
    (total, row) => ({
      overview: total.overview + row.overview_views_total,
      life: total.life + row.life_views_total,
      jobs: total.jobs + row.jobs_views_total,
    }),
    { overview: 0, life: 0, jobs: 0 }
  );

  return {
    contentDays: content.length,
    impressions: ifContent(summary.impressions),
    organicImpressions: ifContent(summary.impressions - summary.sponsoredImpressions),
    sponsoredImpressions: ifContent(summary.sponsoredImpressions),
    uniqueImpressions: ifContent(summary.uniqueImpressions),
    clicks: ifContent(summary.clicks),
    reactions: ifContent(summary.reactions),
    comments: ifContent(summary.comments),
    shares: ifContent(summary.shares),
    ctr: hasContent && summary.impressions > 0 ? summary.ctr * 100 : null,
    engagementRate: hasContent && summary.impressions > 0 ? summary.engagementRate * 100 : null,
    followerDays: followers.length,
    newFollowers: ifFollowers(audience.newFollowers),
    organicFollowers: ifFollowers(audience.organicFollowers),
    sponsoredFollowers: ifFollowers(audience.sponsoredFollowers),
    autoInvitedFollowers: ifFollowers(audience.autoInvitedFollowers),
    visitorDays: visitors.length,
    pageViews: ifVisitors(audience.pageViews),
    uniqueVisitors: ifVisitors(audience.uniqueVisitors),
    mobileViews: ifVisitors(audience.mobileViews),
    desktopViews: ifVisitors(audience.desktopViews),
    overviewViews: ifVisitors(visitorSections.overview),
    lifeViews: ifVisitors(visitorSections.life),
    jobsViews: ifVisitors(visitorSections.jobs),
    viewsPerVisitor: hasVisitors && audience.uniqueVisitors > 0 ? audience.viewsPerVisitor : null,
  };
}

/** Um ponto por dia do período; dia sem importação fica null (buraco no gráfico). */
export function linkedinDailySeries<T extends { metric_date: string }>(
  rows: T[],
  value: (row: T) => number | null,
  from: string,
  to: string
): { date: string; value: number | null }[] {
  const byDate = new Map(rows.map((row) => [row.metric_date.slice(0, 10), row]));
  const series: { date: string; value: number | null }[] = [];
  for (let cursor = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); cursor <= end; cursor += 86_400_000) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    const row = byDate.get(date);
    series.push({ date, value: row ? value(row) : null });
  }
  return series;
}

/** Primeiro e último dia com dado importado (conteúdo, seguidores ou visitantes). */
export function linkedinDataRange(data: {
  dailyMetrics: { metric_date: string }[];
  followerDailyMetrics: { metric_date: string }[];
  visitorDailyMetrics: { metric_date: string }[];
}): { first: string | null; last: string | null } {
  let first: string | null = null;
  let last: string | null = null;
  for (const rows of [data.dailyMetrics, data.followerDailyMetrics, data.visitorDailyMetrics]) {
    for (const row of rows) {
      const date = row.metric_date.slice(0, 10);
      if (!first || date < first) first = date;
      if (!last || date > last) last = date;
    }
  }
  return { first, last };
}

/** Taxa de engajamento do post em % (o LinkedIn exporta em fração). */
export function linkedinPostEngagementPercent(post: Pick<LinkedinPost, "engagement_rate">): number {
  return (post.engagement_rate ?? 0) * 100;
}
