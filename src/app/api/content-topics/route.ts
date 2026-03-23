import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchContentTopics } from "@/lib/content-topics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const topics = await fetchContentTopics(false);
    return NextResponse.json(topics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar temas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
