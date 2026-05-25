import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SYNC_SINCE_DEFAULT, syncMediaPage } from "@/lib/instagram-meta";
import { upsertAccountStats, upsertInstagramPosts } from "@/lib/instagram-posts";

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

    if (!after) {
      await upsertAccountStats(result.account);
    }

    const synced = await upsertInstagramPosts(
      result.posts.map((p) => ({
        id: p.id,
        caption: p.caption,
        media_type: p.media_type,
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
      }))
    );

    return NextResponse.json({
      success: true,
      synced,
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
