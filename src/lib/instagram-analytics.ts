import type { Area } from "./areas";
import type { InstagramPost } from "./instagram-posts";
import type { User } from "./users";
import { computeEngagementActionsFromPost } from "./instagram-engagement";
import { getPostAreas, getPostSolicitantes } from "./instagram-link-rules";
import { isUserActive } from "./user-status";

export interface BarChartItem {
  label: string;
  total: number;
  sublabel?: string;
  isFormerEmployee?: boolean;
  avatarUrl?: string | null;
}

export interface CollaboratorInsight {
  userId: string;
  name: string;
  avatar_url: string | null;
  department: string;
  is_active: boolean;
  posts: number;
  reach: number;
  views: number;
  engagementActions: number;
}

export interface AreaInsight {
  area: string;
  posts: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  engagementActions: number;
  avgEngagementActions: number;
  collaborators: CollaboratorInsight[];
}

export type TrendGranularity = "week" | "month";

export interface EngagementTrendPoint {
  bucketStart: string;
  bucketLabel: string;
  postsCount: number;
  reach: number;
  views: number;
  engagementActions: number;
  engagementRate: number;
}

export interface TopPostInsight {
  post: InstagramPost;
  engagementRate: number;
  engagementActions: number;
}

export interface TopAreaInsight {
  area: string;
  postsCount: number;
  totalReach: number;
  engagementRate: number;
}

export interface CaptionThemePerformance {
  theme: string;
  postsCount: number;
  totalReach: number;
  totalEngagementActions: number;
  engagementRate: number;
  sampleCaptions: string[];
}

export interface ContentSuggestionInsight {
  title: string;
  reason: string;
  suggestion: string;
  expectedImpact: "alto" | "medio";
}

export interface BestPostingHourInsight {
  hour: number;
  hourLabel: string;
  postsCount: number;
  totalReach: number;
  totalEngagementActions: number;
  engagementRate: number;
}

export interface PostingHeatmapCell {
  day: number;
  block: number;
  postsCount: number;
  engagementRate: number;
}

export interface PostingHeatmap {
  cells: PostingHeatmapCell[];
  maxRate: number;
  best: PostingHeatmapCell | null;
  blockLabels: string[];
  dayLabels: string[];
}

export interface PeriodMetrics {
  postsCount: number;
  reach: number;
  engagementRate: number;
}

export interface PeriodComparison {
  rangeDays: number;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltaRatePts: number | null;
  deltaReachPct: number | null;
  deltaPostsPct: number | null;
}

export interface FormatPerformance {
  mediaType: string;
  postsCount: number;
  totalReach: number;
  totalEngagementActions: number;
  engagementRate: number;
}

function aggregatePostMetrics(posts: InstagramPost[]) {
  return posts.reduce(
    (acc, p) => ({
      posts: acc.posts + 1,
      reach: acc.reach + p.reach,
      views: acc.views + p.views,
      likes: acc.likes + p.likes,
      comments: acc.comments + p.comments,
      saves: acc.saves + p.saves,
      engagementActions: acc.engagementActions + computeEngagementActionsFromPost(p),
    }),
    { posts: 0, reach: 0, views: 0, likes: 0, comments: 0, saves: 0, engagementActions: 0 }
  );
}

const CAPTION_THEME_RULES: { theme: string; keywords: string[] }[] = [
  {
    theme: "Reestruturacao e Insolvencia",
    keywords: ["reestrutur", "insolv", "recuperacao judicial", "falencia", "crise"],
  },
  {
    theme: "Direito Empresarial",
    keywords: ["empres", "societar", "contrato", "governan", "compliance"],
  },
  {
    theme: "Gestao e Estrategia",
    keywords: ["gestao", "estrateg", "processo", "produtiv", "lideran"],
  },
  {
    theme: "Educacao Juridica",
    keywords: ["explic", "entenda", "guia", "passo a passo", "o que e"],
  },
  {
    theme: "Cases e Resultados",
    keywords: ["case", "resultado", "vitoria", "sucesso", "decisao"],
  },
];

