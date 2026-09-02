import { describe, expect, it } from "vitest";
import {
  backNUtil,
  fatalProtocolarDate,
  toISODate,
  unaDefesaDate,
  unaProtocolarDate,
} from "./calendar";

describe("calendar rules", () => {
  it("backNUtil recua fins de semana", () => {
    // sexta 2026-08-14 → 1 útil antes = quinta 13
    const d = backNUtil(new Date(2026, 7, 14), 1);
    expect(toISODate(d)).toBe("2026-08-13");
    // segunda 2026-08-17 → 1 útil antes = sexta 14
    const d2 = backNUtil(new Date(2026, 7, 17), 1);
    expect(toISODate(d2)).toBe("2026-08-14");
  });

  it("UNA protocolar e defesa", () => {
    // aud quarta 2026-08-12 → D-2 = segunda 10; FATAL=terça 11; prot != fatal
    expect(unaProtocolarDate("2026-08-12")).toBe("2026-08-10");
    expect(unaDefesaDate("2026-08-12")).toBe("2026-08-06");
  });

  it("FATAL-1 útil", () => {
    expect(fatalProtocolarDate("2026-08-17")).toBe("2026-08-14");
  });
});
