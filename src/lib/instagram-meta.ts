const GRAPH_API_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const INSIGHT_CONCURRENCY = 6;

export const SYNC_SINCE_DEFAULT = "2025-01-01T00:00:00.000Z";

export interface MetaMediaItem {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export interface MetaMediaInsights {
  reach: number;
  views: number;
  saves: number;
  shares: number;
  likes: number;
  comments: number;
  total_interactions: number;
  follows: number;
  profile_visits: number;
  reposts: number;
  profile_activity: number;
  link_clicks: number;
  reels_avg_watch_time: number;
  reels_total_watch_time: number;
}

export interface MetaAccountStats {
  username: string;
  followers_count: number;
  media_count: number;
  ig_account_id: string;
  profile_picture_url: string | null;
  biography: string | null;
  website: string | null;
  follows_count: number | null;
  name: string | null;
}

export interface MetaAccountInsightsDay {
  date: string;
  reach: number;
  views: number;
  reach_followers: number;
  reach_non_followers: number;
  accounts_engaged: number;
  total_interactions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  replies: number;
  follows: number;
  unfollows: number;
  profile_links_taps: number;
}

export interface MetaDemographicEntry {
  kind: "followers" | "engaged" | "reached";
  breakdown: "age" | "gender" | "city" | "country";
  label: string;
  value: number;
}

export type SyncedMediaPost = MetaMediaItem &
  MetaMediaInsights & { published_at: string | null };

export interface MetaStoryItem {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  permalink?: string;
}

export interface MetaStoryInsights {
  reach: number;
  views: number;
  replies: number;
  shares: number;
  total_interactions: number;
  follows: number;
  profile_visits: number;
  nav_taps_forward: number;
  nav_taps_back: number;
  nav_exits: number;
  nav_swipe_forward: number;
}

export type SyncedStoryPost = MetaStoryItem &
  MetaStoryInsights & { published_at: string | null };

export interface SyncMediaPageResult {
  account: MetaAccountStats;
  posts: SyncedMediaPost[];
  nextAfter?: string;
  hasMore: boolean;
  reachedCutoff: boolean;
}

export interface SyncStoriesResult {
  account: MetaAccountStats;
  stories: SyncedStoryPost[];
}

function getMetaToken(): string {
  const raw =
    process.env.TOKEN_META_BP?.trim() ||
    process.env.TOKEN_META_ADS?.trim() ||
    "";
  if (!raw) {
    throw new Error(
      "TOKEN_META_BP não configurado. Defina TOKEN_META_BP no .env (local) ou nas variáveis de ambiente do deploy (ex.: Vercel) e reinicie o servidor."
    );
  }
  return raw.replace(/^Bearer\s+/i, "").trim();
}

async function graphFetch<T>(path: string): Promise<T> {
  const token = getMetaToken();
  const separator = path.includes("?") ? "&" : "?";
  const url = `${GRAPH_BASE}${path}${separator}access_token=${token}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Erro na Graph API (${res.status})`);
  }
  return json as T;
}

interface MetaPageWithInstagram {
  id: string;
  name?: string;
  instagram_business_account?: { id: string };
}

function resolveInstagramAccountId(pages: MetaPageWithInstagram[]): string | null {
  const linked = pages.filter((p) => p.instagram_business_account?.id);
  if (linked.length === 0) return null;

  const configuredIgId = process.env.META_IG_ACCOUNT_ID?.trim();
  if (configuredIgId) {
    const match = linked.find((p) => p.instagram_business_account?.id === configuredIgId);
    if (match?.instagram_business_account?.id) return match.instagram_business_account.id;
    throw new Error(
      `META_IG_ACCOUNT_ID=${configuredIgId} não encontrado nas páginas acessíveis pelo token.`
    );
  }

  const configuredPageId = process.env.META_PAGE_ID?.trim();
  if (configuredPageId) {
    const match = linked.find((p) => p.id === configuredPageId);
    if (match?.instagram_business_account?.id) return match.instagram_business_account.id;
    throw new Error(
      `META_PAGE_ID=${configuredPageId} não encontrada ou sem Instagram vinculado.`
    );
  }

  const preferredName = process.env.META_PAGE_NAME?.trim().toLowerCase();
  if (preferredName) {
    const match = linked.find((p) => p.name?.toLowerCase().includes(preferredName));
    if (match?.instagram_business_account?.id) return match.instagram_business_account.id;
  }

  const bismarchi = linked.find((p) => p.name?.toLowerCase().includes("bismarchi"));
  if (bismarchi?.instagram_business_account?.id) return bismarchi.instagram_business_account.id;

  if (linked.length === 1) return linked[0].instagram_business_account!.id;

  const options = linked
    .map((p) => `${p.name ?? p.id} → IG ${p.instagram_business_account!.id}`)
    .join("; ");
  throw new Error(
    `Várias páginas com Instagram encontradas. Defina META_PAGE_ID ou META_IG_ACCOUNT_ID no .env. Opções: ${options}`
  );
}