function normalizeCaption(text: string | null | undefined) {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function extractThemesFromCaption(caption: string | null | undefined): string[] {
  const normalized = normalizeCaption(caption);
  if (!normalized) return [];
  const themes = CAPTION_THEME_RULES
    .filter((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)))
    .map((rule) => rule.theme);
  return themes.length > 0 ? themes : ["Outros temas"];
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date: Date) {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatTrendBucketLabel(date: Date, granularity: TrendGranularity) {
  if (granularity === "month") {
    return date.toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    });
  }
  const end = new Date(date);
  end.setDate(end.getDate() + 6);
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
}

function normalizeBucketStart(date: Date, granularity: TrendGranularity) {
  return granularity === "month" ? startOfMonth(date) : startOfWeek(date);
}

export function computeEngagementTrend(
  posts: InstagramPost[],
  options?: {
    granularity?: TrendGranularity;
    rangeDays?: number;
    now?: Date;
  }
): EngagementTrendPoint[] {
  const granularity = options?.granularity ?? "week";
  const rangeDays = options?.rangeDays ?? 90;
  const now = options?.now ?? new Date();

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - Math.max(1, rangeDays) + 1);
  startDate.setHours(0, 0, 0, 0);

  const bucketMap = new Map<string, Omit<EngagementTrendPoint, "bucketLabel">>();

  for (const post of posts) {
    if (!post.published_at) continue;
    const published = new Date(post.published_at);
    if (Number.isNaN(published.getTime())) continue;
    if (published < startDate || published > now) continue;

    const bucketStartDate = normalizeBucketStart(published, granularity);
    const key = bucketStartDate.toISOString();
    const current = bucketMap.get(key) ?? {
      bucketStart: key,
      postsCount: 0,
      reach: 0,
      views: 0,
      engagementActions: 0,
      engagementRate: 0,
    };

    current.postsCount += 1;
    current.reach += post.reach;
    current.views += post.views;
    current.engagementActions += computeEngagementActionsFromPost(post);
    bucketMap.set(key, current);
  }

  return Array.from(bucketMap.values())
    .map((bucket) => {
      const rate = bucket.reach > 0 ? (bucket.engagementActions / bucket.reach) * 100 : 0;
      return {
        ...bucket,
        engagementRate: rate,
        bucketLabel: formatTrendBucketLabel(new Date(bucket.bucketStart), granularity),
      };
    })
    .sort((a, b) => new Date(a.bucketStart).getTime() - new Date(b.bucketStart).getTime());
}

export function computeMonthlyPostVolume(posts: InstagramPost[]) {
  const map = new Map<string, { monthLabel: string; postsCount: number }>();

  for (const post of posts) {
    if (!post.published_at) continue;
    const published = new Date(post.published_at);
    if (Number.isNaN(published.getTime())) continue;
    const month = new Date(published.getFullYear(), published.getMonth(), 1);
    const key = month.toISOString();
    const current = map.get(key) ?? {
      monthLabel: month.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      postsCount: 0,
    };
    current.postsCount += 1;
    map.set(key, current);
  }

  return Array.from(map.entries())
    .map(([monthStart, data]) => ({ monthStart, ...data }))
    .sort((a, b) => new Date(a.monthStart).getTime() - new Date(b.monthStart).getTime());
}

const HEATMAP_DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function getZonedDayHour(date: Date, timeZone: string): { day: number; hour: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hourRaw = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const hour = Number.isNaN(hourRaw) ? date.getHours() : hourRaw % 24;
  return { day: WEEKDAY_INDEX[weekday] ?? 0, hour };
}

