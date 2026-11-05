import { describe, expect, it } from "vitest";
import { OPENAI_OUT_OF_CREDITS_MESSAGE, isOpenAIOutOfCredits, openAIErrorMessage } from "./openai-errors";

describe("erros da OpenAI", () => {
  it("reconhece falta de crédito, também dentro do erro de novas tentativas", () => {
    const retry = Object.assign(new Error("Failed after 3 attempts."), {
      lastError: new Error("You have no credits remaining. Add credits to continue using the API."),
    });
    expect(isOpenAIOutOfCredits(retry)).toBe(true);
    expect(openAIErrorMessage(retry, "x")).toBe(OPENAI_OUT_OF_CREDITS_MESSAGE);
    expect(isOpenAIOutOfCredits({ responseBody: '{"error":{"code":"insufficient_quota"}}' })).toBe(true);
  });

  it("avisa excesso de pedidos e cai no texto padrão para o resto", () => {
    expect(openAIErrorMessage(new Error("Rate limit reached for requests"), "x")).toMatch(/Tente de novo/);
    expect(openAIErrorMessage(new Error("socket hang up"), "Não foi possível.")).toBe("Não foi possível.");
  });
});
