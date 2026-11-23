import { describe, expect, it } from "vitest";
import {
  formatElapsedLabel,
  formatStopwatch,
  isLongRunningTimer,
  longTimerWarning,
  resolveChosenEnd,
  timerDayOptions,
} from "@/lib/timer-rules";

// Datas montadas no fuso local para o teste não depender do fuso da máquina.
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const iso = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(at(y, m, d, h, min)).toISOString();

describe("isLongRunningTimer", () => {
  it("cronômetro curto no mesmo dia é normal", () => {
    expect(isLongRunningTimer(iso(2026, 10, 20, 15, 51), at(2026, 10, 20, 17, 30))).toBe(false);
  });

  it("passou de 4h no mesmo dia", () => {
    expect(isLongRunningTimer(iso(2026, 10, 20, 12, 0), at(2026, 10, 20, 16, 0))).toBe(true);
  });

  it("começou em outro dia, mesmo com pouco tempo", () => {
    expect(isLongRunningTimer(iso(2026, 10, 20, 23, 30), at(2026, 10, 21, 0, 15))).toBe(true);
  });

  it("o caso real: ligado às 15:51 e pausado às 13:37 do dia seguinte", () => {
    expect(isLongRunningTimer(iso(2026, 10, 20, 15, 51), at(2026, 10, 21, 13, 37))).toBe(true);
  });
});

describe("longTimerWarning", () => {
  it("sem aviso enquanto está normal", () => {
    expect(longTimerWarning(iso(2026, 10, 20, 15, 0), at(2026, 10, 20, 16, 0))).toBeNull();
  });

  it("avisa depois de 4h", () => {
    expect(longTimerWarning(iso(2026, 10, 20, 12, 0), at(2026, 10, 20, 16, 30))).toBe(
      "Ligado há mais de 4h. Esqueceu de pausar?"
    );
  });

  it("avisa quando virou o dia antes de 4h", () => {
    expect(longTimerWarning(iso(2026, 10, 20, 23, 30), at(2026, 10, 21, 0, 15))).toBe(
      "Ligado desde 20/10 às 23:30. Esqueceu de pausar?"
    );
  });
});

describe("formatação", () => {
  it("formatStopwatch", () => {
    expect(formatStopwatch(iso(2026, 10, 20, 15, 51), at(2026, 10, 20, 17, 5) + 7_000)).toBe("01:14:07");
  });

  it("formatElapsedLabel", () => {
    expect(formatElapsedLabel(iso(2026, 10, 20, 15, 51), at(2026, 10, 21, 13, 37))).toBe("21h 46min");
    expect(formatElapsedLabel(iso(2026, 10, 20, 15, 0), at(2026, 10, 20, 15, 40))).toBe("40min");
    expect(formatElapsedLabel(iso(2026, 10, 20, 15, 0), at(2026, 10, 20, 20, 0))).toBe("5h");
  });
});

describe("timerDayOptions", () => {
  it("lista do dia do início até hoje", () => {
    const days = timerDayOptions(iso(2026, 10, 20, 15, 51), at(2026, 10, 21, 13, 37));
    expect(days.map((d) => d.value)).toEqual(["2026-10-20", "2026-10-21"]);
    expect(days[0].label).toBe("terça, 20/10");
  });
});

describe("resolveChosenEnd", () => {
  const start = iso(2026, 10, 20, 15, 51);
  const now = at(2026, 10, 21, 13, 37);

  it("exige a hora", () => {
    expect(resolveChosenEnd(start, "2026-10-20", "", now)).toEqual({
      error: "Informe até que horas você trabalhou nessa tarefa.",
    });
  });

  it("aceita um horário entre o início e agora", () => {
    expect(resolveChosenEnd(start, "2026-10-20", "18:00", now)).toEqual({
      endedAt: iso(2026, 10, 20, 18, 0),
    });
  });

  it("recusa antes do início", () => {
    expect(resolveChosenEnd(start, "2026-10-20", "15:00", now)).toEqual({
      error: "O horário precisa ser depois do início (20/10 às 15:51).",
    });
  });

  it("recusa depois de agora", () => {
    expect(resolveChosenEnd(start, "2026-10-21", "14:00", now)).toEqual({
      error: "O horário não pode ser depois de agora.",
    });
  });
});