export function computeBestPostingHours(
  posts: InstagramPost[],
  options?: {
    limit?: number;
    timeZone?: string;
    minPosts?: number;
  }
): BestPostingHourInsight[] {
  const limit = options?.limit ?? 5;
  const minPosts = options?.minPosts ?? 1;
  const timeZone = options?.timeZone ?? "America/Sao_Paulo";

  const byHour = new Map<number, Omit<BestPostingHourInsight, "hour" | "hourLabel" | "engagementRate">>();

  for (const post of posts) {
    if (!post.published_at) continue;
    const published = new Date(post.published_at);
    if (Number.isNaN(published.getTime())) continue;

    const { hour } = getZonedDayHour(published, timeZone);
    const current = byHour.get(hour) ?? {
      postsCount: 0,
      totalReach: 0,
      totalEngagementActions: 0,
    };
    current.postsCount += 1;
    current.totalReach += post.reach;
    current.totalEngagementActions += computeEngagementActionsFromPost(post);
    byHour.set(hour, current);
  }

  const mapped = Array.from(byHour.entries()).map(([hour, stats]) => ({
    hour,
    hourLabel: `${String(hour).padStart(2, "0")}:00`,
    postsCount: stats.postsCount,
    totalReach: stats.totalReach,
    totalEngagementActions: stats.totalEngagementActions,
    engagementRate:
      stats.totalReach > 0 ? (stats.totalEngagementActions / stats.totalReach) * 100 : 0,
  }));

  // Prioriza janelas com amostra relevante; cai para todas se nenhuma atingir o mínimo.
  const reliable = mapped.filter((slot) => slot.postsCount >= minPosts);
  const pool = reliable.length > 0 ? reliable : mapped;

  return pool
    .sort(
      (a, b) =>
        b.engagementRate - a.engagementRate ||
        b.postsCount - a.postsCount ||
        a.hour - b.hour
    )
    .slice(0, limit);
}

export function computePostingHeatmap(
  posts: InstagramPost[],
  options?: { timeZone?: string }
): PostingHeatmap {
  const timeZone = options?.timeZone ?? "America/Sao_Paulo";
  const blockCount = 8; // blocos de 3 horas
  const map = new Map<string, { postsCount: number; reach: number; actions: number }>();

  for (const post of posts) {
    if (!post.published_at) continue;
    const published = new Date(post.published_at);
    if (Number.isNaN(published.getTime())) continue;

    const { day, hour } = getZonedDayHour(published, timeZone);
    const block = Math.min(blockCount - 1, Math.floor(hour / 3));
    const key = `${day}-${block}`;
    const current = map.get(key) ?? { postsCount: 0, reach: 0, actions: 0 };
    current.postsCount += 1;
    current.reach += post.reach;
    current.actions += computeEngagementActionsFromPost(post);
    map.set(key, current);
  }

  const cells: PostingHeatmapCell[] = Array.from(map.entries()).map(([key, value]) => {
    const [day, block] = key.split("-").map(Number);
    return {
      day,
      block,
      postsCount: value.postsCount,
      engagementRate: value.reach > 0 ? (value.actions / value.reach) * 100 : 0,
    };
  });

  const maxRate = cells.reduce((max, c) => Math.max(max, c.engagementRate), 0);
  const best = cells.length
    ? cells.reduce((top, c) => (c.engagementRate > top.engagementRate ? c : top))
    : null;

  const blockLabels = Array.from({ length: blockCount }, (_, i) => `${String(i * 3).padStart(2, "0")}h`);

  return { cells, maxRate, best, blockLabels, dayLabels: HEATMAP_DAY_LABELS };
}

