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
    .select("ig_story_id, reach, views, replies, first_synced_at, thumbnail_url, media_url, permalink")
    .in("ig_story_id", storyIds);

  const existingMap = new Map(
    (existingRows ?? []).map((r) => [r.ig_story_id as string, r])
  );

  const now = new Date().toISOString();

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
      reach: Math.max(story.reach ?? 0, (existing?.reach as number) ?? 0),
      views: Math.max(story.views ?? 0, (existing?.views as number) ?? 0),
      replies: Math.max(story.replies ?? 0, (existing?.replies as number) ?? 0),
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
