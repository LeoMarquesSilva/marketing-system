import { createClient } from "@supabase/supabase-js";
import type { MetaAccountStats } from "./instagram-meta";
import { detectPostTagsFromCaption, mergePostTags } from "./instagram-post-tags";
import { normalizePostAssignments } from "./instagram-link-rules";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface PostSolicitante {
  id: string;
  name: string;
}

export interface InstagramPost {
  id: string;
  ig_media_id: string;
  caption: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
  area: string | null;
  areas: string[];
  solicitante_id: string | null;
  solicitante: string | null;
  solicitantes: PostSolicitante[];
  skip_participants: boolean;
  tags: string[];
  likes: number;
  comments: number;
  reach: number;
  views: number;
  saves: number;
  shares: number;
  total_interactions: number;
  media_product_type: string | null;
  follows: number;
  profile_visits: number;
  reposts: number;
  profile_activity: number;
  link_clicks: number;
  reels_avg_watch_time: number;
  reels_total_watch_time: number;
  synced_at: string;
  created_at: string;
}

export interface InstagramAccountStats {
  id: string;
  username: string;
  followers_count: number;
  media_count: number;
  profile_picture_url: string | null;
  biography: string | null;
  website: string | null;
  follows_count: number | null;
  name: string | null;
  fetched_at: string;
}

export async function fetchInstagramPosts(filters?: {
  area?: string;
  media_type?: string;
  solicitante_id?: string;
  from?: string;
  to?: string;
}): Promise<InstagramPost[]> {
  const supabase = getServiceClient();
  let query = supabase
    .from("instagram_posts")
    .select("*")
    .gte("published_at", "2025-01-01T00:00:00.000Z")
    .order("published_at", { ascending: false });

  if (filters?.area) query = query.eq("area", filters.area);
  if (filters?.media_type) query = query.eq("media_type", filters.media_type);
  if (filters?.solicitante_id) query = query.eq("solicitante_id", filters.solicitante_id);
  if (filters?.from) query = query.gte("published_at", filters.from);
  if (filters?.to) query = query.lte("published_at", filters.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapInstagramPostRow);
}

function parseSolicitantes(raw: unknown): PostSolicitante[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const { id, name } = item as { id?: string; name?: string };
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((s): s is PostSolicitante => s !== null);
}

export function mapInstagramPostRow(row: Record<string, unknown>): InstagramPost {
  const post = row as unknown as InstagramPost;
  return {
    ...post,
    areas: (post.areas ?? []) as string[],
    solicitantes: parseSolicitantes(post.solicitantes),
    skip_participants: Boolean(post.skip_participants),
    tags: (post.tags ?? []) as string[],
    follows: post.follows ?? 0,
    profile_visits: post.profile_visits ?? 0,
    reposts: post.reposts ?? 0,
    profile_activity: post.profile_activity ?? 0,
    link_clicks: post.link_clicks ?? 0,
    reels_avg_watch_time: post.reels_avg_watch_time ?? 0,
    reels_total_watch_time: post.reels_total_watch_time ?? 0,
    media_product_type: post.media_product_type ?? null,
  };
}

export async function fetchLatestAccountStats(): Promise<InstagramAccountStats | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("instagram_account_stats")
    .select("*")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as InstagramAccountStats | null;
}

export async function fetchAccountStatsHistory(
  limit = 365
): Promise<InstagramAccountStats[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("instagram_account_stats")
    .select("*")
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as InstagramAccountStats[]).reverse();
}

export async function upsertAccountStats(account: MetaAccountStats): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from("instagram_account_stats").insert({
    username: account.username,
    followers_count: account.followers_count,
    media_count: account.media_count,
    profile_picture_url: account.profile_picture_url ?? null,
    biography: account.biography ?? null,
    website: account.website ?? null,
    follows_count: account.follows_count ?? null,
    name: account.name ?? null,
  });
  if (error) throw new Error(error.message);
}

type SyncPost = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  published_at: string | null;
  likes: number;
  comments: number;
  reach: number;
  views: number;
  saves: number;
  shares: number;
  total_interactions: number;
  follows?: number;
  profile_visits?: number;
  reposts?: number;
  profile_activity?: number;
  link_clicks?: number;
  reels_avg_watch_time?: number;
  reels_total_watch_time?: number;
};

