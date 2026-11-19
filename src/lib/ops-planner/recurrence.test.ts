import { describe, expect, it } from "vitest";
import { criarCalendario } from "@/lib/vistagem/dias-uteis";
import {
  describeRule,
  nextOccurrences,
  occurrencesBetween,
  occurrencesToGenerate,
  validateRule,
} from "./recurrence";
import type { OpsRecurrenceRule } from "./types";

// Finados (seg 02/11), Consciência Negra (sex 20/11), Natal e Ano-Novo.
const ehDiaUtil = criarCalendario(["2026-11-02", "2026-11-20", "2026-12-25", "2027-01-01"]);
const semFeriado = criarCalendario([]);

function rule(overrides: Partial<OpsRecurrenceRule>): OpsRecurrenceRule {
  return {
    frequency: "mensal",
    every_n: 1,
    weekdays: [],
    only_business_days: false,
    monthly_mode: "dia_do_mes",
    month_day: 1,
    business_day_n: null,
    week_of_month: null,
    weekday: null,
    month: null,
    shift_non_business: "manter",
    starts_on: "2026-10-01",
    ends_on: null,
    ...overrides,
  };
}

describe("occurrencesBetween — mensal", () => {
  it("5º dia útil pula o feriado de Finados", () => {
    const folha = rule({ monthly_mode: "dia_util", business_day_n: 5 });
    expect(occurrencesBetween(folha, "2026-11-01", "2026-12-31", ehDiaUtil)).toEqual(["2026-11-09", "2026-12-07"]);
    expect(occurrencesBetween(folha, "2026-11-01", "2026-11-30", semFeriado)).toEqual(["2026-11-06"]);
  });

  it("último dia útil do mês", () => {
    const fechamento = rule({ monthly_mode: "dia_util", business_day_n: -1 });
    expect(occurrencesBetween(fechamento, "2026-11-01", "2026-12-31", ehDiaUtil)).toEqual(["2026-11-30", "2026-12-31"]);
  });

  it("dia 31 cai no último dia dos meses curtos, inclusive fevereiro", () => {
    const dia31 = rule({ month_day: 31, starts_on: "2026-11-01" });
    expect(occurrencesBetween(dia31, "2026-11-01", "2027-03-31", semFeriado)).toEqual([
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("29/02 só existe no ano bissexto; fora dele vira 28/02", () => {
    const anual = rule({ frequency: "anual", month: 2, month_day: 29, starts_on: "2027-01-01" });
    expect(occurrencesBetween(anual, "2027-01-01", "2028-12-31", semFeriado)).toEqual(["2027-02-28", "2028-02-29"]);
  });

  it("antecipa ou adia quando cai em fim de semana ou feriado", () => {
    const base = { month_day: 31, starts_on: "2026-10-01" };
    // 31/10/2026 é sábado; a segunda seguinte (02/11) é Finados.
    expect(occurrencesBetween(rule({ ...base, shift_non_business: "antecipar" }), "2026-10-01", "2026-10-31", ehDiaUtil)).toEqual(["2026-10-30"]);
    expect(occurrencesBetween(rule({ ...base, shift_non_business: "adiar" }), "2026-10-01", "2026-11-05", ehDiaUtil)).toContain("2026-11-03");
    expect(occurrencesBetween(rule({ ...base, shift_non_business: "manter" }), "2026-10-01", "2026-10-31", ehDiaUtil)).toEqual(["2026-10-31"]);
  });

  it("data adiada para o mês seguinte entra na janela do mês seguinte", () => {
    const adiar = rule({ month_day: 31, shift_non_business: "adiar" });
    expect(occurrencesBetween(adiar, "2026-11-01", "2026-11-10", ehDiaUtil)).toEqual(["2026-11-03"]);
  });

  it("1ª segunda-feira e última sexta do mês", () => {
    const primeiraSegunda = rule({ monthly_mode: "semana_do_mes", week_of_month: 1, weekday: 1 });
    expect(occurrencesBetween(primeiraSegunda, "2026-11-01", "2026-11-30", ehDiaUtil)).toEqual(["2026-11-02"]);
    expect(
      occurrencesBetween({ ...primeiraSegunda, shift_non_business: "adiar" }, "2026-11-01", "2026-11-30", ehDiaUtil)
    ).toEqual(["2026-11-03"]);
    const ultimaSexta = rule({ monthly_mode: "semana_do_mes", week_of_month: -1, weekday: 5 });
    expect(occurrencesBetween(ultimaSexta, "2026-11-01", "2026-11-30", ehDiaUtil)).toEqual(["2026-11-27"]);
  });

  it("trimestral conta os meses a partir do início da rotina", () => {
    const trimestral = rule({ every_n: 3, month_day: 10, starts_on: "2026-10-01" });
    expect(occurrencesBetween(trimestral, "2026-10-01", "2027-07-31", semFeriado)).toEqual([
      "2026-10-10",
      "2027-01-10",
      "2027-04-10",
      "2027-07-10",
    ]);
  });

  it("respeita início e fim da rotina", () => {
    const comFim = rule({ month_day: 15, starts_on: "2026-11-01", ends_on: "2027-01-20" });
    expect(occurrencesBetween(comFim, "2026-01-01", "2027-12-31", semFeriado)).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
    ]);
  });
});

describe("occurrencesBetween — semanal e diária", () => {
  it("semanal em vários dias, a cada 2 semanas", () => {
    const quinzenal = rule({ frequency: "semanal", every_n: 2, weekdays: [1, 4], starts_on: "2026-10-26", monthly_mode: null });
    expect(occurrencesBetween(quinzenal, "2026-10-26", "2026-11-22", semFeriado)).toEqual([
      "2026-10-26",
      "2026-10-29",
      "2026-11-09",
      "2026-11-12",
    ]);
  });

  it("semanal sem dias marcados usa o dia da semana do início", () => {
    const sexta = rule({ frequency: "semanal", starts_on: "2026-10-23", monthly_mode: null });
    expect(occurrencesBetween(sexta, "2026-10-23", "2026-11-06", semFeriado)).toEqual(["2026-10-23", "2026-10-30", "2026-11-06"]);
  });

  it("semanal adia a segunda de feriado para a terça", () => {
    const segunda = rule({ frequency: "semanal", weekdays: [1], shift_non_business: "adiar", starts_on: "2026-10-26", monthly_mode: null });
    expect(occurrencesBetween(segunda, "2026-10-26", "2026-11-10", ehDiaUtil)).toEqual(["2026-10-26", "2026-11-03", "2026-11-09"]);
  });

  it("todo dia útil pula fim de semana e feriado", () => {
    const diaria = rule({ frequency: "diaria", only_business_days: true, starts_on: "2026-10-29", monthly_mode: null });
    expect(occurrencesBetween(diaria, "2026-10-29", "2026-11-04", ehDiaUtil)).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-11-03",
      "2026-11-04",
    ]);
  });

  it("a cada 3 dias conta a partir do início, não da janela", () => {
    const aCada3 = rule({ frequency: "diaria", every_n: 3, starts_on: "2026-10-01", monthly_mode: null });
    expect(occurrencesBetween(aCada3, "2026-10-05", "2026-10-12", semFeriado)).toEqual(["2026-10-07", "2026-10-10"]);
  });
});

