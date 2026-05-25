import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { refreshAllInstagramPostTags } from "@/lib/instagram-posts";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const updated = await refreshAllInstagramPostTags();
    return NextResponse.json({ success: true, updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar tags.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
