import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  resolveWhatsappMessageMedia,
  WhatsappMediaUnavailableError,
} from "@/lib/evolution-whatsapp";

export const dynamic = "force-dynamic";
/** Mídia antiga ainda sem arquivo espera a Edge Function guardar (vídeo pode demorar). */
export const maxDuration = 60;

/**
 * Devolve `{ url, mimetype }` (URL assinada do Storage) ou, se a mídia não pôde
 * ser guardada, `{ base64, mimetype }` direto da Evolution, como antes.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const messageId = new URL(request.url).searchParams.get("messageId")?.trim();
    if (!messageId) {
      return NextResponse.json({ error: "messageId é obrigatório." }, { status: 400 });
    }

    const media = await resolveWhatsappMessageMedia(messageId);
    return NextResponse.json(media);
  } catch (err) {
    if (err instanceof WhatsappMediaUnavailableError) {
      return NextResponse.json({ error: err.message, code: "media_expired" }, { status: 410 });
    }
    const msg = err instanceof Error ? err.message : "Erro ao buscar mídia.";
    console.error("[evolution/messages/media]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
