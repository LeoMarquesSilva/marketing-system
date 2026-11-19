import { after, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  isEvolutionConfigured,
  sendEvolutionContactMessage,
  sendEvolutionTextMessage,
  type WhatsappMessage,
} from "@/lib/evolution-whatsapp";
import { appUserIdForAuth, assignWhatsappConversationIfUnowned } from "@/lib/whatsapp-attendance";
import { RECEPTION_CONTACT, RECEPTION_CONTACT_ID } from "@/lib/whatsapp-team-contacts";
import { fetchTeamDirectory } from "@/lib/whatsapp-team-directory";

export const dynamic = "force-dynamic";

async function currentAuthId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Recepção e equipe que o atendimento pode passar ao cliente. */
export async function GET() {
  try {
    if (!(await currentAuthId())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const team = await fetchTeamDirectory();
    return NextResponse.json({ team, reception: RECEPTION_CONTACT });
  } catch (err) {
    console.error("[evolution/contacts GET]", err);
    return NextResponse.json({ error: "Não foi possível carregar os contatos da equipe." }, { status: 500 });
  }
}

/**
 * Manda ao cliente o contato da recepção ou de alguém da equipe: o texto (com o
 * e-mail, se for o caso) e, se pedido, o cartão do WhatsApp. O telefone do
 * cartão sai do servidor, nunca do navegador.
 */
export async function POST(request: Request) {
  try {
    const authId = await currentAuthId();
    if (!authId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (!isEvolutionConfigured()) {
      return NextResponse.json({ error: "Evolution API não configurada." }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    const contactId = typeof body.contactId === "string" ? body.contactId : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const sendCard = body.sendCard === true;
    if (!conversationId || !contactId) {
      return NextResponse.json({ error: "Escolha a conversa e o contato." }, { status: 400 });
    }
    if (!text && !sendCard) {
      return NextResponse.json({ error: "Escreva a mensagem ou marque o cartão." }, { status: 400 });
    }

    let card: { fullName: string; phone: string } | null = null;
    if (contactId === RECEPTION_CONTACT_ID) {
      card = { fullName: RECEPTION_CONTACT.name, phone: RECEPTION_CONTACT.phone };
    } else {
      const person = (await fetchTeamDirectory()).find((contact) => contact.id === contactId);
      if (!person) return NextResponse.json({ error: "Pessoa não encontrada na equipe." }, { status: 404 });
      card = person.cardPhone ? { fullName: person.name, phone: person.cardPhone } : null;
    }
    if (sendCard && !card) {
      return NextResponse.json(
        { error: "Essa pessoa não liberou o WhatsApp no perfil; mande só o e-mail." },
        { status: 400 }
      );
    }

    const messages: WhatsappMessage[] = [];
    if (text) messages.push(await sendEvolutionTextMessage(conversationId, text));
    if (sendCard && card) messages.push(await sendEvolutionContactMessage(conversationId, card));

    after(async () => {
      try {
        const userId = await appUserIdForAuth(authId);
        if (userId) await assignWhatsappConversationIfUnowned(conversationId, userId);
      } catch (err) {
        console.error("[evolution/contacts] atribuir responsável:", err);
      }
    });

    return NextResponse.json({ ok: true, messages });
  } catch (err) {
    console.error("[evolution/contacts POST]", err);
    const msg = err instanceof Error && err.message ? err.message : "Não foi possível enviar o contato.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