export async function upsertInstagramPosts(posts: SyncPost[]): Promise<number> {
  if (posts.length === 0) return 0;

  const supabase = getServiceClient();
  const mediaIds = posts.map((p) => p.id);

  const { data: existingRows } = await supabase
    .from("instagram_posts")
    .select(
      "ig_media_id, area, areas, solicitante_id, solicitante, solicitantes, skip_participants, tags"
    )
    .in("ig_media_id", mediaIds);

  const existingMap = new Map(
    (existingRows ?? []).map((r) => [
      r.ig_media_id as string,
      {
        area: r.area as string | null,
        areas: (r.areas as string[] | null) ?? [],
        solicitante_id: r.solicitante_id as string | null,
        solicitante: r.solicitante as string | null,
        solicitantes: parseSolicitantes(r.solicitantes),
        skip_participants: Boolean(r.skip_participants),
        tags: (r.tags as string[] | null) ?? [],
      },
    ])
  );

  const rows = posts.map((post) => {
    const existing = existingMap.get(post.id);
    const autoTags = detectPostTagsFromCaption(post.caption);
    const tags = mergePostTags(autoTags, existing?.tags);

    return {
      ig_media_id: post.id,
      caption: post.caption ?? null,
      media_type: post.media_type ?? null,
      media_url: post.media_url ?? null,
      thumbnail_url: post.thumbnail_url ?? null,
      permalink: post.permalink ?? null,
      published_at: post.published_at,
      area: existing?.area ?? null,
      areas: existing?.areas?.length ? existing.areas : existing?.area ? [existing.area] : [],
      solicitante_id: existing?.solicitante_id ?? null,
      solicitante: existing?.solicitante ?? null,
      solicitantes: existing?.solicitantes?.length
        ? existing.solicitantes
        : existing?.solicitante_id
          ? [{ id: existing.solicitante_id, name: existing.solicitante ?? "" }]
          : [],
      skip_participants: existing?.skip_participants ?? false,
      tags,
      likes: post.likes,
      comments: post.comments,
      reach: post.reach,
      views: post.views,
      saves: post.saves,
      shares: post.shares,
      total_interactions: post.total_interactions,
      media_product_type: post.media_product_type ?? null,
      follows: post.follows ?? 0,
      profile_visits: post.profile_visits ?? 0,
      reposts: post.reposts ?? 0,
      profile_activity: post.profile_activity ?? 0,
      link_clicks: post.link_clicks ?? 0,
      reels_avg_watch_time: post.reels_avg_watch_time ?? 0,
      reels_total_watch_time: post.reels_total_watch_time ?? 0,
      synced_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("instagram_posts")
    .upsert(rows, { onConflict: "ig_media_id" });

  if (error) throw new Error(error.message);
  return rows.length;
}

/** Reaplica detecção automática de tags em todos os posts sincronizados */
export async function refreshAllInstagramPostTags(): Promise<number> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("instagram_posts")
    .select("id, caption, tags")
    .gte("published_at", "2025-01-01T00:00:00.000Z");

  if (error) throw new Error(error.message);
  if (!data?.length) return 0;

  let updated = 0;
  for (const row of data) {
    const autoTags = detectPostTagsFromCaption(row.caption as string | null);
    const tags = mergePostTags(autoTags, row.tags as string[] | null);
    const prev = (row.tags as string[] | null) ?? [];
    const sortedNew = [...tags].sort().join("|");
    const sortedPrev = [...prev].sort().join("|");
    if (sortedNew === sortedPrev) continue;

    const { error: updateError } = await supabase
      .from("instagram_posts")
      .update({ tags })
      .eq("id", row.id);

    if (updateError) throw new Error(updateError.message);
    updated++;
  }

  return updated;
}

export async function updatePostAssignments(
  postId: string,
  assignments: {
    area?: string | null;
    areas?: string[] | null;
    solicitante_id?: string | null;
    solicitante?: string | null;
    solicitantes?: PostSolicitante[] | null;
    skip_participants?: boolean;
  }
): Promise<void> {
  const supabase = getServiceClient();
  const hasArrayUpdate =
    assignments.areas !== undefined || assignments.solicitantes !== undefined;

  if (hasArrayUpdate) {
    const normalized = normalizePostAssignments({
      areas: assignments.areas ?? undefined,
      solicitantes: assignments.solicitantes ?? undefined,
      skip_participants: assignments.skip_participants,
    });

    const payload: Record<string, unknown> = {
      areas: normalized.areas,
      solicitantes: normalized.solicitantes,
      area: normalized.area,
      solicitante_id: normalized.solicitante_id,
      solicitante: normalized.solicitante,
    };

    if (normalized.skip_participants !== undefined) {
      payload.skip_participants = normalized.skip_participants;
    }

    const { error } = await supabase
      .from("instagram_posts")
      .update(payload)
      .eq("id", postId);

    if (error) throw new Error(error.message);
    return;
  }

  const updates: Record<string, string | string[] | boolean | null> = {};

  if (assignments.area !== undefined) {
    const area = assignments.area?.trim() || null;
    updates.area = area;
    updates.areas = area ? [area] : [];
  }
  if (assignments.solicitante_id !== undefined) {
    updates.solicitante_id = assignments.solicitante_id || null;
  }
  if (assignments.solicitante !== undefined) {
    updates.solicitante = assignments.solicitante?.trim() || null;
  }
  if (assignments.skip_participants !== undefined) {
    updates.skip_participants = assignments.skip_participants;
  }

  const { error } = await supabase
    .from("instagram_posts")
    .update(updates)
    .eq("id", postId);

  if (error) throw new Error(error.message);
}

/** @deprecated Use updatePostAssignments */
export async function updatePostArea(
  postId: string,
  area: string | null
): Promise<void> {
  return updatePostAssignments(postId, { area });
}

export async function lookupPostMediaUrls(igMediaId: string): Promise<{
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
} | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("instagram_posts")
    .select("media_type, media_url, thumbnail_url")
    .eq("ig_media_id", igMediaId)
    .maybeSingle();

  if (!data) return null;
  return {
    media_type: (data.media_type as string | null) ?? null,
    media_url: (data.media_url as string | null) ?? null,
    thumbnail_url: (data.thumbnail_url as string | null) ?? null,
  };
}

export async function updateInstagramPostMediaUrls(
  igMediaId: string,
  urls: { media_url: string | null; thumbnail_url: string | null }
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("instagram_posts")
    .update({
      media_url: urls.media_url,
      thumbnail_url: urls.thumbnail_url,
    })
    .eq("ig_media_id", igMediaId);

  if (error) throw new Error(error.message);
}
