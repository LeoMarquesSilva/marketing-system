import { describe, expect, it } from "vitest";
import { nextDueAfter, occurrencesBetween, planSituation } from "./maintenance";
import { nameSimilarity, suggestOpexNames, summarizeOpex, type OpexPayment } from "./opex";

describe("nameSimilarity", () => {
  it("liga o nome do escritório ao nome do SIOE, mesmo cortado", () => {
    expect(nameSimilarity("Reunião Construtora", "Reuniao Construtora e Administradora de Bens L")).toBe(1);
    expect(nameSimilarity("Thomson Reuters", "Thomson Reuters Brasil Conteudo e Tecnologia Ltda")).toBe(1);
    expect(nameSimilarity("Vivo", "Vivo S.a Telefônica Brasil S.a")).toBe(0.9);
  });

  it("não liga nomes que só dividem uma palavra comum", () => {
    expect(nameSimilarity("Vivo", "Telefônica Vivo")).toBe(0);
    expect(nameSimilarity("Selores Contabilidade", "Prado Contabilidade")).toBe(0);
    expect(nameSimilarity("Campclean", "C.camp Certificado Digital Ltda")).toBe(0);
    expect(nameSimilarity("Assertiva Tecnologia da Informação", "Kurier Tecnologia Em Informacao Ltda")).toBe(0);
  });
});

describe("suggestOpexNames", () => {
  it("sugere pelo nome ou pela razão social e ignora nome já ligado a outro", () => {
    const options = [
      { fornecedor: "Caju - Beneficios", total: 53107 },
      { fornecedor: "Mais Humanidade Ltda", total: 40000 },
      { fornecedor: "Mais Humanidade Eventos", total: 100 },
    ];
    const found = suggestOpexNames({ name: "Mais Humanidade (Camila Gracioli)", legal_name: null }, options, new Set(["Mais Humanidade Eventos"]));
    expect(found.map((f) => f.fornecedor)).toEqual(["Mais Humanidade Ltda"]);
  });
});

function payment(overrides: Partial<OpexPayment>): OpexPayment {
  return {
    fornecedor: "Vivo",
    mes: "2026-10-01",
    departamento: "Facilities",
    departamento_tipo: "indireto",
    grupo_conta: "DESPESAS DE INFRAESTRUTURA",
    plano_contas: "INTERNET",
    valor_pago: 100,
    ...overrides,
  };
}

describe("summarizeOpex", () => {
  it("soma os últimos 12 meses e diz que o custo é rateado", () => {
    const summary = summarizeOpex(
      [
        payment({ mes: "2026-11-01", valor_pago: 200 }),
        payment({ mes: "2026-01-01", departamento: "T.I.", valor_pago: 400 }),
        payment({ mes: "2025-10-01", valor_pago: 999 }), // fora da janela
      ],
      "2026-11-10"
    )!;
    expect(summary.total12m).toBe(600);
    expect(summary.months).toHaveLength(12);
    expect(summary.months[0].mes).toBe("2025-12-01");
    expect(summary.allocation).toBe("indireto");
    expect(summary.lastPaymentMonth).toBe("2026-11-01");
  });

  it("aponta a área quando o custo é de uma só", () => {
    const summary = summarizeOpex([payment({ departamento: "Trabalhista", departamento_tipo: "area_juridica", valor_pago: 500 })], "2026-11-10")!;
    expect(summary).toMatchObject({ allocation: "direto", mainArea: "Trabalhista" });
  });
});

describe("manutenção", () => {
  it("calcula a próxima data pela periodicidade", () => {
    expect(nextDueAfter("2026-11-10", "quinzenal", null)).toBe("2026-11-25");
    expect(nextDueAfter("2026-01-31", "mensal", null)).toBe("2026-02-28");
    expect(nextDueAfter("2026-11-10", "personalizada", 45)).toBe("2026-12-25");
    expect(nextDueAfter("2026-11-10", "pontual", null)).toBeNull();
  });

  it("classifica em dia, próxima e atrasada", () => {
    const base = { status: "ativo" as const, periodicity: "trimestral" as const, custom_interval_days: null };
    expect(planSituation({ ...base, next_due_on: "2026-11-01" }, "2026-11-10")).toEqual({ situation: "atrasada", days: -9 });
    expect(planSituation({ ...base, next_due_on: "2026-11-20" }, "2026-11-10").situation).toBe("proxima");
    expect(planSituation({ ...base, next_due_on: "2027-01-10" }, "2026-11-10").situation).toBe("em_dia");
    expect(planSituation({ ...base, status: "concluido", next_due_on: null }, "2026-11-10").situation).toBe("concluida");
  });

  it("lista as datas previstas na janela (atrasada conta a partir de hoje)", () => {
    const base = { status: "ativo" as const, periodicity: "trimestral" as const, custom_interval_days: null };
    expect(occurrencesBetween({ ...base, next_due_on: "2026-12-01" }, "2026-11-10", "2027-11-09")).toEqual([
      "2026-12-01",
      "2027-03-01",
      "2027-06-01",
      "2027-09-01",
    ]);
    expect(occurrencesBetween({ ...base, next_due_on: "2026-10-01" }, "2026-11-10", "2027-02-09")).toEqual(["2026-11-10"]);
    expect(occurrencesBetween({ ...base, periodicity: "pontual", next_due_on: "2026-12-01" }, "2026-11-10", "2027-11-09")).toEqual([
      "2026-12-01",
    ]);
    expect(occurrencesBetween({ ...base, status: "pausado", next_due_on: "2026-12-01" }, "2026-11-10", "2027-11-09")).toEqual([]);
  });
});
