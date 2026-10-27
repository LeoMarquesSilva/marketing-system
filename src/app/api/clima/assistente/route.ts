import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { OPENAI_DEFAULT_MODEL, openAIGenerationOptions } from "@/lib/openai-models";
import { openAIKey } from "@/lib/openai-keys";

export const maxDuration = 30;

const CLIMA_SYSTEM_PROMPT = `Você é um assistente especializado em clima organizacional e pesquisa de engajamento. 
Você tem acesso aos dados de uma pesquisa de clima realizada no escritório (45 respostas), com afirmações do Trust Index do GPTW agrupadas em dimensões e temas. Para cada tema e afirmação há o % favorável (Concordo + Concordo totalmente), neutro e desfavorável. A referência é 70% favorável (nota mínima de certificação do GPTW); neutro acima de 25% costuma indicar falta de clareza ou de comunicação. Sua função é ajudar a equipe de clima a:
- Identificar temas e afirmações críticos e priorizar ações
- Sugerir planos de ação baseados nos percentuais e nas ações já sugeridas pela equipe
- Resumir dados e gerar insights acionáveis

Responda sempre em português brasileiro. Seja conciso e prático. Use os dados fornecidos como contexto.`;

function buildContext(indicadores: unknown, planos: unknown): string {
  return `
## Dimensões, temas e afirmações da pesquisa (percentuais)
${JSON.stringify(indicadores, null, 2)}

## Planos de ação 5W2H já mapeados
${JSON.stringify(planos, null, 2)}
`;
}

export async function POST(req: Request) {
  const apiKey = openAIKey("pessoas");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY_PESSOAS não configurada." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const openai = createOpenAI({ apiKey });

  try {
    await requireAuthenticatedUser();
    const body = await req.json();
    const { messages, indicadores, planosAcao } = body as {
      messages: UIMessage[];
      indicadores?: unknown;
      planosAcao?: unknown;
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages é obrigatório." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const context =
      indicadores && planosAcao
        ? buildContext(indicadores, planosAcao)
        : "";

    const systemPrompt = `${CLIMA_SYSTEM_PROMPT}
${context ? `\n## Dados da pesquisa (use como referência):\n${context}` : ""}`;

    const result = streamText({
      model: openai(OPENAI_DEFAULT_MODEL),
      system: systemPrompt,
      messages: await convertToModelMessages(messages as UIMessage[]),
      ...openAIGenerationOptions(OPENAI_DEFAULT_MODEL, { reasoningEffort: "none" }),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof Error && error.message === "Não autenticado.") {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const message =
      error instanceof Error ? error.message : "Erro ao processar chat.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
