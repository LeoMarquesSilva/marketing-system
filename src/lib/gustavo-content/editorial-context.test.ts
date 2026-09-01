import { describe, expect, it } from "vitest";
import { sourceTextForGeneration } from "@/lib/gustavo-content/editorial-context";

describe("sourceTextForGeneration", () => {
  it("usa a matéria preservada em vez do resumo curto", () => {
    expect(
      sourceTextForGeneration({
        contentSnippet: "Resumo curto do RSS.",
        sourceContext: {
          facts: [],
          numbers: [],
          companies: [],
          dates: [],
          sourceUrls: [],
          articleText: "Texto completo e confiável extraído da matéria.",
        },
      })
    ).toBe("Texto completo e confiável extraído da matéria.");
  });

  it("mantém o resumo como fallback quando a extração não existe", () => {
    expect(
      sourceTextForGeneration({
        contentSnippet: "Resumo disponível.",
        sourceContext: null,
      })
    ).toBe("Resumo disponível.");
  });
});
