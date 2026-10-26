import { describe, expect, it } from "vitest";
import {
  areaBand,
  businessDaysToResponse,
  flowStatus,
  repeatOffenders,
  suggestAreaFromDepartment,
  summarizeMonth,
  summarizeYear,
} from "./metrics";
import type { GoodPracticeFeedback } from "./types";

let seq = 0;
function feedback(overrides: Partial<GoodPracticeFeedback>): GoodPracticeFeedback {
  seq += 1;
  return {
    id: `f${seq}`,
    occurred_on: "2026-10-01",
    sent_on: "2026-10-01",
    employee_id: null,
    employee_name: "Pessoa",
    is_team: false,
    manager_employee_id: null,
    manager_name: "Gestor",
    area: "Cível",
    category: "Outros",
    description: "Ocorrência",
    manager_action: null,
    responded_on: null,
    viewed: null,
    viewed_on: null,
    source: "sistema",
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    created_by_name: null,
    photo_count: 0,
    feedz_key: null,
    feedz_sent_at: null,
    feedz_viewed_at: null,
    ...overrides,
  };
}

describe("flowStatus", () => {
  it("segue a ordem da planilha: retorno, depois Feedz", () => {
    expect(flowStatus({ responded_on: "2026-10-02", viewed: false })).toBe("respondido");
    expect(flowStatus({ responded_on: null, viewed: true })).toBe("visualizado");
    expect(flowStatus({ responded_on: null, viewed: false })).toBe("nao_visualizado");
    expect(flowStatus({ responded_on: null, viewed: null })).toBe("sem_dado");
  });
});

describe("businessDaysToResponse", () => {
  it("conta dias úteis como NETWORKDAYS − 1", () => {
    expect(businessDaysToResponse("2026-01-12", "2026-01-12")).toBe(0);
    // sexta → segunda = 1 dia útil
    expect(businessDaysToResponse("2026-10-16", "2026-10-19")).toBe(1);
    // 23/01 (sex) → 08/03 (dom): 30 na planilha
    expect(businessDaysToResponse("2026-01-23", "2026-03-08")).toBe(30);
  });

  it("sem retorno ou retorno antes do envio não conta", () => {
    expect(businessDaysToResponse("2026-10-01", null)).toBeNull();
    expect(businessDaysToResponse("2026-06-06", "2026-03-06")).toBeNull();
  });
});

describe("areaBand", () => {
  it("aplica a regra do Reforço do Manual", () => {
    expect(areaBand(0, 5, 20)).toBeNull();
    expect(areaBand(2, 4, 7)).toBe("monitoramento");
    expect(areaBand(3, 0, 7)).toBe("atencao");
    expect(areaBand(5, 0, 10)).toBe("atencao");
    expect(areaBand(5, 0, 11)).toBe("acionamento");
    expect(areaBand(3, 3, 6)).toBe("acionamento");
  });
});

describe("suggestAreaFromDepartment", () => {
  it("usa a grafia canônica do RH", () => {
    expect(suggestAreaFromDepartment("Contratos")).toBe("Societário e Contratos");
    expect(suggestAreaFromDepartment("Insolvência")).toBe("Reestruturação");
    expect(suggestAreaFromDepartment("Distressed Deals")).toBe("ADD");
    expect(suggestAreaFromDepartment("Sócio")).toBeNull();
  });
});

describe("summarizeMonth", () => {
  const items = [
    feedback({ sent_on: "2026-10-01", area: "Reestruturação", manager_name: "Ana", responded_on: "2026-10-02" }),
    feedback({ sent_on: "2026-10-09", area: "Reestruturação", manager_name: "Ana" }),
    feedback({ sent_on: "2026-10-20", area: "Comercial", manager_name: "Ricardo", viewed: true }),
    feedback({ sent_on: "2026-09-10", area: "Reestruturação" }),
    feedback({ sent_on: "2026-09-11", area: "Cível" }),
  ];

  it("resume o mês com comparação ao anterior", () => {
    const summary = summarizeMonth(items, { year: 2026, month: 10 });
    expect(summary.total).toBe(3);
    expect(summary.previousTotal).toBe(2);
    expect(summary.areasWithFeedback).toBe(2);
    expect(summary.topArea).toEqual({ area: "Reestruturação", sent: 2 });
    expect(summary.viewedBase).toBe(1);
    expect(summary.responded).toBe(1);
    expect(summary.respondedFast).toBe(1);
    expect(summary.band).toBe("monitoramento");
    expect(summary.leaders[0]).toMatchObject({ manager: "Ana", sent: 2, responded: 1, noData: 2 });
    expect(summary.weeks.map((week) => week.sent)).toEqual([1, 1, 1, 0, 0]);
    expect(summary.weeks[4].label).toBe("S5 · 29–31");
  });

  it("sem dado de visualização no mês vira s/d por área", () => {
    const summary = summarizeMonth(items, { year: 2026, month: 9 });
    expect(summary.viewedBase).toBe(0);
    expect(summary.areas.find((row) => row.area === "Cível")?.viewed).toBeNull();
  });
});

describe("summarizeYear e reincidência", () => {
  const items = [
    feedback({ sent_on: "2026-01-05", area: "Cível", employee_id: "e1", employee_name: "Giancarlo", category: "Estacionamento indevido" }),
    feedback({ sent_on: "2026-05-05", area: "Cível", employee_id: "e1", employee_name: "Giancarlo", category: "Estacionamento indevido", responded_on: "2026-05-06" }),
    feedback({ sent_on: "2026-05-07", area: "Cível", employee_name: "Equipe Cível", is_team: true }),
    feedback({ sent_on: "2026-05-07", area: "Cível", employee_name: "Equipe Cível", is_team: true }),
    feedback({ sent_on: "2025-12-30", area: "Trabalhista" }),
  ];

  it("monta a matriz área × mês do ano", () => {
    const year = summarizeYear(items, 2026);
    expect(year.total).toBe(4);
    expect(year.rows).toHaveLength(1);
    expect(year.rows[0].months[4]).toBe(3);
    expect(year.respondedByMonth[4]).toBe(1);
  });

  it("lista quem recebeu 2+ e ignora equipes", () => {
    const repeats = repeatOffenders(items, 2026);
    expect(repeats).toHaveLength(1);
    expect(repeats[0]).toMatchObject({ name: "Giancarlo", count: 2, lastSentOn: "2026-05-05", topCategory: "Estacionamento indevido" });
  });
});