describe("occurrencesToGenerate", () => {
  const folha = {
    ...rule({ monthly_mode: "dia_util", business_day_n: 5, starts_on: "2026-10-01" }),
    lead_days: 3,
    last_occurrence_date: null,
    active: true,
  };

  it("gera a ocorrência que vence dentro da antecedência", () => {
    expect(occurrencesToGenerate(folha, "2026-11-06", "2026-10-20", ehDiaUtil)).toEqual(["2026-11-09"]);
    expect(occurrencesToGenerate(folha, "2026-11-05", "2026-10-20", ehDiaUtil)).toEqual([]);
  });

  it("não volta para antes da criação da rotina", () => {
    // Criada em 23/10: a ocorrência de 07/10 já tinha passado.
    expect(occurrencesToGenerate({ ...folha, lead_days: 0 }, "2026-10-23", "2026-10-23", ehDiaUtil)).toEqual([]);
  });

  it("recupera no máximo 31 dias se o cron ficou parado", () => {
    const diaria = { ...rule({ frequency: "diaria", starts_on: "2026-08-01", monthly_mode: null }), lead_days: 0, last_occurrence_date: "2026-08-31", active: true };
    const datas = occurrencesToGenerate(diaria, "2026-10-31", "2026-08-01", semFeriado);
    expect(datas[0]).toBe("2026-09-30");
    expect(datas.at(-1)).toBe("2026-10-31");
    expect(datas).toHaveLength(32);
  });

  it("não repete o que já foi gerado e não gera rotina pausada", () => {
    expect(occurrencesToGenerate({ ...folha, last_occurrence_date: "2026-11-09" }, "2026-11-08", "2026-10-20", ehDiaUtil)).toEqual([]);
    expect(occurrencesToGenerate({ ...folha, active: false }, "2026-11-06", "2026-10-20", ehDiaUtil)).toEqual([]);
  });
});

describe("nextOccurrences e describeRule", () => {
  it("lista as próximas datas para a prévia", () => {
    const anual = rule({ frequency: "anual", every_n: 2, month: 3, month_day: 15, starts_on: "2026-01-01" });
    expect(nextOccurrences(anual, "2026-10-23", 3, semFeriado)).toEqual(["2028-03-15", "2030-03-15", "2032-03-15"]);
  });

  it("descreve a regra em português", () => {
    expect(describeRule(rule({ monthly_mode: "dia_util", business_day_n: 5 }))).toBe("Todo mês no 5º dia útil");
    expect(describeRule(rule({ every_n: 3, month_day: -1 }))).toBe("A cada trimestre no último dia");
    expect(describeRule(rule({ frequency: "semanal", weekdays: [4, 1], monthly_mode: null }))).toBe("Toda semana às segundas e quintas");
    expect(describeRule(rule({ frequency: "diaria", only_business_days: true, monthly_mode: null }))).toBe("Todo dia útil");
    expect(describeRule(rule({ frequency: "anual", month: 3, monthly_mode: "semana_do_mes", week_of_month: 1, weekday: 1 }))).toBe(
      "Todo ano em março, na 1ª segunda-feira"
    );
  });

  it("valida a regra antes de salvar", () => {
    expect(validateRule(rule({ monthly_mode: null }))).toBe("Escolha como a data cai no mês.");
    expect(validateRule(rule({ frequency: "anual", month: null }))).toBe("Informe o mês.");
    expect(validateRule(rule({ ends_on: "2026-09-01" }))).toBe("O fim precisa ser depois do início.");
    expect(validateRule(rule({}))).toBeNull();
  });
});
