import { describe, expect, it } from "vitest";
import { areaReportHtml, areaReportText, areasPivotHtml, areasPivotText, dayMonth, reportSummaryLine } from "./area-report-text";
import { summarizeArea, summarizeAreasPivot } from "./metrics";
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

const items = [
  feedback({
    sent_on: "2026-10-02",
    employee_id: "e1",
    employee_name: "Ana Maria Souza",
    category: "Uso da cozinha",
    subtopic: "Geladeira e alimentos",
    description: "Marmita da semana passada\nna geladeira.",
    responded_on: "2026-10-03",
  }),
  feedback({ sent_on: "2026-10-20", employee_id: "e1", employee_name: "Ana Maria Souza", category: "Uso da cozinha", description: "Caneca <suja>" }),
  feedback({ sent_on: "2026-09-10", employee_id: "e1", employee_name: "Ana Maria Souza" }),
];
const report = summarizeArea(items, "Cível", { year: 2026, month: 10 });
const nameOf = (row: { name: string; employeeId: string | null }) => (row.employeeId === "e1" ? "Ana Souza" : row.name);

describe("texto da visão por área", () => {
  it("formata o dia e o resumo", () => {
    expect(dayMonth("2026-10-02")).toBe("02/10");
    expect(reportSummaryLine(report)).toBe(
      "2 feedbacks no mês (1 em setembro) · 1 pessoa · 3 no ano até outubro · faixa: Monitoramento · retorno do gestor: 1 de 2"
    );
  });

  it("monta o texto para WhatsApp com quem recebeu e as ocorrências", () => {
    const text = areaReportText(report, nameOf, true);
    expect(text.split("\n")[0]).toBe("*Feedbacks de boas práticas — Cível — outubro de 2026*");
    expect(text).toContain("• Ana Souza — 2 no mês (3 no ano) — Uso da cozinha (2) — 02/10, 20/10");
    expect(text).toContain("02/10 — Ana Souza — Uso da cozinha · Geladeira e alimentos — Marmita da semana passada na geladeira.");
    expect(areaReportText(report, nameOf, false)).not.toContain("*Ocorrências*");
  });

  it("monta a tabela HTML escapando o texto", () => {
    const html = areaReportHtml(report, nameOf, true);
    expect(html).toContain("<th");
    expect(html).toContain("Ana Souza");
    expect(html).toContain("Caneca &lt;suja&gt;");
    expect(html).not.toContain("<suja>");
  });

  it("monta o quadro simples com área, pessoas e quantidade", () => {
    const pivot = summarizeAreasPivot(items, { year: 2026, month: 10 });
    const text = areasPivotText(pivot, nameOf);
    expect(text).toContain("*Cível* — 2");
    expect(text).toContain("• Ana Souza — 2");
    expect(text).toContain("Sem feedback: Reestruturação");
    expect(areasPivotHtml(pivot, nameOf)).toContain("Total</td>");
  });

  it("avisa quando a área não teve feedback no mês", () => {
    const empty = summarizeArea(items, "Cível", { year: 2026, month: 8 });
    expect(areaReportText(empty, nameOf, true)).toContain("Nenhum feedback no mês.");
  });
});
