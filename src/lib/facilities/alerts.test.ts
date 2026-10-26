import { describe, expect, it } from "vitest";
import {
  addMonths,
  contractAlerts,
  currentTermEnd,
  documentAlerts,
  monthlyCost,
  nextAdjustment,
  noticeDeadline,
  termProgress,
  upcomingKeyDates,
} from "./alerts";
import type { SupplierContract, SupplierDocument } from "./types";

function contract(overrides: Partial<SupplierContract> = {}): SupplierContract {
  return {
    id: "c1",
    supplier_id: "s1",
    title: "Locação do escritório",
    object: null,
    status: "vigente",
    formalization: "contrato_assinado",
    contracting_party: "Bismarchi | Pires",
    start_date: "2024-01-01",
    end_date: "2026-12-31",
    auto_renew: false,
    renewal_months: null,
    notice_days: null,
    adjustment_index: null,
    adjustment_month: null,
    value: 1000,
    value_period: "mensal",
    responsible_user_id: null,
    sharepoint_url: "https://sharepoint/contrato.pdf",
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function doc(overrides: Partial<SupplierDocument> = {}): SupplierDocument {
  return {
    id: "d1",
    supplier_id: "s1",
    contract_id: null,
    kind: "certidao",
    title: null,
    file_name: "certidao.pdf",
    content_type: "application/pdf",
    size_bytes: 100,
    has_file: true,
    external_url: null,
    valid_until: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("addMonths", () => {
  it("mantém o dia e encosta no fim do mês curto", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-10-15", 12)).toBe("2027-10-15");
  });
});

describe("currentTermEnd", () => {
  it("empurra o contrato que renova sozinho para a próxima data futura", () => {
    const c = contract({ end_date: "2025-03-01", auto_renew: true, renewal_months: 12 });
    expect(currentTermEnd(c, "2026-10-23")).toBe("2027-03-01");
  });

  it("não mexe em contrato sem renovação automática", () => {
    expect(currentTermEnd(contract({ end_date: "2025-03-01" }), "2026-10-23")).toBe("2025-03-01");
  });

  it("prazo indeterminado não tem fim", () => {
    expect(currentTermEnd(contract({ end_date: null }), "2026-10-23")).toBeNull();
  });
});

describe("termProgress", () => {
  it("mede o período atual de um contrato que já renovou", () => {
    const c = contract({ start_date: "2024-01-25", end_date: "2025-01-25", auto_renew: true, renewal_months: 12, notice_days: 30 });
    const term = termProgress(c, "2026-10-23");
    expect(term).toMatchObject({ start: "2026-01-25", end: "2027-01-25", daysLeft: 94 });
    expect(term.elapsed).toBeCloseTo(271 / 365, 2);
    expect(term.notice).toBeCloseTo(335 / 365, 2);
  });

  it("prazo indeterminado não tem barra", () => {
    expect(termProgress(contract({ end_date: null }), "2026-10-23")).toMatchObject({ end: null, elapsed: null });
  });
});

describe("noticeDeadline", () => {
  it("é o fim do período menos o aviso prévio", () => {
    const c = contract({ end_date: "2026-12-31", notice_days: 30 });
    expect(noticeDeadline(c, "2026-10-23")).toBe("2026-12-01");
  });
});

describe("nextAdjustment", () => {
  it("conta os meses até o mês-base, dando a volta no ano", () => {
    expect(nextAdjustment(contract({ adjustment_month: 10 }), "2026-10-23")).toEqual({ month: 10, monthsAhead: 0 });
    expect(nextAdjustment(contract({ adjustment_month: 2 }), "2026-10-23")).toEqual({ month: 2, monthsAhead: 4 });
  });
});

describe("contractAlerts", () => {
  const today = "2026-10-23";

  it("pede decisão antes do prazo de aviso de um contrato que renova sozinho", () => {
    const c = contract({ end_date: "2027-01-31", auto_renew: true, renewal_months: 12, notice_days: 90 });
    const [alert] = contractAlerts(c, [], today);
    expect(alert).toMatchObject({ kind: "aviso", severity: "danger", date: "2026-11-02", days: 10 });
    expect(alert.title).toContain("para não renovar");
  });

  it("depois do prazo de aviso, informa a renovação automática", () => {
    const c = contract({ end_date: "2026-11-30", auto_renew: true, renewal_months: 12, notice_days: 60 });
    expect(contractAlerts(c, [], today)[0]).toMatchObject({ kind: "aviso", severity: "info", date: "2026-11-30" });
  });

  it("avisa vencimento próximo e vencido de contrato sem renovação", () => {
    expect(contractAlerts(contract({ end_date: "2026-12-15" }), [], today)[0]).toMatchObject({
      kind: "vencimento",
      severity: "warning",
      days: 53,
    });
    expect(contractAlerts(contract({ end_date: "2026-10-01" }), [], today)[0]).toMatchObject({
      kind: "vencimento",
      severity: "danger",
    });
  });

  it("lembra do reajuste no mês-base e no anterior", () => {
    const alerts = contractAlerts(contract({ adjustment_month: 11, adjustment_index: "igpm" }), [], today);
    expect(alerts.find((a) => a.kind === "reajuste")?.title).toBe("Reajuste (IGP-M) em novembro");
  });

  it("marca contrato sem arquivo e sem vigência (os que vieram da planilha)", () => {
    const kinds = contractAlerts(contract({ sharepoint_url: null, start_date: null, end_date: null }), [], today).map(
      (a) => a.kind
    );
    expect(kinds).toEqual(["sem_arquivo", "sem_vigencia"]);
  });

  it("arquivo anexado ao contrato tira o alerta de arquivo", () => {
    const c = contract({ sharepoint_url: null, end_date: "2027-12-31" });
    expect(contractAlerts(c, [doc({ kind: "contrato", contract_id: "c1" })], today)).toEqual([]);
  });

  it("contrato encerrado não gera alerta", () => {
    expect(contractAlerts(contract({ status: "encerrado", end_date: "2026-10-01" }), [], today)).toEqual([]);
  });
});

describe("documentAlerts", () => {
  it("avisa a validade nos 30 dias e quando já venceu", () => {
    const alerts = documentAlerts(
      [doc({ id: "a", valid_until: "2026-11-10" }), doc({ id: "b", valid_until: "2026-10-01" }), doc({ id: "c", valid_until: "2027-06-01" })],
      "2026-10-23"
    );
    expect(alerts.map((a) => [a.documentId, a.severity])).toEqual([
      ["a", "warning"],
      ["b", "danger"],
    ]);
  });
});

describe("upcomingKeyDates", () => {
  it("junta aviso, fim/renovação e reajuste dos próximos 12 meses em ordem", () => {
    const renews = contract({ id: "a", end_date: "2027-03-31", auto_renew: true, renewal_months: 12, notice_days: 30, adjustment_month: 4 });
    const ends = contract({ id: "b", end_date: "2026-12-15", adjustment_month: 10 });
    const later = contract({ id: "c", end_date: "2028-01-01" });
    const dates = upcomingKeyDates([renews, ends, later], "2026-10-23").map((d) => [d.contract.id, d.kind, d.date]);
    expect(dates).toEqual([
      ["b", "reajuste", "2026-10-01"],
      ["b", "fim", "2026-12-15"],
      ["a", "aviso", "2027-03-01"],
      ["a", "renovacao", "2027-03-31"],
      ["a", "reajuste", "2027-04-01"],
    ]);
  });
});

describe("monthlyCost", () => {
  it("converte para mês e ignora eventuais e inativos", () => {
    expect(
      monthlyCost([
        { amount: 1200, periodicity: "anual", active: true },
        { amount: 300, periodicity: "mensal", active: true },
        { amount: 900, periodicity: "eventual", active: true },
        { amount: 500, periodicity: "mensal", active: false },
      ])
    ).toBe(400);
  });
});
