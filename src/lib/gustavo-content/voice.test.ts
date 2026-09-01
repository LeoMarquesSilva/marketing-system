import { describe, expect, it } from "vitest";
import { excerptVoice, validateVoiceInput } from "@/lib/gustavo-content/voice";

describe("excerptVoice", () => {
  it("devolve o texto curto intacto", () => {
    expect(excerptVoice("Abertura direta.")).toBe("Abertura direta.");
  });

  it("corta trecho longo sem quebrar no meio da palavra quando possível", () => {
    const text = "O processo compra tempo. Não compra uma reestruturação completa da empresa.";
    const excerpt = excerptVoice(text, 40);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(42);
  });
});

describe("validateVoiceInput", () => {
  it("exige o texto original", () => {
    expect(() => validateVoiceInput({ original_text: "  " })).toThrow(/texto/i);
  });

  it("rejeita tipo e autenticidade inválidos", () => {
    expect(() =>
      validateVoiceInput({ original_text: "Texto", source_type: "twitter" })
    ).toThrow(/tipo/i);
    expect(() =>
      validateVoiceInput({ original_text: "Texto", authenticity: "gpt" })
    ).toThrow(/autentic/i);
  });

  it("normaliza cadastro manual", () => {
    const parsed = validateVoiceInput({
      original_text: "  O processo compra tempo.  ",
      source_url: " https://linkedin.com/in/x ",
      source_type: "linkedin",
      authenticity: "gustavo_original",
      published_at: "2026-03-10",
    });
    expect(parsed.original_text).toBe("O processo compra tempo.");
    expect(parsed.source_url).toBe("https://linkedin.com/in/x");
    expect(parsed.source_type).toBe("linkedin");
    expect(parsed.authenticity).toBe("gustavo_original");
    expect(parsed.is_active).toBe(true);
  });
});
