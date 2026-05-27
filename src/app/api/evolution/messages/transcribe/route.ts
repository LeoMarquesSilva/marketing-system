import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  isEvolutionConfigured,
  transcribeWhatsappAudioMessage,
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
      return NextResponse.json(
        { error: "Evolution API não configurada." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const messageId =
      typeof (body as { messageId?: unknown }).messageId === "string"
        ? (body as { messageId: string }).messageId.trim()
        : new URL(request.url).searchParams.get("messageId")?.trim() ?? "";

    if (!messageId) {
      return NextResponse.json({ error: "messageId é obrigatório." }, { status: 400 });
    }

    const transcript = await transcribeWhatsappAudioMessage(messageId);
    return NextResponse.json({ transcript });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao transcrever áudio.";
    console.error("[evolution/messages/transcribe]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
