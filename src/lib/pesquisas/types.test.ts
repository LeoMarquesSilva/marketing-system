import { describe, expect, it } from "vitest";
import { templateQuestions } from "./templates";
import {
  OTHER_OPTION_ID,
  blankQuestion,
  questionNumber,
  sanitizeAnswers,
  slugify,
  surveyReadinessIssues,
  tallyQuestion,
  type SurveyQuestion,
} from "./types";

function choice(type: "escolha_unica" | "multipla", extra: Partial<SurveyQuestion> = {}): SurveyQuestion {
  return {
    ...blankQuestion(type),
    id: "q1",
    title: "Onde perde tempo?",
    options: [
      { id: "a", label: "Retrabalho" },
      { id: "b", label: "Sistemas" },
      { id: "c", label: "Prazos" },
    ],
    ...extra,
  };
}

describe("sanitizeAnswers", () => {
  it("cobra pergunta obrigatória e numera sem contar seções", () => {
    const questions = [
      { ...blankQuestion("secao"), id: "s", title: "Seção" },
      { ...blankQuestion("texto_longo"), id: "t", title: "Conte", required: true },
    ];
    expect(sanitizeAnswers(questions, {}).error).toBe("Pergunta 1 é obrigatória.");
    expect(questionNumber(questions, 1)).toBe(1);
  });

  it("descarta opções desconhecidas e respeita o limite da múltipla", () => {
    const question = choice("multipla", { max_choices: 2 });
    expect(sanitizeAnswers([question], { q1: { choices: ["a", "zzz"] } }).answers).toEqual({ q1: { choices: ["a"] } });
    expect(sanitizeAnswers([question], { q1: { choices: ["a", "b", "c"] } }).error).toContain("no máximo 2");
  });

  it('só guarda "Outro" com texto', () => {
    const question = choice("escolha_unica", { allow_other: true });
    expect(sanitizeAnswers([question], { q1: { choices: [OTHER_OPTION_ID], other: "  " } }).answers).toEqual({});
    expect(sanitizeAnswers([question], { q1: { choices: [OTHER_OPTION_ID], other: "Reuniões" } }).answers).toEqual({
      q1: { choices: [OTHER_OPTION_ID], other: "Reuniões" },
    });
  });

  it("recusa nota fora da escala", () => {
    const question = { ...blankQuestion("escala"), id: "n", title: "Nota" };
    expect(sanitizeAnswers([question], { n: { number: 9 } }).error).toContain("fora da escala");
    expect(sanitizeAnswers([question], { n: { number: 4 } }).answers).toEqual({ n: { number: 4 } });
  });
});

describe("tallyQuestion", () => {
  it("conta escolhas sobre quem respondeu a pergunta", () => {
    const result = tallyQuestion(choice("multipla"), [{ q1: { choices: ["a", "b"] } }, { q1: { choices: ["a"] } }, {}]);
    expect(result.kind).toBe("escolha");
    if (result.kind !== "escolha") return;
    expect(result.answered).toBe(2);
    expect(result.options.find((option) => option.id === "a")).toMatchObject({ count: 2, share: 1 });
  });

  it("ordena prioridades por pontos de Borda", () => {
    const question: SurveyQuestion = { ...choice("multipla"), type: "ranking" };
    const result = tallyQuestion(question, [
      { q1: { ranking: ["b", "a", "c"] } },
      { q1: { ranking: ["b", "c"] } },
      { q1: { ranking: ["a"] } },
    ]);
    if (result.kind !== "ranking") throw new Error("tipo errado");
    expect(result.options.map((option) => option.id)).toEqual(["b", "a", "c"]);
    expect(result.options[0]).toMatchObject({ points: 6, first_place: 2, average_position: 1 });
  });

  it("calcula média e distribuição da escala", () => {
    const question = { ...blankQuestion("escala"), id: "n", title: "Nota" };
    const result = tallyQuestion(question, [{ n: { number: 4 } }, { n: { number: 5 } }, { n: { number: 3 } }]);
    if (result.kind !== "escala") throw new Error("tipo errado");
    expect(result.average).toBe(4);
    expect(result.distribution.map((item) => item.count)).toEqual([0, 0, 1, 1, 1]);
  });
});

describe("modelos e edição", () => {
  it("o modelo de planejamento já pode ser aberto", () => {
    const questions = templateQuestions("planejamento");
    expect(surveyReadinessIssues({ title: "PE27", questions })).toEqual([]);
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
  });

  it("gera link sem acento", () => {
    expect(slugify("Planejamento Estratégico 2027: escuta da equipe")).toBe("planejamento-estrategico-2027-escuta-da-equipe");
  });
});
