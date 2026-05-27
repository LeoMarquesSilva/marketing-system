import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  fetchWhatsappConversations,
  fetchWhatsappMessages,
  fetchWhatsappTagSuggestions,
  fetchWhatsappUnreadSummary,
  isEvolutionConfigured,
  markConversationRead,
  normalizeWhatsappTags,
  refreshConversationAvatar,
  refreshConversationPushName,
  refreshMissingConversationAvatars,
  syncConversationMessages,
  updateWhatsappConversationCrm,
  updateWhatsappConversationTags,
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

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const tagSuggestions = searchParams.get("tagSuggestions");
    const unreadSummary = searchParams.get("unreadSummary");

    if (unreadSummary === "1") {
      const summary = await fetchWhatsappUnreadSummary();
      return NextResponse.json(summary);
    }

    if (tagSuggestions === "1") {
      const suggestions = await fetchWhatsappTagSuggestions();
      return NextResponse.json({ suggestions });
    }

    if (conversationId) {
      const markReadOnly = searchParams.get("markReadOnly") === "1";
      if (markReadOnly) {
        await markConversationRead(conversationId);
        return NextResponse.json({ ok: true });
      }

      const syncOnly = searchParams.get("syncOnly") === "1";
      const refreshAvatar = searchParams.get("refreshAvatar") === "1";
      const syncHistory = searchParams.get("syncHistory") !== "0";

      if (syncHistory && isEvolutionConfigured()) {
        try {
          await syncConversationMessages(conversationId, { limit: 150 });
        } catch (syncErr) {
          console.error("[evolution/conversations] sync history:", syncErr);
        }
      }

      const [avatarUrl, pushName] = syncOnly
        ? [null, null]
        : await Promise.all([
            refreshAvatar ? refreshConversationAvatar(conversationId) : Promise.resolve(null),
            refreshConversationPushName(conversationId),
          ]);

      const messages = await fetchWhatsappMessages(conversationId);
      await markConversationRead(conversationId);

      const { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

      return NextResponse.json({ messages, avatarUrl, pushName, conversation });
    }

    const conversations = await fetchWhatsappConversations();
    void refreshMissingConversationAvatars(8);
    return NextResponse.json({
      configured: isEvolutionConfigured(),
      conversations,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar conversas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId =
      typeof (body as { conversationId?: unknown }).conversationId === "string"
        ? (body as { conversationId: string }).conversationId
        : "";

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório." },
        { status: 400 }
      );
    }

    const hasTags = "tags" in (body as object);
    const hasCrmFields =
      "city" in (body as object) ||
      "state" in (body as object) ||
      "owner_user_id" in (body as object) ||
      "pipeline_stage" in (body as object) ||
      "qualification" in (body as object) ||
      "notes" in (body as object);

    if (!hasTags && !hasCrmFields) {
      return NextResponse.json(
        { error: "Informe tags ou campos de CRM para atualização." },
        { status: 400 }
      );
    }

    let conversation = hasTags
      ? await updateWhatsappConversationTags(
          conversationId,
          normalizeWhatsappTags((body as { tags: unknown }).tags)
        )
      : null;

    if (hasCrmFields) {
      conversation = await updateWhatsappConversationCrm(conversationId, {
        city:
          typeof (body as { city?: unknown }).city === "string"
            ? (body as { city: string }).city.trim() || null
            : undefined,
        state:
          typeof (body as { state?: unknown }).state === "string"
            ? (body as { state: string }).state.trim() || null
            : undefined,
        owner_user_id:
          typeof (body as { owner_user_id?: unknown }).owner_user_id === "string"
            ? (body as { owner_user_id: string }).owner_user_id.trim() || null
            : undefined,
        pipeline_stage:
          typeof (body as { pipeline_stage?: unknown }).pipeline_stage === "string"
            ? (body as { pipeline_stage: string }).pipeline_stage.trim() || null
            : undefined,
        qualification:
          (body as { qualification?: unknown }).qualification &&
          typeof (body as { qualification?: unknown }).qualification === "object"
            ? ((body as { qualification: Record<string, unknown> }).qualification ?? null)
            : undefined,
        notes:
          typeof (body as { notes?: unknown }).notes === "string"
            ? (body as { notes: string }).notes.trim() || null
            : undefined,
      });
    }

    return NextResponse.json({ ok: true, conversation });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar tags.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
