/**
 * Cálculos da tela de Instagram (sem acesso a banco: testável e usado no cliente).
 *
 * Números da conta (views, alcance, interações, ganhos/perdas) vêm dos dias
 * gravados em instagram_account_insights. Números de post (taxa de engajamento,
 * formatos, ranking) vêm dos posts PUBLICADOS no período.
 */
import type { InstagramPost, InstagramAccountStats } from "@/lib/instagram-posts";
import type { MetaAccountInsightsDay } from "@/lib/instagram-meta";
import { computeEngagementActionsFromPost, computePostEngagementRate } from "@/lib/instagram-engagement";
import { dateInSaoPaulo, eachDate, isDateInRange } from "@/lib/social-metrics/period";

export type InsightDay = MetaAccountInsightsDay;
export type InsightField = Exclude<keyof MetaAccountInsightsDay, "date">;

export type PostFormat = "reels" | "carrossel" | "imagem";

export const POST_FORMAT_LABELS: Record<PostFormat, string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  imagem: "Imagem",
};

export function postFormat(post: Pick<InstagramPost, "media_type" | "media_product_type">): PostFormat {
  if (post.media_product_type === "REELS" || post.media_type === "VIDEO") return "reels";
  if (post.media_type === "CAROUSEL_ALBUM") return "carrossel";
  return "imagem";
}

export function postDate(post: Pick<InstagramPost, "published_at">): string {
  return dateInSaoPaulo(post.published_at);
}

export function postsInRange<T extends Pick<InstagramPost, "published_at">>(posts: T[], from: string, to: string): T[] {
  return posts.filter((post) => isDateInRange(postDate(post), from, to));
}

export interface RangeSum {
  /** Soma dos dias com dado; null quando nenhum dia do período tem dado. */
  value: number | null;
  daysWithData: number;
  days: number;
}

/** Soma de um campo diário no período, ignorando dias sem dado (null). */
export function sumInsight(days: InsightDay[], field: InsightField, from: string, to: string): RangeSum {
  let value = 0;
  let daysWithData = 0;
  for (const day of days) {
    if (day.date < from || day.date > to) continue;
    const raw = day[field];
    if (raw === null || raw === undefined) continue;
    value += raw as number;
    daysWithData += 1;
  }
  const total = eachDate(from, to).length;
  return { value: daysWithData ? value : null, daysWithData, days: total };
}

/**
 * Primeiro dia em que a Meta tem o dado (valor > 0). Antes disso a API devolve
 * zero ou nada: a tela avisa "sem dado da Meta antes de DD/MM".
 */
export function insightCoverageStart(days: InsightDay[], field: InsightField): string | null {
  for (const day of days) {
    const raw = day[field];
    if (raw !== null && raw !== undefined && (raw as number) > 0) return day.date;
  }
  return null;
}

/** Soma só a parte do período coberta pela Meta (null se nada coberto). */
export function sumCovered(days: InsightDay[], field: InsightField, from: string, to: string): RangeSum & { coverageStart: string | null; partial: boolean } {
  const coverageStart = insightCoverageStart(days, field);
  if (!coverageStart || coverageStart > to) {
    return { value: null, daysWithData: 0, days: eachDate(from, to).length, coverageStart, partial: false };
  }
  const start = coverageStart > from ? coverageStart : from;
  const sum = sumInsight(days, field, start, to);
  return { ...sum, days: eachDate(from, to).length, coverageStart, partial: coverageStart > from };
}

export interface SeriesPoint {
  date: string;
  value: number | null;
}

export function dailySeries(days: InsightDay[], field: InsightField, from: string, to: string): SeriesPoint[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const coverageStart = insightCoverageStart(days, field);
  return eachDate(from, to).map((date) => {
    const day = byDate.get(date);
    const raw = day ? day[field] : null;
    const covered = coverageStart !== null && date >= coverageStart;
    return { date, value: covered && raw !== null && raw !== undefined ? (raw as number) : null };
  });
}

/** Média diária de um campo (alcance não soma entre dias: a mesma conta conta de novo). */
export function averageInsight(days: InsightDay[], field: InsightField, from: string, to: string): number | null {
  const sum = sumCovered(days, field, from, to);
  return sum.value === null || sum.daysWithData === 0 ? null : sum.value / sum.daysWithData;
}

