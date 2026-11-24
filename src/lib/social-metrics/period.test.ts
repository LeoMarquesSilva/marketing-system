import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInSaoPaulo,
  daysInclusive,
  formatRange,
  parseMetricsPeriod,
  resolveMetricsPeriod,
  serializeMetricsPeriod,
} from "./period";

// 23/11/2026 às 10h em São Paulo.
const NOW = new Date("2026-11-23T13:00:00Z");

describe("resolveMetricsPeriod", () => {
  it("atalhos de N dias terminam ontem e comparam com a janela anterior de mesmo tamanho", () => {
    const period = resolveMetricsPeriod({ preset: "28d", compare: "anterior" }, NOW);
    expect(period.from).toBe("2026-10-26");
    expect(period.to).toBe("2026-11-22");
    expect(period.days).toBe(28);
    expect(period.compareTo).toBe("2026-10-25");
    expect(period.compareFrom).toBe("2026-09-28");
  });

  it("este mês compara com o mês anterior até o mesmo dia", () => {
    const period = resolveMetricsPeriod({ preset: "mes", compare: "anterior" }, NOW);
    expect([period.from, period.to]).toEqual(["2026-11-01", "2026-11-22"]);
    expect([period.compareFrom, period.compareTo]).toEqual(["2026-10-01", "2026-10-22"]);
  });

  it("mês passado compara com o mês inteiro anterior", () => {
    const period = resolveMetricsPeriod({ preset: "mes-anterior", compare: "anterior" }, NOW);
    expect([period.from, period.to]).toEqual(["2026-10-01", "2026-10-31"]);
    expect([period.compareFrom, period.compareTo]).toEqual(["2026-09-01", "2026-09-30"]);
    expect(period.label).toContain("out/2026");
  });

  it("vs ano anterior usa as mesmas datas um ano antes", () => {
    const period = resolveMetricsPeriod({ preset: "7d", compare: "ano-anterior" }, NOW);
    expect([period.compareFrom, period.compareTo]).toEqual(["2025-11-16", "2025-11-22"]);
  });

  it("personalizado aceita as datas invertidas", () => {
    const period = resolveMetricsPeriod({ preset: "personalizado", compare: "anterior", from: "2026-11-10", to: "2026-11-01" }, NOW);
    expect([period.from, period.to]).toEqual(["2026-11-01", "2026-11-10"]);
    expect(period.compareTo).toBe("2026-10-31");
  });

  it("no dia 1º o mês atual não fica vazio", () => {
    const period = resolveMetricsPeriod({ preset: "mes", compare: "anterior" }, new Date("2026-12-01T13:00:00Z"));
    expect([period.from, period.to]).toEqual(["2026-12-01", "2026-12-01"]);
  });
});

describe("datas", () => {
  it("converte instante para a data de São Paulo", () => {
    expect(dateInSaoPaulo("2026-11-19T01:30:00Z")).toBe("2026-11-18");
    expect(dateInSaoPaulo("2026-11-19T15:58:26+00:00")).toBe("2026-11-19");
  });

  it("soma dias e conta intervalos", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(daysInclusive("2026-11-01", "2026-11-30")).toBe(30);
    expect(formatRange("2026-11-01", "2026-11-22")).toBe("01/11 – 22/11/2026");
  });

  it("URL ida e volta", () => {
    const state = parseMetricsPeriod(new URLSearchParams("periodo=personalizado&comparar=ano-anterior&de=2026-01-01&ate=2026-03-31"));
    expect(state).toEqual({ preset: "personalizado", compare: "ano-anterior", from: "2026-01-01", to: "2026-03-31" });
    expect(serializeMetricsPeriod(state)).toEqual({ periodo: "personalizado", comparar: "ano-anterior", de: "2026-01-01", ate: "2026-03-31" });
    expect(parseMetricsPeriod(new URLSearchParams("periodo=xyz")).preset).toBe("28d");
  });
});
