import { describe, expect, it } from "vitest";
import {
  NPS_QUESTIONS,
  splitLabelEmphasis,
  validateNpsResponsePayload,
} from "@/lib/nps/questions";

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

  it("o motivo é anexado à pergunta de recomendação", () => {
    const reason = NPS_QUESTIONS.find((q) => q.id === "reason");
    expect(reason?.kind).toBe("text");
    if (reason?.kind === "text") expect(reason.attachToPrevious).toBe(true);
  });

  it("a pergunta de inovação não menciona antecipação de necessidades", () => {
    const innovation = NPS_QUESTIONS.find((q) => q.id === "score_innovation");
    expect(innovation?.label).toContain("soluções inovadoras");
    expect(innovation?.label).not.toContain("antecipar");
  });

  it("toda pergunta de escala destaca um termo presente no enunciado", () => {
    for (const q of NPS_QUESTIONS) {
      if (q.kind !== "scale") continue;
      expect(q.emphasis?.length).toBeGreaterThan(0);
      for (const term of q.emphasis ?? []) {
        expect(q.label.toLowerCase()).toContain(term.toLowerCase());
      }
    }
  });

  it("destaca o atributo avaliado, não o verbo 'avalia'", () => {
    const expected: Record<string, string> = {
      score_availability: "disponibilidade",
      score_communication: "comunicação",
      score_innovation: "capacidade",
      score_technical: "competência técnica",
    };
    for (const [id, term] of Object.entries(expected)) {
      const q = NPS_QUESTIONS.find((item) => item.id === id);
      expect(q?.emphasis).toEqual([term]);
    }
    for (const q of NPS_QUESTIONS) {
      expect(q.emphasis ?? []).not.toContain("avalia");
    }
  });
});

describe("splitLabelEmphasis", () => {
  it("devolve o rótulo inteiro quando não há ênfase", () => {
    expect(splitLabelEmphasis("Motivo")).toEqual([{ text: "Motivo", strong: false }]);
  });

  it("marca o termo e preserva o texto original", () => {
    const parts = splitLabelEmphasis("como você avalia a comunicação da equipe?", [
      "comunicação",
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(
      "como você avalia a comunicação da equipe?"
    );
    expect(parts.filter((p) => p.strong).map((p) => p.text)).toEqual(["comunicação"]);
  });

  it("destaca termos com mais de uma palavra", () => {
    const parts = splitLabelEmphasis("avalia a competência técnica do escritório", [
      "competência técnica",
    ]);
    expect(parts.filter((p) => p.strong).map((p) => p.text)).toEqual([
      "competência técnica",
    ]);
  });

  it("ignora diferença de caixa sem alterar o texto exibido", () => {
    const parts = splitLabelEmphasis("Avalia e avalia", ["avalia"]);
    expect(parts.filter((p) => p.strong).map((p) => p.text)).toEqual(["Avalia", "avalia"]);
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
