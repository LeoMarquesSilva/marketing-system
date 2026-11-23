import { describe, expect, it } from "vitest";
import { daysBetween, daysUntilAnniversary, shortDate, tenureLabel, todayInBrasilia } from "@/lib/inicio/dates";

describe("datas da tela inicial", () => {
  it("usa o dia de Brasília, não o UTC", () => {
    expect(todayInBrasilia(new Date("2026-11-11T01:30:00Z"))).toBe("2026-11-10");
  });

  it("conta os dias até o próximo aniversário, virando o ano", () => {
    expect(daysUntilAnniversary("1990-11-10", "2026-11-10")).toBe(0);
    expect(daysUntilAnniversary("1990-11-12", "2026-11-10")).toBe(2);
    expect(daysUntilAnniversary("1990-01-05", "2026-12-30")).toBe(6);
    expect(daysUntilAnniversary("1990-11-09", "2026-11-10")).toBe(364);
  });

  it("quem nasceu em 29/02 comemora em 28/02 nos anos sem dia 29", () => {
    expect(daysUntilAnniversary("1992-02-29", "2027-02-27")).toBe(1);
    expect(daysUntilAnniversary("1992-02-29", "2028-02-27")).toBe(2);
  });

  it("data inválida não vira aniversário", () => {
    expect(daysUntilAnniversary("", "2026-11-10")).toBeNull();
  });

  it("descreve o tempo de casa", () => {
    expect(tenureLabel("2024-08-10", "2026-11-10")).toBe("2 anos e 3 meses");
    expect(tenureLabel("2025-11-11", "2026-11-10")).toBe("11 meses");
    expect(tenureLabel("2025-11-10", "2026-11-10")).toBe("1 ano");
    expect(tenureLabel("2026-11-01", "2026-11-10")).toBe("menos de 1 mês");
    expect(tenureLabel("2026-12-01", "2026-11-10")).toBeNull();
  });

  it("formata datas curtas e intervalos", () => {
    expect(shortDate("2026-12-17", "2026-11-10")).toBe("17 dez");
    expect(shortDate("2027-01-04", "2026-11-10")).toBe("4 jan 2027");
    expect(daysBetween("2026-11-10", "2026-12-17")).toBe(37);
  });
});
