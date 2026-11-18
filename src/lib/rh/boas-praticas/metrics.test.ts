import { describe, expect, it } from "vitest";
import {
  areaBand,
  areaCountsInMonth,
  businessDaysToResponse,
  canonicalFeedbackArea,
  flowStatus,
  repeatOffenders,
  pivotCountsByMonth,
  suggestAreaFromDepartment,
  summarizeArea,
  summarizeAreasPivot,
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
    subtopic: null,
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

describe("canonicalFeedbackArea", () => {
  it("põe as áreas de apoio em Operações Legais, como em Férias", () => {
    for (const area of ["Marketing", "Comercial", "Financeiro", "Facilities", "RH", "Operações Legais"]) {
      expect(canonicalFeedbackArea(area)).toBe("Operações Legais");
    }
    expect(canonicalFeedbackArea("Insolvência")).toBe("Reestruturação");
    expect(canonicalFeedbackArea("Distressed Deals")).toBe("ADD");
    expect(canonicalFeedbackArea("Cível")).toBe("Cível");
    expect(canonicalFeedbackArea("Gestores")).toBe("Gestores");
  });
});

describe("suggestAreaFromDepartment", () => {
  it("usa a grafia canônica do RH", () => {
    expect(suggestAreaFromDepartment("Contratos")).toBe("Societário e Contratos");
    expect(suggestAreaFromDepartment("Insolvência")).toBe("Reestruturação");
    expect(suggestAreaFromDepartment("Distressed Deals")).toBeNull();
    expect(suggestAreaFromDepartment("Sócio")).toBeNull();
  });
});

describe("summarizeMonth", () => {
  const items = [
    feedback({ sent_on: "2026-10-01", area: "Reestruturação", manager_name: "Ana", responded_on: "2026-10-02" }),
    feedback({ sent_on: "2026-10-09", area: "Reestruturação", manager_name: "Ana" }),
    feedback({ sent_on: "2026-10-20", area: "Operações Legais", manager_name: "Ricardo", viewed: true }),
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

  it("conta os subtemas só nas categorias que têm subtema", () => {
    const kitchen = [
      feedback({ sent_on: "2026-10-02", category: "Uso da cozinha", subtopic: "Geladeira e alimentos" }),
      feedback({ sent_on: "2026-10-03", category: "Uso da cozinha", subtopic: "Geladeira e alimentos" }),
      feedback({ sent_on: "2026-10-04", category: "Uso da cozinha" }),
      feedback({ sent_on: "2026-10-05", category: "Uso da cozinha", subtopic: "Permanência" }),
      feedback({ sent_on: "2026-10-06", category: "Estacionamento" }),
    ];
    const rows = summarizeMonth(kitchen, { year: 2026, month: 10 }).categories;
    expect(rows.find((row) => row.category === "Uso da cozinha")?.subtopics).toEqual([
      { name: "Geladeira e alimentos", sent: 2 },
      { name: "Permanência", sent: 1 },
      { name: "Sem subtema", sent: 1 },
    ]);
    expect(rows.find((row) => row.category === "Estacionamento")?.subtopics).toEqual([]);
  });

  it("sem dado de visualização no mês vira s/d por área", () => {
    const summary = summarizeMonth(items, { year: 2026, month: 9 });
    expect(summary.viewedBase).toBe(0);
    expect(summary.areas.find((row) => row.area === "Cível")?.viewed).toBeNull();
  });
});

describe("summarizeArea", () => {
  const items = [
    feedback({ sent_on: "2026-10-02", area: "Cível", employee_id: "e1", employee_name: "Ana", category: "Uso da cozinha", responded_on: "2026-10-05" }),
    feedback({ sent_on: "2026-10-20", area: "Cível", employee_id: "e1", employee_name: "Ana", category: "Estacionamento" }),
    feedback({ sent_on: "2026-10-09", area: "Cível", employee_id: "e2", employee_name: "Bruno", category: "Uso da cozinha" }),
    feedback({ sent_on: "2026-10-11", area: "Cível", employee_name: "Equipe Cível", is_team: true, category: "Uso da cozinha" }),
    feedback({ sent_on: "2026-09-15", area: "Cível", employee_id: "e1", employee_name: "Ana" }),
    feedback({ sent_on: "2026-11-03", area: "Cível", employee_id: "e1", employee_name: "Ana" }),
    feedback({ sent_on: "2026-10-04", area: "Trabalhista", employee_id: "e3", employee_name: "Carla" }),
  ];

  it("lista quem recebeu no mês, com temas, datas e o acumulado até o mês", () => {
    const report = summarizeArea(items, "Cível", { year: 2026, month: 10 });
    expect(report.total).toBe(4);
    expect(report.previousTotal).toBe(1);
    expect(report.yearToDate).toBe(5);
    expect(report.items.map((item) => item.sent_on)).toEqual(["2026-10-02", "2026-10-09", "2026-10-11", "2026-10-20"]);
    expect(report.people[0]).toMatchObject({
      name: "Ana",
      sent: 2,
      yearToDate: 3,
      dates: ["2026-10-02", "2026-10-20"],
      responded: 1,
      categories: [
        { category: "Estacionamento", sent: 1 },
        { category: "Uso da cozinha", sent: 1 },
      ],
    });
    expect(report.people.find((row) => row.isTeam)).toMatchObject({ key: "equipe:Cível", sent: 1, employeeId: null });
    expect(report.categories[0]).toMatchObject({ category: "Uso da cozinha", sent: 3 });
    expect(report.respondedFast).toBe(1);
  });

  it("usa o total do escritório no mês para a faixa", () => {
    // 4 na área (Atenção: 3 ou 4) e 5 no escritório (não passa de 10).
    expect(summarizeArea(items, "Cível", { year: 2026, month: 10 }).band).toBe("atencao");
    expect(summarizeArea(items, "Cível", { year: 2026, month: 8 })).toMatchObject({ total: 0, band: null, people: [] });
  });

  it("conta as áreas do mês para os botões", () => {
    const counts = areaCountsInMonth(items, { year: 2026, month: 10 });
    expect(counts.find((row) => row.area === "Cível")?.sent).toBe(4);
    expect(counts.find((row) => row.area === "Trabalhista")?.sent).toBe(1);
    expect(counts.find((row) => row.area === "Tributário")?.sent).toBe(0);
    // Gestores entra como grupo no fim; área fora da lista oficial (ADD) não ganha botão.
    expect(counts[counts.length - 1].area).toBe("Gestores");
    expect(areaCountsInMonth([feedback({ sent_on: "2026-02-05", area: "ADD" })], { year: 2026, month: 2 }).some((row) => row.area === "ADD")).toBe(false);
  });
});

describe("summarizeAreasPivot", () => {
  const items = [
    feedback({ sent_on: "2026-11-02", area: "Cível", employee_id: "e1", employee_name: "Ana" }),
    feedback({ sent_on: "2026-11-05", area: "Cível", employee_id: "e1", employee_name: "Ana" }),
    feedback({ sent_on: "2026-11-06", area: "Cível", employee_id: "e2", employee_name: "Bruno" }),
    feedback({ sent_on: "2026-11-07", area: "Trabalhista", employee_id: "e3", employee_name: "Carla" }),
    feedback({ sent_on: "2026-11-08", area: "Gestores", employee_name: "Equipe Gestores", is_team: true }),
    feedback({ sent_on: "2026-11-09", area: "ADD", employee_id: "e4", employee_name: "Davi" }),
    feedback({ sent_on: "2026-10-09", area: "Cível", employee_id: "e1", employee_name: "Ana" }),
  ];

  it("mostra cada área com as pessoas e só a quantidade, Gestores no fim", () => {
    const pivot = summarizeAreasPivot(items, { year: 2026, month: 11 });
    expect(pivot.total).toBe(5);
    expect(pivot.rows.map((row) => `${row.area} ${row.sent}`)).toEqual(["Cível 3", "Trabalhista 1", "Gestores 1"]);
    expect(pivot.rows[0].people.map((row) => `${row.name} ${row.sent}`)).toEqual(["Ana 2", "Bruno 1"]);
    expect(pivot.empty).toContain("Tributário");
    expect(pivot.empty).not.toContain("Cível");
  });

  it("conta os meses do ano sem área fora da lista", () => {
    const counts = pivotCountsByMonth(items, 2026);
    expect(counts[10]).toBe(5);
    expect(counts[9]).toBe(1);
  });
});

describe("summarizeYear e reincidência", () => {
  const items = [
    feedback({ sent_on: "2026-01-05", area: "Cível", employee_id: "e1", employee_name: "Giancarlo", category: "Estacionamento" }),
    feedback({ sent_on: "2026-05-05", area: "Cível", employee_id: "e1", employee_name: "Giancarlo", category: "Estacionamento", responded_on: "2026-05-06" }),
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
    expect(repeats[0]).toMatchObject({ name: "Giancarlo", count: 2, lastSentOn: "2026-05-05", topCategory: "Estacionamento" });
  });
});
