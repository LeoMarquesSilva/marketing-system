import { describe, expect, it } from "vitest";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { businessDaysBetween, computeSlaReport, percentile } from "@/lib/sla-metrics";

function req(overrides: Partial<MarketingRequest>): MarketingRequest {
  return {
    id: "r1",
    title: "Peça",
    status: "pending",
    requested_at: "2026-09-21T13:00:00.000Z", // segunda
    delivered_at: null,
    request_type: "PPT",
    workflow_stage: "concluido",
    deadline: null,
    stage_changed_at: "2026-09-23T18:00:00.000Z", // quarta
    ...overrides,
  } as MarketingRequest;
}

describe("percentile", () => {
  it("interpola linearmente", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 0.8)).toBeCloseTo(4.2);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("businessDaysBetween", () => {
  it("conta só dias úteis após o pedido", () => {
    expect(businessDaysBetween("2026-09-21T13:00:00Z", "2026-09-21T20:00:00Z")).toBe(0);
    // sexta → segunda
    expect(businessDaysBetween("2026-09-25T13:00:00Z", "2026-09-28T13:00:00Z")).toBe(1);
  });

  it("usa o fuso de São Paulo", () => {
    // 02:00 UTC de terça ainda é segunda à noite em SP
    expect(businessDaysBetween("2026-09-21T13:00:00Z", "2026-09-22T02:00:00Z")).toBe(0);
  });

  it("trata meia-noite UTC como data pura (planilha antiga)", () => {
    expect(businessDaysBetween("2025-10-06T00:00:00+00:00", "2025-10-07T00:00:00+00:00")).toBe(1);
  });
});

describe("computeSlaReport", () => {
  it("calcula esforço, 1ª versão, conclusão e ajustes por tipo", () => {
    const { rows, details } = computeSlaReport(
      [req({ id: "a", deadline: "2026-09-23" })],
      [
        { request_id: "a", started_at: "2026-09-21T14:00:00Z", ended_at: "2026-09-21T15:00:00Z" },
        { request_id: "a", started_at: "2026-09-22T14:00:00Z", ended_at: "2026-09-22T14:30:00Z" },
        { request_id: "a", started_at: "2026-09-22T16:00:00Z", ended_at: null },
      ],
      [
        { request_id: "a", to_value: "em_producao", created_at: "2026-09-21T14:00:00Z" },
        { request_id: "a", to_value: "revisao", created_at: "2026-09-22T15:00:00Z" },
        { request_id: "a", to_value: "revisao_autor", created_at: "2026-09-22T17:00:00Z" },
      ]
    );

    expect(details[0].effortHours).toBeCloseTo(1.5);
    expect(details[0].firstVersionBusinessDays).toBe(1);
    expect(details[0].doneBusinessDays).toBe(2);
    expect(details[0].adjustmentRounds).toBe(1);
    expect(details[0].onTime).toBe(true);
    expect(rows[0].type).toBe("PPT");
    expect(rows[0].sugestao.esforcoHoras).toBe(1.5);
    expect(rows[0].confianca).toBe("baixa");
  });

  it("ignora abertas e o que não passou pelo fluxo do sistema", () => {
    const { details } = computeSlaReport(
      [
        req({ id: "aberta", workflow_stage: "em_producao" }),
        req({
          id: "retro",
          status: "completed",
          requested_at: "2026-08-11T19:09:41Z",
          delivered_at: "2026-08-11T19:09:41Z",
        }),
        req({
          id: "planilha",
          status: "completed",
          requested_at: "2025-10-06T00:00:00+00:00",
          delivered_at: "2025-10-13T00:00:00+00:00",
        }),
      ],
      [{ request_id: "aberta", started_at: "2026-09-21T14:00:00Z", ended_at: "2026-09-21T15:00:00Z" }],
      []
    );
    expect(details).toHaveLength(0);
  });

  it("usa a conclusão como 1ª versão quando só há horas apontadas", () => {
    const { details, rows } = computeSlaReport(
      [req({ id: "b" })],
      [{ request_id: "b", started_at: "2026-09-21T14:00:00Z", ended_at: "2026-09-21T14:20:00Z" }],
      []
    );
    expect(details[0].firstVersionBusinessDays).toBe(2);
    expect(rows[0].ajustesMedia).toBeNull();
  });
});
