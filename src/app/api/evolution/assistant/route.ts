import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { after, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { OPENAI_DEFAULT_MODEL, openAIGenerationOptions } from "@/lib/openai-models";
import { openAIKey } from "@/lib/openai-keys";
import { loadAssistantContext, saveAssistantSuggestion } from "@/lib/whatsapp-assistant";

export const dynamic = "force-dynamic";
// Áudios sem transcrição são transcritos antes de sugerir.
export const maxDuration = 60;

interface AssistantRequestBody {
  conversationId?: unknown;
  draftMessage?: unknown;
  replyTo?: {
    body?: unknown;
  } | null;
}

const SYSTEM_PROMPT = `Você ajuda a equipe do escritório Bismarchi | Pires Sociedade de Advogados a responder leads e clientes pelo WhatsApp comercial.
Sugira a próxima mensagem que o atendente vai enviar, com base na conversa inteira. Os áudios aparecem transcritos.

Regras:
- Português do Brasil, tom cordial, profissional e direto, como uma pessoa da equipe escreveria no WhatsApp.
- Escreva só a mensagem a ser enviada, sem títulos, aspas, análise ou markdown.
- Use o que o cliente já contou e não repita perguntas já respondidas.
- Não dê parecer jurídico, não prometa resultado e não informe honorários, prazos ou nomes que não estejam na conversa.
- Se faltar informação para encaminhar, faça no máximo duas perguntas objetivas (por exemplo: se é empresa ou pessoa física, o assunto, o porte da empresa, a urgência).
- Com informação suficiente, proponha o próximo passo (conversa com o advogado da área, envio de documentos ou agendamento), sem inventar horários.
- Se houver rascunho do atendente, melhore o rascunho em vez de começar do zero.
- No máximo um emoji, e só se combinar com o tom da conversa.`;

export async function POST(request: Request) {
  const apiKey = openAIKey("atendimento");
  if (!apiKey) {
    return NextResponse.json(
      { error: "O assistente de IA não está disponível agora." },
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

    const context = await loadAssistantContext(conversationId);
    if (!context) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }

    const draftMessage = typeof body.draftMessage === "string" ? body.draftMessage.trim() : "";
    const replyToBody = typeof body.replyTo?.body === "string" ? body.replyTo.body.trim() : "";

    const prompt = `## Quem é
${context.leadSummary || "Sem dados do contato."}

## Conversa completa (${context.messageCount} mensagens)
${context.transcript || "Sem mensagens salvas."}

## Mensagem que o atendente quer responder
${replyToBody || "Nenhuma específica: responder ao momento atual da conversa."}

## Rascunho do atendente
${draftMessage || "Sem rascunho."}

Sugira a próxima mensagem do escritório.`;

    const openai = createOpenAI({ apiKey });
    const { text } = await generateText({
      model: openai(OPENAI_DEFAULT_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      ...openAIGenerationOptions(OPENAI_DEFAULT_MODEL, { reasoningEffort: "none", temperature: 0.4 }),
    });
    const suggestion = text.trim();

    after(async () => {
      try {
        await saveAssistantSuggestion({
          conversationId,
          authId: user.id,
          draft: draftMessage,
          suggestion,
          model: OPENAI_DEFAULT_MODEL,
          messagesInContext: context.messageCount,
        });
      } catch (err) {
        console.error("[evolution/assistant] guardar sugestão:", err);
      }
    });

    return NextResponse.json({ suggestion, transcribedAudios: context.transcribedNow });
  } catch (error) {
    console.error("[evolution/assistant]", error);
    return NextResponse.json(
      { error: "Não foi possível sugerir uma resposta agora." },
      { status: 500 }
    );
  }
}
