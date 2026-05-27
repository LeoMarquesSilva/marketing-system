import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isEvolutionConfigured, sendEvolutionPresence } from "@/lib/evolution-whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!isEvolutionConfigured()) {
      return NextResponse.json({ ok: true });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId =
      typeof (body as { conversationId?: unknown }).conversationId === "string"
        ? (body as { conversationId: string }).conversationId
        : "";
    const presence = (body as { presence?: unknown }).presence;

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId é obrigatório." }, { status: 400 });
    }

    if (
      presence === "composing" ||
      presence === "recording" ||
      presence === "paused" ||
      presence === "available"
    ) {
      await sendEvolutionPresence(conversationId, presence);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar presença.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
