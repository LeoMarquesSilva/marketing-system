import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  isEvolutionConfigured,
  sendEvolutionAudioMessage,
  sendEvolutionReaction,
  sendEvolutionTextMessage,
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
    const conversationId =
      typeof (body as { conversationId?: unknown }).conversationId === "string"
        ? (body as { conversationId: string }).conversationId
        : "";
    const text =
      typeof (body as { text?: unknown }).text === "string"
        ? (body as { text: string }).text
        : "";
    const audioBase64 =
      typeof (body as { audioBase64?: unknown }).audioBase64 === "string"
        ? (body as { audioBase64: string }).audioBase64
        : "";
    const reaction =
      typeof (body as { reaction?: unknown }).reaction === "string"
        ? (body as { reaction: string }).reaction
        : "";
    const waMessageId =
      typeof (body as { waMessageId?: unknown }).waMessageId === "string"
        ? (body as { waMessageId: string }).waMessageId
        : "";

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório." },
        { status: 400 }
      );
    }

    if (reaction && waMessageId) {
      await sendEvolutionReaction(conversationId, waMessageId, reaction);
      return NextResponse.json({ ok: true });
    }

    if (audioBase64) {
      const message = await sendEvolutionAudioMessage(conversationId, audioBase64);
      return NextResponse.json({ ok: true, message });
    }

    const quotedWaMessageId =
      typeof (body as { quotedWaMessageId?: unknown }).quotedWaMessageId === "string"
        ? (body as { quotedWaMessageId: string }).quotedWaMessageId
        : undefined;
    const quotedBody =
      typeof (body as { quotedBody?: unknown }).quotedBody === "string"
        ? (body as { quotedBody: string }).quotedBody
        : undefined;

    const mediaType = (body as { mediaType?: unknown }).mediaType;
    const mediaBase64 =
      typeof (body as { mediaBase64?: unknown }).mediaBase64 === "string"
        ? (body as { mediaBase64: string }).mediaBase64
        : "";
    const fileName =
      typeof (body as { fileName?: unknown }).fileName === "string"
        ? (body as { fileName: string }).fileName
        : undefined;
    const caption =
      typeof (body as { caption?: unknown }).caption === "string"
        ? (body as { caption: string }).caption
        : undefined;

    if (
      mediaBase64 &&
      (mediaType === "image" || mediaType === "video" || mediaType === "document")
    ) {
      const { sendEvolutionMediaMessage } = await import("@/lib/evolution-whatsapp");
      const message = await sendEvolutionMediaMessage(conversationId, {
        mediatype: mediaType,
        mediaBase64,
        fileName,
        caption,
        quotedWaMessageId,
        quotedBody,
      });
      return NextResponse.json({ ok: true, message });
    }

    const message = await sendEvolutionTextMessage(conversationId, text, {
      quotedWaMessageId,
      quotedBody,
    });
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar mensagem.";
    console.error("[evolution/messages]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