/** Seguidores no fim de cada dia (última foto do dia em instagram_account_stats). */
export function followersByDay(stats: Pick<InstagramAccountStats, "fetched_at" | "followers_count">[]): Map<string, number> {
  const sorted = [...stats].sort((a, b) => a.fetched_at.localeCompare(b.fetched_at));
  const map = new Map<string, number>();
  for (const row of sorted) map.set(dateInSaoPaulo(row.fetched_at), row.followers_count);
  return map;
}

/** Seguidores no último dia conhecido até `date`. */
export function followersAt(byDay: Map<string, number>, date: string): number | null {
  let best: string | null = null;
  for (const day of byDay.keys()) if (day <= date && (!best || day > best)) best = day;
  return best ? byDay.get(best) ?? null : null;
}

export interface InstagramKpis {
  /** Soma do alcance dos posts publicados no período (como o escritório sempre mediu). */
  postsReach: number;
  views: number | null;
  reachAvg: number | null;
  interactions: number | null;
  engagementRate: number | null;
  follows: number | null;
  unfollows: number | null;
  netFollowers: number | null;
  posts: number;
  /** Primeiro dia com ganhos/perdas na Meta (avisar quando o período começa antes). */
  followsCoverageStart: string | null;
  viewsCoverageStart: string | null;
}

/** Taxa de engajamento dos posts: (curtidas + comentários + salvamentos) ÷ alcance. */
export function postsEngagementRate(posts: InstagramPost[]): number | null {
  const reach = posts.reduce((sum, post) => sum + post.reach, 0);
  if (reach <= 0) return null;
  const actions = posts.reduce((sum, post) => sum + computeEngagementActionsFromPost(post), 0);
  return (actions / reach) * 100;
}

export function computeInstagramKpis(days: InsightDay[], posts: InstagramPost[], from: string, to: string): InstagramKpis {
  const views = sumCovered(days, "views", from, to);
  const interactions = sumCovered(days, "total_interactions", from, to);
  const follows = sumCovered(days, "follows", from, to);
  const unfollows = sumCovered(days, "unfollows", from, to);
  const periodPosts = postsInRange(posts, from, to);
  return {
    postsReach: periodPosts.reduce((sum, post) => sum + post.reach, 0),
    views: views.value,
    reachAvg: averageInsight(days, "reach", from, to),
    interactions: interactions.value,
    engagementRate: postsEngagementRate(periodPosts),
    follows: follows.value,
    unfollows: unfollows.value,
    netFollowers: follows.value === null || unfollows.value === null ? null : follows.value - unfollows.value,
    posts: periodPosts.length,
    followsCoverageStart: follows.coverageStart,
    viewsCoverageStart: views.coverageStart,
  };
}

export interface PeriodGoal {
  target: number;
  /** % atingido (null sem meta). */
  pct: number | null;
}

export interface InstagramPeriodGoals {
  reach: PeriodGoal;
  engagement: PeriodGoal;
  posts: PeriodGoal;
}

/**
 * Metas do período, proporcionais ao número de dias (mês = 30 dias), igual à
 * tela antiga: alcance 15 mil/mês, engajamento 3,5% e a meta mensal de posts.
 */
export function computePeriodGoals(
  kpis: Pick<InstagramKpis, "postsReach" | "engagementRate" | "posts">,
  days: number,
  goals: { reachMonthly: number; engagementPct: number; postsMonthly: number }
): InstagramPeriodGoals {
  const factor = Math.max(1, days) / 30;
  const reachTarget = Math.round(goals.reachMonthly * factor);
  const postsTarget = Math.max(1, Math.round(goals.postsMonthly * factor));
  return {
    reach: { target: reachTarget, pct: reachTarget > 0 ? (kpis.postsReach / reachTarget) * 100 : null },
    engagement: {
      target: goals.engagementPct,
      pct: kpis.engagementRate === null ? null : (kpis.engagementRate / goals.engagementPct) * 100,
    },
    posts: { target: postsTarget, pct: (kpis.posts / postsTarget) * 100 },
  };
}