export async function getInstagramAccountId(): Promise<string> {
  const configuredIgId = process.env.META_IG_ACCOUNT_ID?.trim();
  if (configuredIgId) return configuredIgId;

  const data = await graphFetch<{ data?: MetaPageWithInstagram[] }>(
    "/me/accounts?fields=id,name,instagram_business_account"
  );

  const id = resolveInstagramAccountId(data.data ?? []);
  if (!id) {
    throw new Error(
      "Nenhuma página Facebook com Instagram Business vinculado. Verifique permissões pages_show_list e instagram_basic no token."
    );
  }
  return id;
}

export async function fetchAccountStats(igAccountId: string): Promise<MetaAccountStats> {
  const data = await graphFetch<{
    username: string;
    followers_count: number;
    follows_count: number;
    media_count: number;
    name?: string;
    biography?: string;
    website?: string;
    profile_picture_url?: string;
    id: string;
  }>(
    `/${igAccountId}?fields=username,name,followers_count,follows_count,media_count,biography,website,profile_picture_url`
  );
  return {
    username: data.username,
    followers_count: data.followers_count ?? 0,
    media_count: data.media_count ?? 0,
    ig_account_id: data.id,
    profile_picture_url: data.profile_picture_url ?? null,
    biography: data.biography ?? null,
    website: data.website ?? null,
    follows_count: data.follows_count ?? null,
    name: data.name ?? null,
  };
}

