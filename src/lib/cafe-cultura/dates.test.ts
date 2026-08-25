import { describe, expect, it } from "vitest";
import {
  buildCafeWindow,
  extractCafeEventDate,
  getCheckinWindowState,
  lastFridayOfMonth,
} from "./dates";

describe("lastFridayOfMonth", () => {
  it("calcula a última sexta-feira do mês", () => {
    expect(lastFridayOfMonth(2026, 7)).toBe("2026-08-28");
    expect(lastFridayOfMonth(2026, 1)).toBe("2026-02-27");
  });

  it("funciona na virada do ano", () => {
    expect(lastFridayOfMonth(2026, 11)).toBe("2026-12-25");
    expect(lastFridayOfMonth(2027, 0)).toBe("2027-01-29");
  });
});

describe("buildCafeWindow", () => {
  it("converte 09h–12h de São Paulo para instantes UTC", () => {
    expect(buildCafeWindow("2026-08-28")).toEqual({
      opensAt: "2026-08-28T12:00:00.000Z",
      closesAt: "2026-08-28T15:00:00.000Z",
    });
  });
});

describe("getCheckinWindowState", () => {
  const opensAt = "2026-08-28T12:00:00.000Z";
  const closesAt = "2026-08-28T15:00:00.000Z";

  it("distingue antes, durante e depois da janela", () => {
    expect(getCheckinWindowState("2026-08-28T11:59:59.000Z", opensAt, closesAt)).toBe("before");
    expect(getCheckinWindowState(opensAt, opensAt, closesAt)).toBe("open");
    expect(getCheckinWindowState("2026-08-28T14:59:59.000Z", opensAt, closesAt)).toBe("open");
    expect(getCheckinWindowState(closesAt, opensAt, closesAt)).toBe("closed");
  });
});

describe("extractCafeEventDate", () => {
  it("extrai DD/MM usando o ano de referência", () => {
    expect(extractCafeEventDate("Ausência no Café com Cultura de 28/08", 2026)).toBe("2026-08-28");
  });

  it("respeita um ano explícito com dois ou quatro dígitos", () => {
    expect(extractCafeEventDate("Café 30/01/27", 2026)).toBe("2027-01-30");
    expect(extractCafeEventDate("Café 30-01-2028", 2026)).toBe("2028-01-30");
  });

  it("rejeita data inválida ou texto sem data", () => {
    expect(extractCafeEventDate("Café 31/02", 2026)).toBeNull();
    expect(extractCafeEventDate("Não poderei comparecer", 2026)).toBeNull();
  });
});
