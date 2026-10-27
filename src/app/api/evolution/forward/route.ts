import { after, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isEvolutionConfigured } from "@/lib/evolution-whatsapp";
import { appUserIdForAuth } from "@/lib/whatsapp-attendance";
import {
  fetchForwardRecipients,
  fetchLeadForwards,
  sendLeadForward,
  tagTeamConversation,
} from "@/lib/whatsapp-lead-forward";

export const dynamic = "force-dynamic";

/** Quem pode receber o lead e os encaminhamentos anteriores da conversa. */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const conversationId = new URL(request.url).searchParams.get("conversationId") ?? "";
    const [recipients, forwards] = await Promise.all([
      fetchForwardRecipients(),
      conversationId ? fetchLeadForwards(conversationId) : Promise.resolve([]),
    ]);
    return NextResponse.json({ recipients, forwards });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar a equipe.";
    console.error("[evolution/forward] GET", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Envia o resumo e o cartão de contato do lead pelo WhatsApp do escritório. */
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
      return NextResponse.json({ error: "Evolution API não configurada." }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId é obrigatório." }, { status: 400 });
    }

    const sentBy = await appUserIdForAuth(user.id);
    const result = await sendLeadForward({
      conversationId,
      recipientUserId: typeof body.recipientUserId === "string" ? body.recipientUserId : null,
      recipientPhone: typeof body.recipientPhone === "string" ? body.recipientPhone : null,
      message: typeof body.message === "string" ? body.message : "",
      includeContact: body.includeContact !== false,
      sentBy,
    });

    after(async () => {
      try {
        await tagTeamConversation(result.recipientPhone);
      } catch (err) {
        console.error("[evolution/forward] marcar conversa da equipe:", err);
      }
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível encaminhar o lead.";
    console.error("[evolution/forward]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
