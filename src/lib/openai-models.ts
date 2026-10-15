/**
 * Modelo padrão da OpenAI para tarefas de volume: classificar, conversar e
 * escrever textos curtos. Substitui gpt-4.1-mini e gpt-4.1, desligados pela
 * OpenAI em 14/01/2027. OPENAI_DEFAULT_MODEL troca o modelo sem mexer no código.
 */
export const OPENAI_DEFAULT_MODEL =
  process.env.OPENAI_DEFAULT_MODEL?.trim() || "gpt-6-luna";

export type OpenAIReasoningEffort = "none" | "low" | "medium" | "high";

/** Série o e GPT-5 em diante raciocinam antes de responder; os "-chat" não. */
export function isOpenAIReasoningModel(modelId: string): boolean {
  if (/^o\d+(?:-|$)/.test(modelId)) return true;
  const major = Number(/^gpt-(\d+)/.exec(modelId)?.[1] ?? 0);
  return major >= 5 && !modelId.includes("-chat");
}

/**
 * Modelos de raciocínio recusam temperature e, sem esforço explícito, raciocinam
 * em "medium" (mais lento). Devolve só o parâmetro que o modelo aceita.
 */
export function openAIGenerationOptions(
  modelId: string,
  options: { reasoningEffort: OpenAIReasoningEffort; temperature?: number }
) {
  return isOpenAIReasoningModel(modelId)
    ? { providerOptions: { openai: { reasoningEffort: options.reasoningEffort } } }
    : { temperature: options.temperature };
}