export function computePeriodComparison(
  posts: InstagramPost[],
  options?: { rangeDays?: number; now?: Date; range?: { from: Date; to: Date } }
): PeriodComparison {
  const now = options?.now ?? new Date();

  let currentStart: Date;
  let currentEnd: Date;
  let previousStart: Date;
  let rangeDays: number;

  if (options?.range) {
    // Período selecionado: compara contra a janela imediatamente anterior de mesma duração.
    currentStart = options.range.from;
    currentEnd = options.range.to;
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    previousStart = new Date(currentStart.getTime() - durationMs);
    rangeDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)));
  } else {
    rangeDays = options?.rangeDays ?? 30;
    currentEnd = now;
    currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - rangeDays);
    previousStart = new Date(now);
    previousStart.setDate(previousStart.getDate() - rangeDays * 2);
  }

  const accumulate = (from: Date, to: Date): PeriodMetrics => {
    let postsCount = 0;
    let reach = 0;
    let actions = 0;
    for (const post of posts) {
      if (!post.published_at) continue;
      const published = new Date(post.published_at);
      if (Number.isNaN(published.getTime())) continue;
      if (published < from || published >= to) continue;
      postsCount += 1;
      reach += post.reach;
      actions += computeEngagementActionsFromPost(post);
    }
    return {
      postsCount,
      reach,
      engagementRate: reach > 0 ? (actions / reach) * 100 : 0,
    };
  };

  const current = accumulate(currentStart, currentEnd);
  const previous = accumulate(previousStart, currentStart);

  return {
    rangeDays,
    current,
    previous,
    deltaRatePts:
      previous.postsCount > 0 ? current.engagementRate - previous.engagementRate : null,
    deltaReachPct:
      previous.reach > 0 ? ((current.reach - previous.reach) / previous.reach) * 100 : null,
    deltaPostsPct:
      previous.postsCount > 0
        ? ((current.postsCount - previous.postsCount) / previous.postsCount) * 100
        : null,
  };
}

