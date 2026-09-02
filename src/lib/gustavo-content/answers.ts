import { GustavoContentError } from "@/lib/gustavo-content/errors";

export const SKIPPED_VISION_NOTE =
  "Seguiu sem registrar visão adicional. Usar o ângulo selecionado e a estratégia já definida.";

export function resolveGustavoAnswers(
  answers: unknown,
  options?: { skip?: boolean }
): string[] {
  const cleaned = (Array.isArray(answers) ? answers : []).map((item) =>
    String(item ?? "").trim()
  );

  if (options?.skip) {
    return cleaned.some(Boolean) ? cleaned : [SKIPPED_VISION_NOTE];
  }

  if (cleaned.every((answer) => !answer)) {
    throw new GustavoContentError("Responda pelo menos uma pergunta.", 400);
  }

  return cleaned;
}
