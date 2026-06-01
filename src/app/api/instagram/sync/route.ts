import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  SYNC_SINCE_DEFAULT,
  syncMediaPage,
  syncAccountExtras,
} from "@/lib/instagram-meta";
import { upsertAccountStats, upsertInstagramPosts } from "@/lib/instagram-posts";
import { upsertAccountInsights } from "@/lib/instagram-account-insights";
import { replaceAudienceDemographics } from "@/lib/instagram-demographics";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const since = (body.since as string | undefined) || SYNC_SINCE_DEFAULT;
    const after = (body.after as string | undefined) || undefined;

    const result = await syncMediaPage(since, after);

    let accountExtras: { insights: number; demographics: number } | null = null;
    if (!after) {
      await upsertAccountStats(result.account);
      // Insights de conta + demografia só na primeira página do sync.
      try {
        const extras = await syncAccountExtras();
        await upsertAccountStats(extras.account);
        const [insights, demographics] = await Promise.all([
          upsertAccountInsights(extras.insights),
          replaceAudienceDemographics(extras.demographics),
        ]);
        accountExtras = { insights, demographics };
      } catch {
        // coleta de extras é best-effort; não derruba o sync de posts
      }
    }

    const synced = await upsertInstagramPosts(
      result.posts.map((p) => ({
        id: p.id,
        caption: p.caption,
        media_type: p.media_type,
        media_product_type: p.media_product_type,
        media_url: p.media_url,
        thumbnail_url: p.thumbnail_url,
        permalink: p.permalink,
        published_at: p.published_at,
        likes: p.likes,
        comments: p.comments,
        reach: p.reach,
        views: p.views,
        saves: p.saves,
        shares: p.shares,
        total_interactions: p.total_interactions,
        follows: p.follows,
        profile_visits: p.profile_visits,
        reposts: p.reposts,
        profile_activity: p.profile_activity,
        link_clicks: p.link_clicks,
        reels_avg_watch_time: p.reels_avg_watch_time,
        reels_total_watch_time: p.reels_total_watch_time,
      }))
    );

    return NextResponse.json({
      success: true,
      synced,
      accountExtras,
      since,
      nextAfter: result.nextAfter ?? null,
      hasMore: result.hasMore,
      reachedCutoff: result.reachedCutoff,
      account: {
        username: result.account.username,
        followers_count: result.account.followers_count,
        media_count: result.account.media_count,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar Instagram.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
