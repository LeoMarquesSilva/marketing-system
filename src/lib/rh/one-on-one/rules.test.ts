import { describe, expect, it } from "vitest";
import { cadenceOf, dayGrid, displayStatus, isWindowFree, isoToLocal, localToIso, recurrenceDates } from "./rules";

const now = new Date("2026-11-19T15:00:00.000Z");

describe("displayStatus", () => {
  it("agendada que já passou vira atrasada", () => {
    expect(displayStatus("agendada", "2026-11-19T14:00:00.000Z", now)).toBe("atrasada");
    expect(displayStatus("agendada", "2026-11-20T14:00:00.000Z", now)).toBe("agendada");
    expect(displayStatus("realizada", "2026-11-01T14:00:00.000Z", now)).toBe("realizada");
  });
});

describe("cadenceOf", () => {
  it("em dia até 30 dias da última realizada", () => {
    expect(cadenceOf("2026-10-25T12:00:00.000Z", null, 30, now)).toBe("em_dia");
    expect(cadenceOf("2026-10-01T12:00:00.000Z", null, 30, now)).toBe("atrasada");
  });
  it("sem reunião e primeira já marcada", () => {
    expect(cadenceOf(null, null, 30, now)).toBe("sem_reuniao");
    expect(cadenceOf(null, "2026-11-25T12:00:00.000Z", 30, now)).toBe("em_dia");
  });
});

describe("fuso de São Paulo", () => {
  it("converte hora local em UTC e volta", () => {
    expect(localToIso("2026-11-20T14:00")).toBe("2026-11-20T17:00:00.000Z");
    expect(isoToLocal("2026-11-20T17:00:00.000Z")).toBe("2026-11-20T14:00");
  });
});

describe("recurrenceDates", () => {
  it("semanal e quinzenal", () => {
    expect(recurrenceDates("2026-11-20", "semanal", "2026-12-10")).toEqual(["2026-11-20", "2026-11-27", "2026-12-04"]);
    expect(recurrenceDates("2026-11-20", "quinzenal", "2026-12-31")).toEqual(["2026-11-20", "2026-12-04", "2026-12-18"]);
  });
  it("mensal mantém a posição do dia da semana (3ª sexta)", () => {
    // 20/11/2026 é a 3ª sexta de novembro.
    expect(recurrenceDates("2026-11-20", "mensal", "2027-02-28")).toEqual(["2026-11-20", "2026-12-18", "2027-01-15", "2027-02-19"]);
  });
  it("5ª semana que não existe vira a última do mês", () => {
    // 30/10/2026 é a 5ª sexta; novembro só tem 4 sextas → 27/11.
    expect(recurrenceDates("2026-10-30", "mensal", "2026-11-30")).toEqual(["2026-10-30", "2026-11-27"]);
  });
  it("limita e respeita a data final", () => {
    expect(recurrenceDates("2026-11-20", "semanal", "2026-11-19")).toEqual([]);
    expect(recurrenceDates("2026-01-01", "semanal", "2030-01-01", 5)).toHaveLength(5);
  });
});

describe("livre/ocupado", () => {
  it("só é livre se todos os intervalos da reunião estão livres", () => {
    expect(isWindowFree("0020", 0, 2)).toBe(true);
    expect(isWindowFree("0020", 1, 2)).toBe(false);
    expect(isWindowFree("4000", 0, 2)).toBe(true);
  });
  it("grade do dia aponta quem está ocupado", () => {
    // 8h às 10h em intervalos de 30 min: 4 colunas; Ana ocupada às 8h30.
    const grid = dayGrid(
      [
        { label: "Ana", view: "0200" },
        { label: "Sala 1", view: "0000" },
      ],
      30,
      30,
      8,
      10
    );
    expect(grid.map((slot) => [slot.time, slot.free])).toEqual([
      ["08:00", true],
      ["08:30", false],
      ["09:00", true],
      ["09:30", true],
    ]);
    expect(grid[1].busy).toEqual(["Ana"]);
  });
});
