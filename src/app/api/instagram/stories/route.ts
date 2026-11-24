import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchInstagramStories } from "@/lib/instagram-stories";
import { sanitizeInstagramStoryForClient } from "@/lib/instagram-thumbnail-client";

export const dynamic = "force-dynamic";

/**
 * Stories gravados no banco. A coleta na Meta é do cron (a cada 4 h); abrir a
 * tela não chama mais a Meta ao vivo.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const stories = await fetchInstagramStories();
    return NextResponse.json({
      success: true,
      stories: stories.map((s) => sanitizeInstagramStoryForClient({ ...s, id: s.ig_story_id })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar stories.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
