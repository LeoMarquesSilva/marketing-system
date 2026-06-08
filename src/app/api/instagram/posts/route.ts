import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchInstagramPosts, fetchLatestAccountStats } from "@/lib/instagram-posts";
import { sanitizeInstagramPostsForClient } from "@/lib/instagram-thumbnail-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const area = searchParams.get("area") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const [posts, accountStats] = await Promise.all([
      fetchInstagramPosts({ area, from, to }),
      fetchLatestAccountStats(),
    ]);

    return NextResponse.json({
      posts: sanitizeInstagramPostsForClient(posts),
      accountStats,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar posts.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
