import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchWhatsappMessages } from "@/lib/evolution-whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface AssistantRequestBody {
  conversationId?: unknown;
  draftMessage?: unknown;
  replyTo?: {
    body?: unknown;
  } | null;
}

interface WhatsappConversationContext {
  id: string;
  phone: string | null;
  push_name: string | null;
  last_message_preview: string | null;
  lead_source: string | null;
  tags: string[] | null;
  meta_campaign_name?: string | null;
  meta_adset_name?: string | null;
  meta_ad_title?: string | null;
}

interface WhatsappMessageContext {
  from_me: boolean;
  body: string | null;
  message_type?: string | null;
  message_timestamp: string;
}

function getOpenAiKey() {
  return (
    process.env.NEXT_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    ""
  );
}

function buildConversationContext({
  conversation,
  messages,
  draftMessage,
  replyToBody,
}: {
  conversation: WhatsappConversationContext;
  messages: WhatsappMessageContext[];
  draftMessage: string;
  replyToBody: string;
}) {
  const history = messages
    .slice(-30)
    .map((message) => {
      const author = message.from_me ? "Atendente" : "Lead";
      const text = message.body?.trim() || `[${message.message_type || "mensagem sem texto"}]`;
      const time = new Date(message.message_timestamp).toLocaleString("pt-BR");
      return `${time} - ${author}: ${text}`;
    })
    .join("\n");

  return `
## Lead
Nome: ${conversation.push_name || "Não informado"}
Telefone: ${conversation.phone || "Não informado"}
Origem: ${conversation.lead_source || "WhatsApp"}
Campanha: ${conversation.meta_campaign_name || conversation.meta_adset_name || "Não identificada"}
Anúncio: ${conversation.meta_ad_title || "Não identificado"}
Tags: ${(conversation.tags ?? []).join(", ") || "Sem tags"}
Última prévia: ${conversation.last_message_preview || "Sem prévia"}

## Mensagem em resposta
${replyToBody || "Nenhuma mensagem específica selecionada."}

## Rascunho atual do atendente
${draftMessage || "Sem rascunho."}

## Histórico recente
${history || "Sem histórico salvo."}
`;
}

export async function POST(request: Request) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "NEXT_OPENAI_API_KEY ou OPENAI_API_KEY não configurada." },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as AssistantRequestBody;
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : "";

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório." },
        { status: 400 }
      );
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("whatsapp_conversations")
      .select(
        "id, phone, push_name, last_message_preview, lead_source, tags, meta_campaign_name, meta_adset_name, meta_ad_title"
      )
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationError) throw conversationError;
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 }
      );
    }

    const messages = (await fetchWhatsappMessages(conversationId)) as WhatsappMessageContext[];
    const draftMessage = typeof body.draftMessage === "string" ? body.draftMessage : "";
    const replyToBody =
      typeof body.replyTo?.body === "string" ? body.replyTo.body : "";

    const context = buildConversationContext({
      conversation: conversation as WhatsappConversationContext,
      messages,
      draftMessage,
      replyToBody,
    });

    const openai = createOpenAI({ apiKey });
    const { text } = await generateText({
      model: openai("gpt-4.1-mini"),
      system: `Você é um assistente de atendimento comercial via WhatsApp para um CRM.

Seu objetivo é sugerir a próxima resposta do atendente com base no contexto real da conversa.

Regras:
- Responda sempre em português brasileiro.
- Escreva apenas a mensagem que será enviada ao lead, sem títulos, análise ou markdown.
- Seja claro, profissional, humano e objetivo.
- Não invente dados, preços, horários ou promessas.
- Se faltar informação, faça uma pergunta curta para avançar a qualificação.
- Preserve o tom consultivo e educado.
- Não use emojis em excesso; use no máximo um emoji se fizer sentido.
- Não envie a mensagem, apenas sugira o texto.`,
      prompt: `${context}\n\nSugira a melhor próxima mensagem para o atendente enviar agora.`,
      temperature: 0.4,
    });

    return NextResponse.json({ suggestion: text.trim() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao gerar sugestão com IA.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
