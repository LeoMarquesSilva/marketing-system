import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchInstagramPosts, mapInstagramPostRow } from "@/lib/instagram-posts";
import {
  fetchImportedIgMediaIds,
  importInstagramPostsToPlanner,
} from "@/lib/instagram-planner-import";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const area = searchParams.get("area") ?? undefined;

    const [posts, importedIds] = await Promise.all([
      fetchInstagramPosts({ from, to, area }),
      fetchImportedIgMediaIds(),
    ]);

    return NextResponse.json({
      posts: posts.map((post) => ({
        ...post,
        already_imported: importedIds.has(post.ig_media_id),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar posts do Instagram.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = (await request.json()) as { ig_media_ids?: string[] };
    const ids = body.ig_media_ids?.filter(Boolean) ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Informe ao menos um post." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id, name")
      .eq("auth_id", user.id)
      .maybeSingle();

    const { data: rows, error: fetchErr } = await supabase
      .from("instagram_posts")
      .select("*")
      .in("ig_media_id", ids);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const posts = (rows ?? []).map((row) => mapInstagramPostRow(row as Record<string, unknown>));
    const result = await importInstagramPostsToPlanner(posts, {
      id: profile?.id ?? null,
      name: profile?.name ?? user.email ?? null,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao importar posts.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
