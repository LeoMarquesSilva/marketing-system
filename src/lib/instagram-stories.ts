import { createClient } from "@supabase/supabase-js";
import type { SyncedStoryPost } from "./instagram-meta";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface InstagramStory {
  id: string;
  ig_story_id: string;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
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
  first_synced_at: string;
  last_synced_at: string;
  created_at: string;
}

export async function fetchInstagramStories(): Promise<InstagramStory[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("instagram_stories")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as InstagramStory[];
}

/**
 * Persiste/atualiza stories coletados. Como as métricas crescem dentro das 24h
 * e a API pode devolver 0 após a expiração, mantemos o maior valor já visto
 * para não perder histórico.
 */
export async function upsertInstagramStories(
  stories: SyncedStoryPost[]
): Promise<number> {
  if (stories.length === 0) return 0;

  const supabase = getServiceClient();
  const storyIds = stories.map((s) => s.id);

  const { data: existingRows } = await supabase
    .from("instagram_stories")
    .select(
      "ig_story_id, reach, views, replies, shares, total_interactions, follows, profile_visits, nav_taps_forward, nav_taps_back, nav_exits, nav_swipe_forward, first_synced_at, thumbnail_url, media_url, permalink"
    )
    .in("ig_story_id", storyIds);

  const existingMap = new Map(
    (existingRows ?? []).map((r) => [r.ig_story_id as string, r])
  );

  const now = new Date().toISOString();
  const keepMax = (next: number | undefined, prev: unknown) =>
    Math.max(next ?? 0, (prev as number) ?? 0);

  const rows = stories.map((story) => {
    const existing = existingMap.get(story.id);
    return {
      ig_story_id: story.id,
      media_type: story.media_type ?? null,
      // Mantém URL antiga se a nova vier vazia (CDN do story expira rápido).
      media_url: story.media_url ?? existing?.media_url ?? null,
      thumbnail_url: story.thumbnail_url ?? existing?.thumbnail_url ?? null,
      permalink: story.permalink ?? existing?.permalink ?? null,
      published_at: story.published_at,
      reach: keepMax(story.reach, existing?.reach),
      views: keepMax(story.views, existing?.views),
      replies: keepMax(story.replies, existing?.replies),
      shares: keepMax(story.shares, existing?.shares),
      total_interactions: keepMax(story.total_interactions, existing?.total_interactions),
      follows: keepMax(story.follows, existing?.follows),
      profile_visits: keepMax(story.profile_visits, existing?.profile_visits),
      nav_taps_forward: keepMax(story.nav_taps_forward, existing?.nav_taps_forward),
      nav_taps_back: keepMax(story.nav_taps_back, existing?.nav_taps_back),
      nav_exits: keepMax(story.nav_exits, existing?.nav_exits),
      nav_swipe_forward: keepMax(story.nav_swipe_forward, existing?.nav_swipe_forward),
      first_synced_at: (existing?.first_synced_at as string) ?? now,
      last_synced_at: now,
    };
  });

  const { error } = await supabase
    .from("instagram_stories")
    .upsert(rows, { onConflict: "ig_story_id" });

  if (error) throw new Error(error.message);
  return rows.length;
}

export async function lookupStoryMediaUrls(igStoryId: string): Promise<{
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
} | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("instagram_stories")
    .select("media_type, media_url, thumbnail_url")
    .eq("ig_story_id", igStoryId)
    .maybeSingle();

  if (!data) return null;
  return {
    media_type: (data.media_type as string | null) ?? null,
    media_url: (data.media_url as string | null) ?? null,
    thumbnail_url: (data.thumbnail_url as string | null) ?? null,
  };
}

export async function updateInstagramStoryMediaUrls(
  igStoryId: string,
  urls: { media_url: string | null; thumbnail_url: string | null }
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("instagram_stories")
    .update({
      media_url: urls.media_url,
      thumbnail_url: urls.thumbnail_url,
    })
    .eq("ig_story_id", igStoryId);

  if (error) throw new Error(error.message);
}
