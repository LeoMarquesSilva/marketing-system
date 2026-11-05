/**
 * Erros da OpenAI que a equipe consegue resolver ou esperar: falta de crédito
 * (a conta precisa de recarga) e excesso de pedidos. O resto vira o texto
 * genérico de quem chamou, sem mensagem técnica em inglês.
 */

function errorText(err: unknown): string {
  if (!err || typeof err !== "object") return String(err ?? "");
  const e = err as { message?: unknown; responseBody?: unknown; lastError?: unknown; cause?: unknown };
  return [e.message, e.responseBody, e.lastError && errorText(e.lastError), e.cause && errorText(e.cause)]
    .filter((part) => typeof part === "string" && part)
    .join(" ")
    .toLowerCase();
}

export function isOpenAIOutOfCredits(err: unknown): boolean {
  const text = errorText(err);
  return /no credits remaining|insufficient_quota|exceeded your current quota|billing/.test(text);
}

function isOpenAIRateLimited(err: unknown): boolean {
  return /rate limit|too many requests/.test(errorText(err));
}

export const OPENAI_OUT_OF_CREDITS_MESSAGE =
  "A IA está sem créditos na OpenAI. Peça ao administrador para recarregar a conta.";

export function openAIErrorMessage(err: unknown, fallback: string): string {
  if (isOpenAIOutOfCredits(err)) return OPENAI_OUT_OF_CREDITS_MESSAGE;
  if (isOpenAIRateLimited(err)) return "Muitos pedidos à IA agora. Tente de novo em instantes.";
  return fallback;
}
