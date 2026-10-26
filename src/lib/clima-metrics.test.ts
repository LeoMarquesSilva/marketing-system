import { describe, expect, it } from "vitest";
import { INDICADORES, PLANOS_ACAO } from "./clima-mock-data";
import {
  attentionStatements,
  favorability,
  focusThemes,
  overallSummary,
  resolveResponsibles,
  summarizeThemes,
  todosForTheme,
} from "./clima-metrics";

describe("favorability", () => {
  it("agrupa as cinco respostas em três faixas", () => {
    expect(favorability([0, 2.2, 6.7, 44.4, 46.7])).toEqual({
      favorable: expect.closeTo(91.1, 1),
      neutral: expect.closeTo(6.7, 1),
      unfavorable: expect.closeTo(2.2, 1),
    });
  });

  it("normaliza quando a soma não fecha 100", () => {
    expect(favorability([0, 0, 0, 1, 1]).favorable).toBe(100);
    expect(favorability([0, 0, 0, 0, 0]).favorable).toBe(0);
  });
});

describe("dados do Clima", () => {
  it("cobre as 46 afirmações do board em 12 temas", () => {
    const themes = summarizeThemes(INDICADORES);
    expect(themes).toHaveLength(12);
    expect(themes.reduce((n, t) => n + t.statements.length, 0)).toBe(46);
    expect(themes.every((t) => t.statements.length > 0)).toBe(true);
  });

  it("calcula o índice geral e quantas afirmações passam de 70%", () => {
    const overall = overallSummary(INDICADORES);
    expect(Math.round(overall.favorable)).toBe(76);
    expect(overall.aboveTarget).toBe(32);
    expect(overall.total).toBe(46);
  });

  it("aponta os temas abaixo de 70% do pior para o melhor", () => {
    const focos = focusThemes(summarizeThemes(INDICADORES)).map((t) => t.theme.id);
    expect(focos).toEqual(["remuneracao", "meritocracia", "equilibrio", "reconhecimento"]);
  });

  it("coloca PLR como a afirmação menos favorável", () => {
    expect(attentionStatements(INDICADORES)[0].id).toBe("q2");
  });

  it("liga todo foco a pelo menos um plano", () => {
    for (const foco of focusThemes(summarizeThemes(INDICADORES))) {
      expect(PLANOS_ACAO.some((p) => p.themeIds?.includes(foco.theme.id))).toBe(true);
    }
  });
});

describe("todosForTheme", () => {
  it("considera tarefas ligadas ao tema ou a um plano do tema", () => {
    const todos = [
      { id: "1", title: "a", status: "pendente", priority: "normal", indicatorId: "remuneracao", createdAt: "" },
      { id: "2", title: "b", status: "pendente", priority: "normal", actionPlanId: "ap5", createdAt: "" },
      { id: "3", title: "c", status: "pendente", priority: "normal", actionPlanId: "ap2", createdAt: "" },
    ] as const;
    expect(todosForTheme("remuneracao", PLANOS_ACAO, [...todos]).map((t) => t.id)).toEqual(["1", "2"]);
  });
});

describe("resolveResponsibles", () => {
  const users = [
    { name: "Caroline Souza", avatar_url: "c.png" },
    { name: "Midian Alves", avatar_url: null },
    { name: "Gabriel Lima", avatar_url: "g1.png" },
    { name: "Gabriel Rocha", avatar_url: "g2.png" },
  ];

  it("separa nomes quando todos batem com um usuário", () => {
    expect(resolveResponsibles("Caroline e Midian", users)).toEqual([
      { name: "Caroline Souza", avatarUrl: "c.png", kind: "pessoa" },
      { name: "Midian Alves", avatarUrl: null, kind: "pessoa" },
    ]);
  });

  it("mantém grupos e nomes ambíguos como texto", () => {
    expect(resolveResponsibles("Gente e Gestão", users)).toEqual([
      { name: "Gente e Gestão", avatarUrl: null, kind: "grupo" },
    ]);
    expect(resolveResponsibles("Gabriel", users)).toEqual([
      { name: "Gabriel", avatarUrl: null, kind: "pessoa" },
    ]);
    expect(resolveResponsibles("Gestores", users)[0].kind).toBe("grupo");
  });
});
