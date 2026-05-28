const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const INSIGHT_METRICS = [
  "reach",
  "saved",
  "shares",
  "likes",
  "comments",
  "total_interactions",
  "views",
].join(",");

const INSIGHT_CONCURRENCY = 6;

export interface MetaMediaItem {
  id: string;
  caption?: string;
  media_type?: string;
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
}

export interface MetaAccountStats {
  username: string;
  followers_count: number;
  media_count: number;
  ig_account_id: string;
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
    media_count: number;
    id: string;
  }>(`/${igAccountId}?fields=username,followers_count,media_count`);
  return {
    username: data.username,
    followers_count: data.followers_count ?? 0,
    media_count: data.media_count ?? 0,
    ig_account_id: data.id,
  };
}

export async function fetchMediaPage(
  igAccountId: string,
  after?: string
): Promise<{ data: MetaMediaItem[]; nextAfter?: string }> {
  const fields =
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
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

export async function fetchMediaInsights(mediaId: string): Promise<MetaMediaInsights> {
  const data = await graphFetch<{
    data: { name: string; values: { value: number }[] }[];
  }>(`/${mediaId}/insights?metric=${INSIGHT_METRICS}`);

  const map: Record<string, number> = {};
  for (const item of data.data ?? []) {
    map[item.name] = item.values?.[0]?.value ?? 0;
  }

  return {
    reach: map.reach ?? 0,
    views: map.views ?? 0,
    saves: map.saved ?? 0,
    shares: map.shares ?? 0,
    likes: map.likes ?? 0,
    comments: map.comments ?? 0,
    total_interactions: map.total_interactions ?? 0,
  };
}

function fallbackInsights(media: MetaMediaItem): MetaMediaInsights {
  return {
    reach: 0,
    views: 0,
    saves: 0,
    shares: 0,
    likes: media.like_count ?? 0,
    comments: media.comments_count ?? 0,
    total_interactions: (media.like_count ?? 0) + (media.comments_count ?? 0),
  };
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
      insights = await fetchMediaInsights(item.id);
    } catch {
      insights = fallbackInsights(item);
    }
    return {
      ...item,
      ...insights,
      published_at: item.timestamp ?? null,
    };
  });
}

function storyMetricsForType(mediaType: string | null | undefined): string[] {
  if (mediaType === "VIDEO") {
    return ["reach", "views", "replies"];
  }
  return ["reach", "impressions", "replies"];
}

export async function fetchStoriesPage(
  igAccountId: string
): Promise<MetaStoryItem[]> {
  const data = await graphFetch<{ data: MetaStoryItem[] }>(
    `/${igAccountId}/stories?fields=id,media_type,media_url,thumbnail_url,timestamp,permalink&limit=50`
  );
  return data.data ?? [];
}

export async function fetchStoryInsights(story: MetaStoryItem): Promise<MetaStoryInsights> {
  const metrics = storyMetricsForType(story.media_type).join(",");
  const data = await graphFetch<{
    data: { name: string; values: { value: number }[] }[];
  }>(`/${story.id}/insights?metric=${metrics}`);

  const map: Record<string, number> = {};
  for (const item of data.data ?? []) {
    map[item.name] = item.values?.[0]?.value ?? 0;
  }

  return {
    reach: map.reach ?? 0,
    views: map.views ?? map.impressions ?? 0,
    replies: map.replies ?? 0,
  };
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
        reach: 0,
        views: 0,
        replies: 0,
        published_at: story.timestamp ?? null,
      };
    }
  });

  return { account, stories: enriched };
}

export const SYNC_SINCE_DEFAULT = "2025-01-01T00:00:00.000Z";

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
