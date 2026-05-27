import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  isEvolutionConfigured,
  markEvolutionMessageAsPlayed,
} from "@/lib/evolution-whatsapp";

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
    const messageId =
      typeof (body as { messageId?: unknown }).messageId === "string"
        ? (body as { messageId: string }).messageId.trim()
        : "";

    if (!messageId) {
      return NextResponse.json({ error: "messageId é obrigatório." }, { status: 400 });
    }

    await markEvolutionMessageAsPlayed(messageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao marcar áudio.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
