import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { syncStories } from "@/lib/instagram-meta";
import {
  fetchInstagramStories,
  upsertInstagramStories,
} from "@/lib/instagram-stories";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    let liveCount = 0;
    let syncWarning: string | null = null;

    // Coleta os stories ativos (24h) e persiste; se falhar, ainda retornamos o histórico.
    try {
      const result = await syncStories();
      liveCount = result.stories.length;
      await upsertInstagramStories(result.stories);
    } catch (syncErr) {
      syncWarning =
        syncErr instanceof Error ? syncErr.message : "Falha ao coletar stories ativos.";
    }

    const stories = await fetchInstagramStories();

    return NextResponse.json({
      success: true,
      liveCount,
      syncWarning,
      stories: stories.map((s) => ({
        id: s.ig_story_id,
        media_type: s.media_type ?? undefined,
        media_url: s.media_url ?? undefined,
        thumbnail_url: s.thumbnail_url ?? undefined,
        permalink: s.permalink ?? undefined,
        published_at: s.published_at,
        reach: s.reach,
        views: s.views,
        replies: s.replies,
        shares: s.shares,
        total_interactions: s.total_interactions,
        follows: s.follows,
        profile_visits: s.profile_visits,
        nav_taps_forward: s.nav_taps_forward,
        nav_taps_back: s.nav_taps_back,
        nav_exits: s.nav_exits,
        nav_swipe_forward: s.nav_swipe_forward,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar stories.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
