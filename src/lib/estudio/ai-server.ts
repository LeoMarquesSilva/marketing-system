// Só roda nas rotas /api/estudio (lê a chave da OpenAI do ambiente do servidor).
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { OPENAI_DEFAULT_MODEL, openAIGenerationOptions } from "@/lib/openai-models";
import { STUDIO_AI_SYSTEM_PROMPT, pieceAiSchema } from "./ai";
import type { PieceKind, StudioTemplateDef } from "./types";

export function studioAiKey(): string | null {
  return process.env.NEXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || null;
}

/** Uma chamada à IA do Estúdio: devolve os slides crus (ainda sem normalizar), a legenda e o resumo. */
export async function runStudioAi(input: {
  apiKey: string;
  kind: PieceKind;
  templates: StudioTemplateDef[];
  prompt: string;
  extraSystem?: string;
}) {
  const modelId = process.env.OPENAI_STUDIO_MODEL?.trim() || OPENAI_DEFAULT_MODEL;
  const result = await generateObject({
    model: createOpenAI({ apiKey: input.apiKey })(modelId),
    schema: pieceAiSchema(input.templates, input.kind),
    schemaName: "peca_do_estudio",
    system: input.extraSystem ? `${STUDIO_AI_SYSTEM_PROMPT}\n\n${input.extraSystem}` : STUDIO_AI_SYSTEM_PROMPT,
    prompt: input.prompt,
    ...openAIGenerationOptions(modelId, { reasoningEffort: "low", temperature: 0.3 }),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(55_000),
  });
  return result.object as { slides: unknown[]; legenda: string; resumo: string };
}