export interface MonthVolume {
  month: string;
  label: string;
  posts: number;
  current: boolean;
}

/** Posts por mês (fuso de São Paulo) dos últimos N meses até `until`. */
export function monthlyPostVolume(posts: Pick<InstagramPost, "published_at">[], until: string, months = 12): MonthVolume[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const date = postDate(post);
    if (date) counts.set(date.slice(0, 7), (counts.get(date.slice(0, 7)) ?? 0) + 1);
  }
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [year, month] = until.slice(0, 7).split("-").map(Number);
  const result: MonthVolume[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    result.push({
      month: key,
      label: `${labels[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`,
      posts: counts.get(key) ?? 0,
      current: i === 0,
    });
  }
  return result;
}

export interface FormatStats {
  format: PostFormat;
  posts: number;
  avgReach: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  avgSaves: number | null;
  avgShares: number | null;
}

/** Desempenho por formato pela MÉDIA por post (soma favorece o formato mais postado). */
export function computeFormatStats(posts: InstagramPost[]): FormatStats[] {
  return (["reels", "carrossel", "imagem"] as PostFormat[]).map((format) => {
    const own = posts.filter((post) => postFormat(post) === format);
    const avg = (pick: (post: InstagramPost) => number) =>
      own.length ? own.reduce((sum, post) => sum + pick(post), 0) / own.length : null;
    return {
      format,
      posts: own.length,
      avgReach: avg((p) => p.reach),
      avgViews: avg((p) => p.views),
      engagementRate: postsEngagementRate(own),
      avgSaves: avg((p) => p.saves),
      avgShares: avg((p) => p.shares),
    };
  });
}

export interface ViewsByFormat {
  reels: number;
  stories: number;
  carrossel: number;
  imagem: number;
  total: number;
  /** Dias do período sem o detalhe por formato. */
  missingDays: number;
}

export function computeViewsByFormat(days: InsightDay[], from: string, to: string): ViewsByFormat | null {
  const reels = sumInsight(days, "views_reels", from, to);
  if (reels.value === null) return null;
  const stories = sumInsight(days, "views_stories", from, to).value ?? 0;
  const carrossel = sumInsight(days, "views_carousel", from, to).value ?? 0;
  const imagem = sumInsight(days, "views_posts", from, to).value ?? 0;
  return {
    reels: reels.value,
    stories,
    carrossel,
    imagem,
    total: reels.value + stories + carrossel + imagem,
    missingDays: reels.days - reels.daysWithData,
  };
}

export type PostSortKey = "reach" | "views" | "saves" | "shares" | "engagement" | "follows" | "recent";

export const POST_SORT_OPTIONS: { value: PostSortKey; label: string }[] = [
  { value: "reach", label: "Alcance" },
  { value: "views", label: "Visualizações" },
  { value: "engagement", label: "Taxa de engajamento" },
  { value: "saves", label: "Salvamentos" },
  { value: "shares", label: "Compartilhamentos" },
  { value: "follows", label: "Seguidores ganhos" },
  { value: "recent", label: "Mais recentes" },
];

export function postSortValue(post: InstagramPost, key: PostSortKey): number {
  switch (key) {
    case "reach": return post.reach;
    case "views": return post.views;
    case "saves": return post.saves;
    case "shares": return post.shares;
    case "follows": return post.follows;
    case "engagement": return computePostEngagementRate(post);
    case "recent": return post.published_at ? new Date(post.published_at).getTime() : 0;
  }
}

export function sortPosts(posts: InstagramPost[], key: PostSortKey): InstagramPost[] {
  return [...posts].sort((a, b) => postSortValue(b, key) - postSortValue(a, key));
}

/** Engajamento por seguidor, como a API pública permite medir dos concorrentes. */
export function engagementPerFollower(posts: InstagramPost[], followers: number | null): number | null {
  if (!followers || posts.length === 0) return null;
  const perPost = posts.map((post) => ((post.likes + post.comments) / followers) * 100);
  return perPost.reduce((sum, value) => sum + value, 0) / perPost.length;
}
