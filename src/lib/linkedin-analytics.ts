import type { LinkedinDailyMetric, LinkedinPost } from "@/lib/linkedin-types";

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

export function buildLinkedinMonthlyTrend(rows: LinkedinDailyMetric[]): LinkedinTrendPoint[] {
  const grouped = new Map<string, LinkedinDailyMetric[]>();
  for (const row of rows) {
    const key = row.metric_date.slice(0, 7);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => {
      const summary = aggregateLinkedinDailyMetrics(group);
      const date = new Date(`${key}-01T12:00:00.000Z`);
      return {
        key,
        label: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }),
        impressions: summary.impressions,
        clicks: summary.clicks,
        engagementRate: summary.engagementRate * 100,
        ctr: summary.ctr * 100,
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
