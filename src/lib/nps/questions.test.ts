import { describe, expect, it } from "vitest";
import { NPS_QUESTIONS, validateNpsResponsePayload } from "@/lib/nps/questions";

describe("NPS_QUESTIONS", () => {
  it("tem 7 perguntas na ordem correta", () => {
    expect(NPS_QUESTIONS).toHaveLength(7);
    expect(NPS_QUESTIONS.map((q) => q.id)).toEqual([
      "score_recommend",
      "reason",
      "score_availability",
      "score_communication",
      "score_innovation",
      "score_technical",
      "improvement",
    ]);
  });

  it("escalas são obrigatórias e textos opcionais", () => {
    for (const q of NPS_QUESTIONS) {
      if (q.kind === "scale") expect(q.required).toBe(true);
      else expect(q.required).toBe(false);
    }
  });
});

describe("validateNpsResponsePayload", () => {
  const validId = "11111111-1111-1111-1111-111111111111";

  it("rejeita payload vazio", () => {
    const result = validateNpsResponsePayload(null);
    expect(result.ok).toBe(false);
  });

  it("exige respondente", () => {
    const result = validateNpsResponsePayload({
      score_recommend: 10,
      score_availability: 9,
      score_communication: 8,
      score_innovation: 7,
      score_technical: 9,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/respondendo/i);
  });

  it("exige todas as notas 0–10", () => {
    const result = validateNpsResponsePayload({
      respondentKind: "contact",
      respondentId: validId,
      score_recommend: 10,
      score_availability: 11,
      score_communication: 8,
      score_innovation: 7,
      score_technical: 9,
    });
    expect(result.ok).toBe(false);
  });

  it("aceita payload válido e sanitiza textos", () => {
    const result = validateNpsResponsePayload({
      respondentKind: "person",
      respondentId: validId,
      score_recommend: 9,
      reason: "  ótimo atendimento  ",
      score_availability: 8,
      score_communication: 9,
      score_innovation: 7,
      score_technical: 10,
      improvement: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.respondentKind).toBe("person");
      expect(result.data.reason).toBe("ótimo atendimento");
      expect(result.data.improvement).toBeNull();
      expect(result.data.score_recommend).toBe(9);
    }
  });
});
