import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  fetchEvolutionMessageMedia,
  isEvolutionConfigured,
} from "@/lib/evolution-whatsapp";

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

    if (!isEvolutionConfigured()) {
      return NextResponse.json(
        { error: "Evolution API não configurada." },
        { status: 503 }
      );
    }

    const messageId = new URL(request.url).searchParams.get("messageId")?.trim();
    if (!messageId) {
      return NextResponse.json({ error: "messageId é obrigatório." }, { status: 400 });
    }

    const media = await fetchEvolutionMessageMedia(messageId);
    return NextResponse.json(media);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar mídia.";
    console.error("[evolution/messages/media]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
