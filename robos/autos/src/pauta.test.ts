import { describe, expect, it } from "vitest";
import { msAteProximoHorario } from "./pauta.ts";

// 18/11/2026 em Brasília (UTC-3): horário de cada caso em UTC = Brasília + 3h.
const brasilia = (hhmm: string) => new Date(`2026-11-18T${hhmm}:00-03:00`).getTime();

describe("horários do ciclo da pauta", () => {
  it("vai para o próximo horário do dia", () => {
    expect(msAteProximoHorario(brasilia("06:00"), "06:45,11:45,16:45")).toBe(45 * 60_000);
    expect(msAteProximoHorario(brasilia("12:00"), "06:45,11:45,16:45")).toBe((4 * 60 + 45) * 60_000);
  });
  it("depois do último, vai para o primeiro do dia seguinte", () => {
    expect(msAteProximoHorario(brasilia("17:00"), "06:45,11:45,16:45")).toBe((13 * 60 + 45) * 60_000);
  });
  it("ignora horário mal escrito e aceita ordem qualquer", () => {
    expect(msAteProximoHorario(brasilia("10:00"), "16:45, 25h, 11:45")).toBe(105 * 60_000);
  });
});
