import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { OPENAI_DEFAULT_MODEL, openAIGenerationOptions } from "@/lib/openai-models";
import { openAIKey } from "@/lib/openai-keys";
import { loadAssistantContext } from "@/lib/whatsapp-assistant";

export const dynamic = "force-dynamic";
// Áudios sem transcrição são transcritos antes de resumir.
export const maxDuration = 60;

const SYSTEM_PROMPT = `Você resume conversas de leads do WhatsApp comercial do escritório Bismarchi | Pires Sociedade de Advogados para o gestor ou advogado que vai assumir o contato.

Regras:
- Português do Brasil, direto, em no máximo 6 tópicos curtos, cada um começando com "- ".
- Diga quem é (pessoa física ou empresa, ramo, porte e cidade, se aparecerem), o que a pessoa precisa, os fatos importantes, a urgência e em que pé está o atendimento (o que já foi combinado e o próximo passo).
- Use só o que está na conversa e nos dados do lead. Não invente, não dê parecer jurídico e não avalie o caso.
- Não repita nome, telefone nem origem: eles já vão no cabeçalho da mensagem.
- Sem títulos, negrito ou outro markdown além dos tópicos.
- Se a conversa ainda não tiver informação suficiente, diga isso em um tópico.`;

/** Resumo do lead para encaminhar a alguém da equipe. */
export async function POST(request: Request) {
  const apiKey = openAIKey("atendimento");
  if (!apiKey) {
    return NextResponse.json({ error: "O resumo com IA não está disponível agora." }, { status: 500 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { conversationId?: unknown };
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId é obrigatório." }, { status: 400 });
    }

    const context = await loadAssistantContext(conversationId);
    if (!context) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }

    const openai = createOpenAI({ apiKey });
    const { text } = await generateText({
      model: openai(OPENAI_DEFAULT_MODEL),
      system: SYSTEM_PROMPT,
      prompt: `## Dados do lead
${context.leadSummary || "Sem dados do contato."}

## Conversa completa (${context.messageCount} mensagens)
${context.transcript || "Sem mensagens salvas."}

Resuma para quem vai assumir este lead.`,
      ...openAIGenerationOptions(OPENAI_DEFAULT_MODEL, { reasoningEffort: "none", temperature: 0.2 }),
    });

    return NextResponse.json({ summary: text.trim(), transcribedAudios: context.transcribedNow });
  } catch (error) {
    console.error("[evolution/forward/summary]", error);
    return NextResponse.json({ error: "Não foi possível montar o resumo agora." }, { status: 500 });
  }
}
