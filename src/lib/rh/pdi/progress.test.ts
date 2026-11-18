import { describe, expect, it } from "vitest";
import {
  addMonths,
  averageProgress,
  countKinds,
  daysBetween,
  dueLabel,
  isActionOverdue,
  isStale,
  planDueState,
  planProgress,
} from "./progress";

describe("planProgress (igual ao Feedz)", () => {
  const actions = (goal: string, values: number[]) => values.map((progress) => ({ goal_id: goal, progress }));
  it("frentes de mesmo tamanho: 66 e 95 → 80", () => {
    expect(planProgress([...actions("a", [100, 0, 100]), ...actions("b", [100, 100, 85])])).toBe(80);
  });
  it("cada frente pesa igual, mesmo com quantidades diferentes de ações", () => {
    // Média simples das 5 ações daria 60; pela média das frentes (100 e 33) dá 66.
    expect(planProgress([...actions("a", [100, 100]), ...actions("b", [100, 0, 0])])).toBe(66);
  });
  it("trunca o percentual de cada frente antes da média", () => {
    // Frentes 63,3 → 63 e 83,3 → 83: (63 + 83) / 2 = 73
    expect(planProgress([...actions("a", [90, 100, 0]), ...actions("b", [100, 100, 50])])).toBe(73);
  });
  it("sem ações é zero", () => {
    expect(planProgress([])).toBe(0);
  });
});

describe("averageProgress", () => {
  it("trunca a média como o Feedz (80,8 → 80)", () => {
    expect(averageProgress([100, 0, 100, 100, 100, 85])).toBe(80);
  });
  it("frente com 2 de 3 concluídas e uma em 85% → 95", () => {
    expect(averageProgress([100, 100, 85])).toBe(95);
  });
  it("sem ações é zero e valores fora da faixa são limitados", () => {
    expect(averageProgress([])).toBe(0);
    expect(averageProgress([150, -10])).toBe(50);
  });
});

describe("planDueState", () => {
  const today = "2026-11-16";
  it("atrasado quando o prazo passou", () => {
    expect(planDueState({ status: "ativo", due_date: "2026-11-15" }, today)).toBe("atrasado");
  });
  it("vence em breve até 15 dias", () => {
    expect(planDueState({ status: "ativo", due_date: "2026-12-01" }, today)).toBe("vence_em_breve");
    expect(planDueState({ status: "ativo", due_date: "2026-12-02" }, today)).toBe("em_dia");
  });
  it("concluído e cancelado ignoram o prazo", () => {
    expect(planDueState({ status: "concluido", due_date: "2020-01-01" }, today)).toBe("concluido");
    expect(planDueState({ status: "cancelado", due_date: "2020-01-01" }, today)).toBe("cancelado");
  });
});

describe("isActionOverdue", () => {
  it("só conta ação com prazo vencido e incompleta", () => {
    expect(isActionOverdue({ due_date: "2026-11-10", progress: 50 }, "2026-11-16")).toBe(true);
    expect(isActionOverdue({ due_date: "2026-11-10", progress: 100 }, "2026-11-16")).toBe(false);
    expect(isActionOverdue({ due_date: null, progress: 0 }, "2026-11-16")).toBe(false);
  });
});

describe("isStale", () => {
  it("plano ativo sem atualização há mais de 30 dias", () => {
    expect(isStale({ status: "ativo", last_update_at: "2026-10-01T10:00:00Z", start_date: "2026-01-01" }, "2026-11-16")).toBe(true);
    expect(isStale({ status: "ativo", last_update_at: "2026-11-01T10:00:00Z", start_date: "2026-01-01" }, "2026-11-16")).toBe(false);
    expect(isStale({ status: "concluido", last_update_at: null, start_date: "2020-01-01" }, "2026-11-16")).toBe(false);
  });
});

describe("datas", () => {
  it("dias entre datas", () => {
    expect(daysBetween("2026-11-16", "2026-11-30")).toBe(14);
    expect(daysBetween("2026-11-16", "2026-11-13")).toBe(-3);
  });
  it("rótulo do prazo", () => {
    expect(dueLabel(14, "ativo")).toBe("Faltam 14 dias");
    expect(dueLabel(0, "ativo")).toBe("Vence hoje");
    expect(dueLabel(-3, "ativo")).toBe("Atrasado 3 dias");
    expect(dueLabel(-3, "concluido")).toBe("Concluído");
  });
  it("soma meses segurando o fim do mês", () => {
    expect(addMonths("2026-01-22", 10)).toBe("2026-11-22");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-16", 3)).toBe("2027-02-16");
  });
});

describe("countKinds", () => {
  it("conta 70-20-10 e ações sem tipo", () => {
    expect(countKinds([{ learning_kind: "pratica" }, { learning_kind: "troca" }, { learning_kind: null }])).toEqual({
      pratica: 1,
      troca: 1,
      formal: 0,
      sem: 1,
    });
  });
});
