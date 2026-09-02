import { describe, expect, it } from "vitest";
import { resolveGustavoAnswers, SKIPPED_VISION_NOTE } from "@/lib/gustavo-content/answers";

describe("resolveGustavoAnswers", () => {
  it("exige pelo menos uma resposta quando não é skip", () => {
    expect(() => resolveGustavoAnswers(["", "  "])).toThrow("Responda pelo menos uma pergunta.");
    expect(() => resolveGustavoAnswers(null)).toThrow("Responda pelo menos uma pergunta.");
  });

  it("mantém as respostas preenchidas", () => {
    expect(resolveGustavoAnswers(["  liquidez  ", ""])).toEqual(["liquidez", ""]);
  });

  it("permite seguir sem visão e registra o motivo", () => {
    expect(resolveGustavoAnswers([], { skip: true })).toEqual([SKIPPED_VISION_NOTE]);
  });

  it("se pular mas já houver texto, preserva o texto", () => {
    expect(resolveGustavoAnswers(["usar o ângulo"], { skip: true })).toEqual(["usar o ângulo"]);
  });
});