export async function fetchMediaPage(
  igAccountId: string,
  after?: string
): Promise<{ data: MetaMediaItem[]; nextAfter?: string }> {
  const fields =
    "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  const afterParam = after ? `&after=${after}` : "";
  const data = await graphFetch<{
    data: MetaMediaItem[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(`/${igAccountId}/media?fields=${fields}&limit=25${afterParam}`);

  return {
    data: data.data ?? [],
    nextAfter: data.paging?.cursors?.after,
  };
}

export async function fetchMediaItemById(mediaId: string): Promise<MetaMediaItem | null> {
  try {
    return await graphFetch<MetaMediaItem>(
      `/${mediaId}?fields=id,media_type,media_url,thumbnail_url`
    );
  } catch {
    return null;
  }
}

/** Métricas suportadas por surface (Instagram Media Insights). */
function mediaMetricsFor(productType: string | undefined): string[] {
  const base = ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions"];
  if (productType === "REELS") {
    return [...base, "reposts", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"];
  }
  // FEED (posts/carrossel) e fallback. profile_activity é buscado à parte (precisa breakdown).
  return [...base, "follows", "profile_visits", "reposts"];
}

function emptyMediaInsights(media?: MetaMediaItem): MetaMediaInsights {
  return {
    reach: 0,
    views: 0,
    saves: 0,
    shares: 0,
    likes: media?.like_count ?? 0,
    comments: media?.comments_count ?? 0,
    total_interactions: (media?.like_count ?? 0) + (media?.comments_count ?? 0),
    follows: 0,
    profile_visits: 0,
    reposts: 0,
    profile_activity: 0,
    link_clicks: 0,
    reels_avg_watch_time: 0,
    reels_total_watch_time: 0,
  };
}

async function fetchMediaMetricMap(
  mediaId: string,
  metrics: string[]
): Promise<Record<string, number>> {
  const data = await graphFetch<{ data: InsightRow[] }>(
    `/${mediaId}/insights?metric=${metrics.join(",")}`
  );
  const map: Record<string, number> = {};
  for (const item of data.data ?? []) {
    map[item.name] = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
  }
  return map;
}

export async function fetchMediaInsights(media: MetaMediaItem): Promise<MetaMediaInsights> {
  const result = emptyMediaInsights(media);
  const productType = media.media_product_type;

  let map: Record<string, number> | null = null;
  try {
    map = await fetchMediaMetricMap(media.id, mediaMetricsFor(productType));
  } catch {
    // Alguma métrica pode não existir para esta mídia — tenta o conjunto mínimo.
    try {
      map = await fetchMediaMetricMap(media.id, [
        "reach",
        "views",
        "likes",
        "comments",
        "saved",
        "shares",
        "total_interactions",
      ]);
    } catch {
      map = null;
    }
  }

  if (map) {
    result.reach = map.reach ?? 0;
    result.views = map.views ?? 0;
    result.saves = map.saved ?? 0;
    result.shares = map.shares ?? 0;
    result.likes = map.likes ?? result.likes;
    result.comments = map.comments ?? result.comments;
    result.total_interactions = map.total_interactions ?? result.total_interactions;
    result.follows = map.follows ?? 0;
    result.profile_visits = map.profile_visits ?? 0;
    result.reposts = map.reposts ?? 0;
    result.reels_avg_watch_time = map.ig_reels_avg_watch_time ?? 0;
    result.reels_total_watch_time = map.ig_reels_video_view_total_time ?? 0;
  }

  // profile_activity (breakdown action_type) — só posts de feed, chamada separada.
  if (productType !== "REELS") {
    try {
      const pa = await graphFetch<{ data: InsightRow[] }>(
        `/${media.id}/insights?metric=profile_activity&breakdown=action_type`
      );
      const row = pa.data?.find((r) => r.name === "profile_activity");
      result.profile_activity = row?.total_value?.value ?? 0;
      const results = row?.total_value?.breakdowns?.[0]?.results ?? [];
      for (const r of results) {
        const key = (r.dimension_values?.[0] ?? "").toLowerCase();
        if (key === "bio_link_clicked") result.link_clicks = r.value ?? 0;
      }
    } catch {
      // sem dados de profile_activity para esta mídia
    }
  }

  return result;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

async function enrichWithInsights(media: MetaMediaItem[]): Promise<SyncedMediaPost[]> {
  return mapWithConcurrency(media, INSIGHT_CONCURRENCY, async (item) => {
    let insights: MetaMediaInsights;
    try {
      insights = await fetchMediaInsights(item);
    } catch {
      insights = emptyMediaInsights(item);
    }
    return {
      ...item,
      ...insights,
      published_at: item.timestamp ?? null,
    };
  });
}

function emptyStoryInsights(): MetaStoryInsights {
  return {
    reach: 0,
    views: 0,
    replies: 0,
    shares: 0,
    total_interactions: 0,
    follows: 0,
    profile_visits: 0,
    nav_taps_forward: 0,
    nav_taps_back: 0,
    nav_exits: 0,
    nav_swipe_forward: 0,
  };
}

export async function fetchStoriesPage(
  igAccountId: string
): Promise<MetaStoryItem[]> {
  const data = await graphFetch<{ data: MetaStoryItem[] }>(
    `/${igAccountId}/stories?fields=id,media_type,media_url,thumbnail_url,timestamp,permalink&limit=50`
  );
  return data.data ?? [];
}

interface InsightRow {
  name: string;
  values?: { value: number }[];
  total_value?: {
    value?: number;
    breakdowns?: {
      results?: { dimension_values?: string[]; value?: number }[];
    }[];
  };
}

/**
 * Story insights conforme Instagram Media Insights (Graph API).
 * - `views` substitui o antigo `impressions` (descontinuado em 21/04/2025).
 * - `navigation` exige breakdown próprio e não pode ser combinado com as demais.
 * - Métricas estendidas (shares, follows, etc.) são opcionais: se o story tiver
 *   poucos espectadores a API pode falhar, então não derrubam as métricas-base.
 */
export async function fetchStoryInsights(story: MetaStoryItem): Promise<MetaStoryInsights> {
  const result = emptyStoryInsights();

  // 1) Métricas base + estendidas (sem breakdown).
  const extended = [
    "reach",
    "views",
    "replies",
    "shares",
    "total_interactions",
    "follows",
    "profile_visits",
  ];
  let map: Record<string, number> | null = null;
  try {
    map = await fetchStoryMetricMap(story.id, extended);
  } catch {
    // Fallback: tenta só o essencial (alguma métrica estendida pode não existir).
    try {
      map = await fetchStoryMetricMap(story.id, ["reach", "views", "replies"]);
    } catch {
      map = null;
    }
  }
  if (map) {
    result.reach = map.reach ?? 0;
    result.views = map.views ?? 0;
    result.replies = map.replies ?? 0;
    result.shares = map.shares ?? 0;
    result.total_interactions = map.total_interactions ?? 0;
    result.follows = map.follows ?? 0;
    result.profile_visits = map.profile_visits ?? 0;
  }

  // 2) navigation (breakdown story_navigation_action_type) em chamada separada.
  try {
    const nav = await graphFetch<{ data: InsightRow[] }>(
      `/${story.id}/insights?metric=navigation&breakdown=story_navigation_action_type`
    );
    const row = nav.data?.find((r) => r.name === "navigation");
    const results = row?.total_value?.breakdowns?.[0]?.results ?? [];
    for (const r of results) {
      const key = (r.dimension_values?.[0] ?? "").toLowerCase();
      const value = r.value ?? 0;
      if (key === "tap_forward") result.nav_taps_forward = value;
      else if (key === "tap_back") result.nav_taps_back = value;
      else if (key === "tap_exit") result.nav_exits = value;
      else if (key === "swipe_forward") result.nav_swipe_forward = value;
    }
  } catch {
    // navigation indisponível (story com poucos viewers) — mantém zeros.
  }

  return result;
}

async function fetchStoryMetricMap(
  storyId: string,
  metrics: string[]
): Promise<Record<string, number>> {
  const data = await graphFetch<{ data: InsightRow[] }>(
    `/${storyId}/insights?metric=${metrics.join(",")}`
  );
  const map: Record<string, number> = {};
  for (const item of data.data ?? []) {
    map[item.name] = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
  }
  return map;
}

export async function syncStories(): Promise<SyncStoriesResult> {
  const igAccountId = await getInstagramAccountId();
  const account = await fetchAccountStats(igAccountId);
  const stories = await fetchStoriesPage(igAccountId);

  const enriched = await mapWithConcurrency(stories, INSIGHT_CONCURRENCY, async (story) => {
    try {
      const insights = await fetchStoryInsights(story);
      return {
        ...story,
        ...insights,
        published_at: story.timestamp ?? null,
      };
    } catch {
      return {
        ...story,
        ...emptyStoryInsights(),
        published_at: story.timestamp ?? null,
      };
    }
  });

  return { account, stories: enriched };
}

// ---------------------------------------------------------------------------
// Insights de CONTA (diários) e DEMOGRAFIA da audiência
// ---------------------------------------------------------------------------

function unixDay(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Janelas de até 89 dias (limite prático da Graph API por requisição). */
function* insightDateChunks(
  from: Date,
  to: Date,
  chunkDays = 89
): Generator<{ since: Date; until: Date }> {
  let cursor = new Date(from);
  while (cursor.getTime() < to.getTime()) {
    const until = new Date(
      Math.min(cursor.getTime() + chunkDays * 86_400_000, to.getTime())
    );
    yield { since: new Date(cursor), until };
    cursor = new Date(until.getTime() + 86_400_000);
  }
}

async function mergeAccountMetricTimeSeries(
  igAccountId: string,
  metric: string,
  since: Date,
  until: Date,
  apply: (date: string, value: number) => void
): Promise<void> {
  const range = `since=${unixDay(since)}&until=${unixDay(until)}`;
  try {
    const data = await graphFetch<{
      data: { name: string; values: { value: number; end_time: string }[] }[];
    }>(
      `/${igAccountId}/insights?metric=${metric}&period=day&metric_type=time_series&${range}`
    );
    for (const row of data.data ?? []) {
      for (const v of row.values ?? []) {
        const date = (v.end_time ?? "").slice(0, 10);
        if (!date || date < SYNC_SINCE_DEFAULT.slice(0, 10)) continue;
        apply(date, v.value ?? 0);
      }
    }
  } catch {
    // métrica indisponível nesta janela
  }
}

/**
 * Insights diários da conta desde SYNC_SINCE_DEFAULT (2025), em janelas de 89 dias.
 * Persistidos no Supabase — o histórico vai crescendo a cada sincronização.
 */
export async function fetchAccountInsights(
  igAccountId: string,
  sinceIso: string = SYNC_SINCE_DEFAULT
): Promise<MetaAccountInsightsDay[]> {
  const byDate = new Map<string, MetaAccountInsightsDay>();
  const ensure = (date: string): MetaAccountInsightsDay => {
    let row = byDate.get(date);
    if (!row) {
      row = {
        date,
        reach: 0,
        views: 0,
        reach_followers: 0,
        reach_non_followers: 0,
        accounts_engaged: 0,
        total_interactions: 0,
        likes: 0,
        comments: 0,
        saves: 0,
        shares: 0,
        replies: 0,
        follows: 0,
        unfollows: 0,
        profile_links_taps: 0,
      };
      byDate.set(date, row);
    }
    return row;
  };

  const since = new Date(sinceIso);
  if (Number.isNaN(since.getTime())) {
    throw new Error("Data 'since' inválida para insights de conta.");
  }
  const until = new Date();

  const timeSeriesMetrics = [
    "reach",
    "views",
    "accounts_engaged",
    "total_interactions",
    "likes",
    "comments",
    "saves",
    "shares",
    "profile_links_taps",
  ] as const;

  for (const chunk of insightDateChunks(since, until)) {
    for (const metric of timeSeriesMetrics) {
      await mergeAccountMetricTimeSeries(igAccountId, metric, chunk.since, chunk.until, (date, val) => {
        const day = ensure(date);
        if (metric === "reach") day.reach = val;
        else if (metric === "views") day.views = val;
        else if (metric === "accounts_engaged") day.accounts_engaged = val;
        else if (metric === "total_interactions") day.total_interactions = val;
        else if (metric === "likes") day.likes = val;
        else if (metric === "comments") day.comments = val;
        else if (metric === "saves") day.saves = val;
        else if (metric === "shares") day.shares = val;
        else if (metric === "profile_links_taps") day.profile_links_taps = val;
      });
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

const DEMOGRAPHIC_REQUESTS: {
  metric: string;
  kind: MetaDemographicEntry["kind"];
  breakdowns: MetaDemographicEntry["breakdown"][];
}[] = [
  { metric: "follower_demographics", kind: "followers", breakdowns: ["age", "gender", "country", "city"] },
  { metric: "engaged_audience_demographics", kind: "engaged", breakdowns: ["country"] },
  { metric: "reached_audience_demographics", kind: "reached", breakdowns: ["country"] },
];

/** Demografia da audiência (idade, gênero, cidade, país). Exige 100+ seguidores. */
export async function fetchAudienceDemographics(
  igAccountId: string
): Promise<MetaDemographicEntry[]> {
  const entries: MetaDemographicEntry[] = [];

  for (const req of DEMOGRAPHIC_REQUESTS) {
    for (const breakdown of req.breakdowns) {
      try {
        const data = await graphFetch<{ data: InsightRow[] }>(
          `/${igAccountId}/insights?metric=${req.metric}&period=lifetime&timeframe=this_month&breakdown=${breakdown}&metric_type=total_value`
        );
        const results = data.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
        for (const r of results) {
          const values = r.dimension_values ?? [];
          const label = values[values.length - 1];
          if (!label) continue;
          entries.push({ kind: req.kind, breakdown, label, value: r.value ?? 0 });
        }
      } catch {
        // demografia indisponível para esta combinação
      }
    }
  }

  return entries;
}

export interface SyncAccountExtrasResult {
  account: MetaAccountStats;
  insights: MetaAccountInsightsDay[];
  demographics: MetaDemographicEntry[];
}

export async function syncAccountExtras(): Promise<SyncAccountExtrasResult> {
  const igAccountId = await getInstagramAccountId();
  const [account, insights, demographics] = await Promise.all([
    fetchAccountStats(igAccountId),
    fetchAccountInsights(igAccountId),
    fetchAudienceDemographics(igAccountId),
  ]);
  return { account, insights, demographics };
}

export async function syncMediaPage(
  sinceIso: string = SYNC_SINCE_DEFAULT,
  after?: string
): Promise<SyncMediaPageResult> {
  const since = new Date(sinceIso);
  if (Number.isNaN(since.getTime())) {
    throw new Error("Data 'since' inválida.");
  }

  const igAccountId = await getInstagramAccountId();
  const account = await fetchAccountStats(igAccountId);
  const page = await fetchMediaPage(igAccountId, after);

  if (page.data.length === 0) {
    return { account, posts: [], hasMore: false, reachedCutoff: true };
  }

  const inRange: MetaMediaItem[] = [];
  let reachedCutoff = false;

  for (const item of page.data) {
    const published = item.timestamp ? new Date(item.timestamp) : null;
    if (published && published < since) {
      reachedCutoff = true;
      break;
    }
    inRange.push(item);
  }

  const posts = inRange.length > 0 ? await enrichWithInsights(inRange) : [];
  const hasMore = !reachedCutoff && Boolean(page.nextAfter);

  return {
    account,
    posts,
    nextAfter: page.nextAfter,
    hasMore,
    reachedCutoff,
  };
}

/** @deprecated Use syncMediaPage para sync paginado desde 2025 */
export async function syncRecentMedia(limit = 50): Promise<{
  account: MetaAccountStats;
  posts: SyncedMediaPost[];
}> {
  const igAccountId = await getInstagramAccountId();
  const account = await fetchAccountStats(igAccountId);

  const collected: MetaMediaItem[] = [];
  let after: string | undefined;

  while (collected.length < limit) {
    const page = await fetchMediaPage(igAccountId, after);
    if (page.data.length === 0) break;
    collected.push(...page.data);
    if (!page.nextAfter || collected.length >= limit) break;
    after = page.nextAfter;
  }

  const posts = await enrichWithInsights(collected.slice(0, limit));
  return { account, posts };
}
