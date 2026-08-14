import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEventsForecast } from "@/lib/eventos";

type EventSeed = {
  id: string;
  year: number;
  name: string;
  series_id: string | null;
  series_name?: string;
  kind?: string;
  status?: string;
  budget_approved?: number | null;
  participants_actual?: number | null;
};

type BudgetSeed = {
  event_id: string;
  amount_planned?: number;
  amount_actual?: number | null;
};

/**
 * Stub do supabase-js cobrindo só o que fetchEventsForecast usa:
 * from("events").select().order() e from("event_budget_items").select().
 */
function makeClient(events: EventSeed[], budget: BudgetSeed[]): SupabaseClient {
  const eventRows = events.map((e) => ({
    id: e.id,
    year: e.year,
    name: e.name,
    series_id: e.series_id,
    kind: e.kind ?? "evento",
    month_label: null,
    commemorative_date: null,
    event_date: null,
    end_date: null,
    gifts_notes: null,
    organization_team: null,
    status: e.status ?? "concluida",
    objectives: null,
    budget_approved: e.budget_approved ?? null,
    notes: null,
    event_type: null,
    event_size: null,
    target_audience: null,
    priority: "normal",
    requesting_area: null,
    owner_user_id: null,
    location: null,
    participants_expected: null,
    participants_actual: e.participants_actual ?? null,
    stage_status: "realizado",
    risk_level: "baixo",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    event_series: e.series_name ? { name: e.series_name } : null,
  }));

  const budgetRows = budget.map((b) => ({
    event_id: b.event_id,
    amount_planned: b.amount_planned ?? 0,
    amount_actual: b.amount_actual ?? null,
  }));

  return {
    from(table: string) {
      const data = table === "events" ? eventRows : budgetRows;
      const result = { data, error: null };
      return {
        select: () => ({
          ...result,
          order: () => result,
          then: undefined,
        }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("fetchEventsForecast", () => {
  it("usa o realizado do ano mais recente como base e aplica o custo por pessoa", async () => {
    const client = makeClient(
      [
        { id: "e25", year: 2025, name: "Dia do Advogado", series_id: "s1", series_name: "Dia do Advogado" },
        {
          id: "e26",
          year: 2026,
          name: "Dia do Advogado 2026",
          series_id: "s1",
          series_name: "Dia do Advogado",
          budget_approved: 3000,
          participants_actual: 60,
        },
      ],
      [
        { event_id: "e25", amount_planned: 1000, amount_actual: 900 },
        { event_id: "e26", amount_planned: 2400, amount_actual: 2400 },
      ]
    );

    const forecast = await fetchEventsForecast(2027, client);
    const row = forecast.rows.find((r) => r.seriesId === "s1")!;

    expect(forecast.historyYears).toEqual([2025, 2026]);
    expect(row.baseYear).toBe(2026);
    expect(row.baseValue).toBe(2400);
    expect(row.baseSource).toBe("realizado");
    expect(row.costPerParticipant).toBe(40);
    expect(row.targetEventId).toBeNull();
  });

  it("cai para previsto e depois para verba quando não há realizado", async () => {
    const client = makeClient(
      [
        { id: "a", year: 2026, name: "Só previsto", series_id: "s2", series_name: "Só previsto" },
        {
          id: "b",
          year: 2026,
          name: "Só verba",
          series_id: "s3",
          series_name: "Só verba",
          budget_approved: 500,
        },
      ],
      [{ event_id: "a", amount_planned: 800, amount_actual: null }]
    );

    const forecast = await fetchEventsForecast(2027, client);
    const previsto = forecast.rows.find((r) => r.seriesId === "s2")!;
    const verba = forecast.rows.find((r) => r.seriesId === "s3")!;

    expect(previsto.baseValue).toBe(800);
    expect(previsto.baseSource).toBe("previsto");
    // sem realizado não há custo por pessoa confiável
    expect(previsto.costPerParticipant).toBeNull();

    expect(verba.baseValue).toBe(500);
    expect(verba.baseSource).toBe("verba");
  });

  it("ignora edições canceladas ao escolher a base", async () => {
    const client = makeClient(
      [
        { id: "ok", year: 2025, name: "Festa", series_id: "s4", series_name: "Festa" },
        {
          id: "cancel",
          year: 2026,
          name: "Festa",
          series_id: "s4",
          series_name: "Festa",
          status: "cancelada",
        },
      ],
      [
        { event_id: "ok", amount_planned: 700, amount_actual: 700 },
        { event_id: "cancel", amount_planned: 5000, amount_actual: 5000 },
      ]
    );

    const forecast = await fetchEventsForecast(2027, client);
    const row = forecast.rows.find((r) => r.seriesId === "s4")!;

    expect(row.baseYear).toBe(2025);
    expect(row.baseValue).toBe(700);
    expect(row.byYear[2026]).toBeUndefined();
  });

  it("marca a edição já aberta no ano-alvo e não a usa como base", async () => {
    const client = makeClient(
      [
        { id: "p", year: 2026, name: "Páscoa", series_id: "s5", series_name: "Páscoa" },
        { id: "p27", year: 2027, name: "Páscoa", series_id: "s5", series_name: "Páscoa" },
      ],
      [
        { event_id: "p", amount_planned: 300, amount_actual: 300 },
        { event_id: "p27", amount_planned: 999, amount_actual: 999 },
      ]
    );

    const forecast = await fetchEventsForecast(2027, client);
    const row = forecast.rows.find((r) => r.seriesId === "s5")!;

    expect(row.targetEventId).toBe("p27");
    expect(forecast.historyYears).toEqual([2026]);
    expect(row.baseValue).toBe(300);
  });

  it("conta eventos sem série à parte, fora da comparação", async () => {
    const client = makeClient(
      [
        { id: "x", year: 2026, name: "Avulso", series_id: null },
        { id: "y", year: 2026, name: "Com série", series_id: "s6", series_name: "Com série" },
      ],
      [{ event_id: "y", amount_planned: 100, amount_actual: 100 }]
    );

    const forecast = await fetchEventsForecast(2027, client);

    expect(forecast.unlinkedCount).toBe(1);
    expect(forecast.rows).toHaveLength(1);
    expect(forecast.rows[0]!.seriesId).toBe("s6");
  });

  it("ordena as séries com base histórica antes das sem base", async () => {
    const client = makeClient(
      [
        { id: "sem", year: 2026, name: "Sem valor", series_id: "s7", series_name: "Sem valor" },
        { id: "alto", year: 2026, name: "Caro", series_id: "s8", series_name: "Caro" },
        { id: "baixo", year: 2026, name: "Barato", series_id: "s9", series_name: "Barato" },
      ],
      [
        { event_id: "alto", amount_planned: 5000, amount_actual: 5000 },
        { event_id: "baixo", amount_planned: 100, amount_actual: 100 },
      ]
    );

    const forecast = await fetchEventsForecast(2027, client);

    expect(forecast.rows.map((r) => r.seriesName)).toEqual(["Caro", "Barato", "Sem valor"]);
  });
});
