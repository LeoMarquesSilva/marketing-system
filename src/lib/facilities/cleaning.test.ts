import { describe, expect, it } from "vitest";
import { dayStats, monthWeeks, scheduleSlot, scheduleWeekFor, todayInSaoPaulo } from "./cleaning";

// Feriados nacionais de nov/dez 2026 que caem em dia de semana.
const HOLIDAYS = new Set(["2026-11-02", "2026-11-20", "2026-12-25"]);

describe("semana do cronograma", () => {
  it("conta as semanas do mês pelos dias úteis: 02/11 é feriado, a 1ª semana começa em 03/11", () => {
    const weeks = monthWeeks("2026-11", HOLIDAYS);
    expect(weeks.map((w) => w.monday)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(weeks[0].days.filter((d) => d.business).map((d) => d.iso)).toEqual(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
    expect(weeks[2].days.find((d) => d.iso === "2026-11-20")).toMatchObject({ holiday: true, business: false });
  });

  it("a 5ª semana repete a 1ª", () => {
    expect(scheduleWeekFor(5)).toBe(1);
    expect(scheduleSlot("2026-11-30", HOLIDAYS)).toEqual({ week: 1, weekday: 1, weekOfMonth: 5 });
    expect(scheduleSlot("2026-12-31", HOLIDAYS)).toEqual({ week: 1, weekday: 4, weekOfMonth: 5 });
  });

  it("semana que começa no mês anterior conta só os dias do mês", () => {
    const weeks = monthWeeks("2026-12", HOLIDAYS);
    expect(weeks[0].monday).toBe("2026-11-30");
    expect(weeks[0].days[0]).toMatchObject({ iso: "2026-11-30", inMonth: false, business: false });
    expect(scheduleSlot("2026-12-01", HOLIDAYS)).toEqual({ week: 1, weekday: 2, weekOfMonth: 1 });
  });

  it("fim de semana e feriado não têm limpeza", () => {
    expect(scheduleSlot("2026-11-21", HOLIDAYS)).toBeNull();
    expect(scheduleSlot("2026-11-20", HOLIDAYS)).toBeNull();
  });

  it("mês que começa no sábado: a 1ª semana é a da primeira segunda", () => {
    const weeks = monthWeeks("2026-08", new Set());
    expect(weeks[0].monday).toBe("2026-08-03");
    expect(weeks).toHaveLength(5);
  });
});

describe("números do dia", () => {
  it("conta limpos, não limpos e pendentes só dos ambientes previstos", () => {
    const stats = dayStats(
      ["a", "b", "c", "d"],
      [
        { day: "2026-11-25", area_id: "a", status: "limpo", checked_at: "" },
        { day: "2026-11-25", area_id: "b", status: "nao_limpo", checked_at: "" },
        { day: "2026-11-25", area_id: "x", status: "limpo", checked_at: "" },
      ]
    );
    expect(stats).toEqual({ expected: 4, done: 1, notDone: 1, pending: 2 });
  });

  it("hoje vem no fuso de Brasília", () => {
    expect(todayInSaoPaulo(new Date("2026-11-26T01:30:00Z"))).toBe("2026-11-25");
  });
});
