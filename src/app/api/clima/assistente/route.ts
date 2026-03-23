import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const maxDuration = 30;

const CLIMA_SYSTEM_PROMPT = `Você é um assistente especializado em clima organizacional e pesquisa de engajamento. 
Você tem acesso aos dados de uma pesquisa de clima realizada no escritório. Sua função é ajudar a equipe de clima a:
- Identificar indicadores críticos e priorizar ações
- Sugerir planos de ação baseados nos scores e insatisfações
- Resumir dados e gerar insights acionáveis

Responda sempre em português brasileiro. Seja conciso e prático. Use os dados fornecidos como contexto.`;

function buildContext(indicadores: unknown, planos: unknown): string {
  return `
## Indicadores da pesquisa (resumo)
${JSON.stringify(indicadores, null, 2)}

## Planos de ação 5W2H já mapeados
${JSON.stringify(planos, null, 2)}
`;
}

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
      model: openai("gpt-4.1-mini"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages as UIMessage[]),
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