export function computeFormatPerformance(posts: InstagramPost[]): FormatPerformance[] {
  const map = new Map<string, { postsCount: number; reach: number; actions: number }>();

  for (const post of posts) {
    const mediaType = post.media_type ?? "POST";
    const current = map.get(mediaType) ?? { postsCount: 0, reach: 0, actions: 0 };
    current.postsCount += 1;
    current.reach += post.reach;
    current.actions += computeEngagementActionsFromPost(post);
    map.set(mediaType, current);
  }

  return Array.from(map.entries())
    .map(([mediaType, value]) => ({
      mediaType,
      postsCount: value.postsCount,
      totalReach: value.reach,
      totalEngagementActions: value.actions,
      engagementRate: value.reach > 0 ? (value.actions / value.reach) * 100 : 0,
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate);
}

export function computeTopPostsByEngagementRate(
  posts: InstagramPost[],
  limit = 5
): TopPostInsight[] {
  return posts
    .filter((p) => p.reach > 0)
    .map((post) => {
      const engagementActions = computeEngagementActionsFromPost(post);
      const engagementRate = (engagementActions / Math.max(1, post.reach)) * 100;
      return { post, engagementActions, engagementRate };
    })
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, limit);
}

export function computeTopAreasByEngagementRate(
  posts: InstagramPost[],
  limit = 3
): TopAreaInsight[] {
  const map = new Map<string, { postsCount: number; totalReach: number; engagementActions: number }>();

  for (const post of posts) {
    const areas = getPostAreas(post);
    if (areas.length === 0) continue;
    const actions = computeEngagementActionsFromPost(post);
    for (const area of areas) {
      const current = map.get(area) ?? {
        postsCount: 0,
        totalReach: 0,
        engagementActions: 0,
      };
      current.postsCount += 1;
      current.totalReach += post.reach;
      current.engagementActions += actions;
      map.set(area, current);
    }
  }

  return Array.from(map.entries())
    .map(([area, data]) => ({
      area,
      postsCount: data.postsCount,
      totalReach: data.totalReach,
      engagementRate:
        data.totalReach > 0 ? (data.engagementActions / data.totalReach) * 100 : 0,
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, limit);
}

export function computeCaptionThemePerformance(
  posts: InstagramPost[],
  limit = 12
): CaptionThemePerformance[] {
  const map = new Map<
    string,
    {
      postsCount: number;
      totalReach: number;
      totalEngagementActions: number;
      sampleCaptions: string[];
    }
  >();

  for (const post of posts) {
    const themes = extractThemesFromCaption(post.caption);
    const actions = computeEngagementActionsFromPost(post);
    for (const theme of themes) {
      const current = map.get(theme) ?? {
        postsCount: 0,
        totalReach: 0,
        totalEngagementActions: 0,
        sampleCaptions: [],
      };
      current.postsCount += 1;
      current.totalReach += post.reach;
      current.totalEngagementActions += actions;
      if (post.caption && current.sampleCaptions.length < 3) {
        current.sampleCaptions.push(post.caption);
      }
      map.set(theme, current);
    }
  }

  return Array.from(map.entries())
    .map(([theme, value]) => ({
      theme,
      postsCount: value.postsCount,
      totalReach: value.totalReach,
      totalEngagementActions: value.totalEngagementActions,
      engagementRate:
        value.totalReach > 0 ? (value.totalEngagementActions / value.totalReach) * 100 : 0,
      sampleCaptions: value.sampleCaptions,
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, limit);
}

export function computeContentSuggestions(posts: InstagramPost[]): ContentSuggestionInsight[] {
  const themePerformance = computeCaptionThemePerformance(posts, 4);
  const topByMedia = computeTopPostsByEngagementRate(posts, 20).reduce(
    (acc, item) => {
      const media = item.post.media_type ?? "POST";
      const current = acc.get(media) ?? { count: 0, rateSum: 0 };
      current.count += 1;
      current.rateSum += item.engagementRate;
      acc.set(media, current);
      return acc;
    },
    new Map<string, { count: number; rateSum: number }>()
  );

  const bestTheme = themePerformance[0];
  const secondTheme = themePerformance[1];
  const bestMedia = Array.from(topByMedia.entries())
    .map(([media, stats]) => ({ media, avgRate: stats.rateSum / Math.max(1, stats.count) }))
    .sort((a, b) => b.avgRate - a.avgRate)[0];

  const suggestions: ContentSuggestionInsight[] = [];

  if (bestTheme) {
    suggestions.push({
      title: `Dobrar pauta em ${bestTheme.theme}`,
      reason: `${bestTheme.postsCount} posts com taxa média de ${bestTheme.engagementRate.toFixed(2)}%.`,
      suggestion:
        "Criar uma série de 3 conteúdos com gancho prático e CTA para comentário.",
      expectedImpact: "alto",
    });
  }

  if (secondTheme) {
    suggestions.push({
      title: `Explorar variações de ${secondTheme.theme}`,
      reason: `Tema com alcance acumulado de ${secondTheme.totalReach.toLocaleString("pt-BR")}.`,
      suggestion:
        "Testar formato carrossel + roteiro curto em vídeo para aumentar retenção.",
      expectedImpact: "medio",
    });
  }

  if (bestMedia) {
    const mediaLabel =
      bestMedia.media === "CAROUSEL_ALBUM"
        ? "carrossel"
        : bestMedia.media === "VIDEO"
          ? "reel"
          : bestMedia.media === "IMAGE"
            ? "imagem"
            : "post";
    suggestions.push({
      title: `Aumentar frequência de ${mediaLabel}`,
      reason: `Melhor média entre top posts (${bestMedia.avgRate.toFixed(2)}% de engajamento).`,
      suggestion:
        "Planejar calendário com pelo menos 2 publicações semanais nesse formato.",
      expectedImpact: "alto",
    });
  }

  return suggestions.slice(0, 3);
}

export function computeOfficeInsight(posts: InstagramPost[]) {
  const metrics = aggregatePostMetrics(posts);
  return {
    ...metrics,
    avgEngagementActions:
      metrics.posts > 0 ? metrics.engagementActions / metrics.posts : 0,
  };
}

export function computeTopPostsByEngagement(
  posts: InstagramPost[],
  limit = 5
): InstagramPost[] {
  return [...posts]
    .sort(
      (a, b) =>
        computeEngagementActionsFromPost(b) - computeEngagementActionsFromPost(a)
    )
    .slice(0, limit);
}

export function computeEngagementActionsByArea(posts: InstagramPost[]): BarChartItem[] {
  const map = new Map<string, number>();
  for (const post of posts) {
    const actions = computeEngagementActionsFromPost(post);
    const areas = getPostAreas(post);
    if (areas.length === 0) {
      map.set("Sem área", (map.get("Sem área") ?? 0) + actions);
      continue;
    }
    for (const area of areas) {
      map.set(area, (map.get(area) ?? 0) + actions);
    }
  }
  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

/** @deprecated use computeEngagementActionsByArea */
export const computeInteractionsByArea = computeEngagementActionsByArea;

export function computeEngagementRateByArea(posts: InstagramPost[]): BarChartItem[] {
  const map = new Map<string, { reach: number; actions: number }>();
  for (const post of posts) {
    const areas = getPostAreas(post);
    if (areas.length === 0) continue;
    const actions = computeEngagementActionsFromPost(post);
    for (const area of areas) {
      const current = map.get(area) ?? { reach: 0, actions: 0 };
      current.reach += post.reach;
      current.actions += actions;
      map.set(area, current);
    }
  }

  return Array.from(map.entries())
    .map(([label, value]) => ({
      label,
      total: value.reach > 0 ? (value.actions / value.reach) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function computeEngagementActionsBySolicitante(
  posts: InstagramPost[],
  users: User[]
): BarChartItem[] {
  const map = new Map<
    string,
    { total: number; name: string; isFormerEmployee: boolean; avatarUrl: string | null }
  >();

  for (const post of posts) {
    const solicitantes = getPostSolicitantes(post);
    if (solicitantes.length === 0) continue;
    const actions = computeEngagementActionsFromPost(post);

    for (const solicitante of solicitantes) {
      const user = users.find((u) => u.id === solicitante.id);
      const name = user?.name ?? solicitante.name ?? "Desconhecido";
      const isFormerEmployee = user ? !isUserActive(user) : false;
      const current = map.get(solicitante.id) ?? {
        total: 0,
        name,
        isFormerEmployee,
        avatarUrl: user?.avatar_url ?? null,
      };
      map.set(solicitante.id, {
        total: current.total + actions,
        name,
        isFormerEmployee: current.isFormerEmployee || isFormerEmployee,
        avatarUrl: current.avatarUrl ?? user?.avatar_url ?? null,
      });
    }
  }

  return Array.from(map.values())
    .map(({ name, total, isFormerEmployee, avatarUrl }) => ({
      label: name,
      total,
      sublabel: isFormerEmployee ? "Ex-funcionário" : undefined,
      isFormerEmployee,
      avatarUrl,
    }))
    .sort((a, b) => b.total - a.total);
}

/** @deprecated use computeEngagementActionsBySolicitante */
export const computeInteractionsBySolicitante = computeEngagementActionsBySolicitante;

export function computeEngagementRateBySolicitante(
  posts: InstagramPost[],
  users: User[]
): BarChartItem[] {
  const map = new Map<
    string,
    { reach: number; actions: number; name: string; isFormerEmployee: boolean; avatarUrl: string | null }
  >();

  for (const post of posts) {
    const solicitantes = getPostSolicitantes(post);
    if (solicitantes.length === 0) continue;
    const actions = computeEngagementActionsFromPost(post);

    for (const solicitante of solicitantes) {
      const user = users.find((u) => u.id === solicitante.id);
      const name = user?.name ?? solicitante.name ?? "Desconhecido";
      const isFormerEmployee = user ? !isUserActive(user) : false;
      const current = map.get(solicitante.id) ?? {
        reach: 0,
        actions: 0,
        name,
        isFormerEmployee,
        avatarUrl: user?.avatar_url ?? null,
      };
      current.reach += post.reach;
      current.actions += actions;
      current.isFormerEmployee = current.isFormerEmployee || isFormerEmployee;
      current.avatarUrl = current.avatarUrl ?? user?.avatar_url ?? null;
      map.set(solicitante.id, current);
    }
  }

  return Array.from(map.values())
    .map((value) => ({
      label: value.name,
      total: value.reach > 0 ? (value.actions / value.reach) * 100 : 0,
      isFormerEmployee: value.isFormerEmployee,
      avatarUrl: value.avatarUrl,
      sublabel: value.isFormerEmployee ? "Ex-funcionário" : undefined,
    }))
    .sort((a, b) => b.total - a.total);
}

export function computeAreaDashboards(
  posts: InstagramPost[],
  areas: Area[],
  users: User[]
): AreaInsight[] {
  const areaNames = [
    ...areas.map((a) => a.name),
    ...new Set(posts.flatMap((p) => getPostAreas(p))),
  ].filter((name, i, arr) => arr.indexOf(name) === i);

  return areaNames
    .map((areaName) => {
      const areaPosts = posts.filter((p) => getPostAreas(p).includes(areaName));
      const metrics = aggregatePostMetrics(areaPosts);

      const departmentUsers = users.filter(
        (u) => u.department === areaName && isUserActive(u)
      );
      const solicitanteIds = new Set<string>();
      for (const post of areaPosts) {
        for (const s of getPostSolicitantes(post)) {
          solicitanteIds.add(s.id);
        }
      }

      const collaboratorIds = new Set([
        ...departmentUsers.map((u) => u.id),
        ...solicitanteIds,
      ]);

      const collaborators: CollaboratorInsight[] = Array.from(collaboratorIds)
        .map((userId) => {
          const user = users.find((u) => u.id === userId);
          if (!user) {
            const post = areaPosts.find((p) =>
              getPostSolicitantes(p).some((s) => s.id === userId)
            );
            const fallback = post
              ? getPostSolicitantes(post).find((s) => s.id === userId)
              : null;
            return {
              userId,
              name: fallback?.name ?? "Desconhecido",
              avatar_url: null,
              department: areaName,
              is_active: false,
              posts: 0,
              reach: 0,
              views: 0,
              engagementActions: 0,
            };
          }

          const userPosts = areaPosts.filter((p) =>
            getPostSolicitantes(p).some((s) => s.id === userId)
          );
          const userMetrics = aggregatePostMetrics(userPosts);

          return {
            userId: user.id,
            name: user.name,
            avatar_url: user.avatar_url,
            department: user.department,
            is_active: isUserActive(user),
            posts: userMetrics.posts,
            reach: userMetrics.reach,
            views: userMetrics.views,
            engagementActions: userMetrics.engagementActions,
          };
        })
        .filter((c) => c.posts > 0 || c.is_active)
        .sort(
          (a, b) =>
            Number(b.is_active) - Number(a.is_active) ||
            b.engagementActions - a.engagementActions ||
            b.posts - a.posts
        );

      return {
        area: areaName,
        posts: metrics.posts,
        reach: metrics.reach,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        saves: metrics.saves,
        engagementActions: metrics.engagementActions,
        avgEngagementActions:
          metrics.posts > 0 ? metrics.engagementActions / metrics.posts : 0,
        collaborators,
      };
    })
    .filter((a) => a.posts > 0 || a.collaborators.length > 0)
    .sort((a, b) => b.engagementActions - a.engagementActions);
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  return {
    items: items.slice(start, end),
    page: safePage,
    pageSize,
    total,
    totalPages,
    start: total === 0 ? 0 : start + 1,
    end,
  };
}
