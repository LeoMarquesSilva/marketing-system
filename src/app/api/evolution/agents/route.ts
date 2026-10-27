import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { appUserIdForAuth, fetchWhatsappAgents } from "@/lib/whatsapp-attendance";

export const dynamic = "force-dynamic";

/** Pessoas que podem ser responsáveis por uma conversa, e quem está logado. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const me = await appUserIdForAuth(user.id);
    const agents = await fetchWhatsappAgents(me);
    return NextResponse.json({ agents, me });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar responsáveis.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
