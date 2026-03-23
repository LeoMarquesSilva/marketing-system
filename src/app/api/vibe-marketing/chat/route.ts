import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const apiKey = process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "NEXT_OPENAI_API_KEY não configurada." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const openai = createOpenAI({ apiKey });

  try {
    const body = await req.json();
    const { messages, context } = body as {
      messages: UIMessage[];
      context?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages é obrigatório." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um copywriter especialista em marketing digital e criação de conteúdo para redes sociais. 

Sua função é criar copy persuasivo: posts engajadores, hooks que prendem atenção, headlines, CTAs e aplicação de frameworks (AIDA, PAS, BAB, StoryBrand). Foque em conversão e engajamento.

${context ? `\n## Dados de pesquisa (use como referência para criar conteúdo):\n\n${context}\n\nUse esses dados para inspirar e fundamentar suas sugestões.` : ""}

Responda em português brasileiro. Seja conciso e prático.`;

    const result = streamText({
      model: openai("gpt-4.1-mini"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao processar chat.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
