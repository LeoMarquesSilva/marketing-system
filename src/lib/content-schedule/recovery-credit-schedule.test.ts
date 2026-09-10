import { describe, expect, it } from "vitest";

import { RECOVERY_CREDIT_2026_SLOTS } from "@/lib/content-schedule/recovery-credit-schedule";

describe("RECOVERY_CREDIT_2026_SLOTS", () => {
  it("contém exatamente os nove slots de recuperação de crédito", () => {
    expect(RECOVERY_CREDIT_2026_SLOTS).toHaveLength(9);
    expect(RECOVERY_CREDIT_2026_SLOTS.map(({ dueDate, format }) => ({ dueDate, format }))).toEqual([
      { dueDate: "2026-10-09", format: "post" },
      { dueDate: "2026-10-14", format: "reel" },
      { dueDate: "2026-10-21", format: "post" },
      { dueDate: "2026-11-11", format: "post" },
      { dueDate: "2026-11-11", format: "reel" },
      { dueDate: "2026-11-19", format: "post" },
      { dueDate: "2026-12-10", format: "post" },
      { dueDate: "2026-12-16", format: "post" },
      { dueDate: "2026-12-16", format: "reel" },
    ]);
  });

  it("gera uma chave distinta para cada slot", () => {
    const sourceKeys = RECOVERY_CREDIT_2026_SLOTS.map(({ sourceKey }) => sourceKey);

    expect(new Set(sourceKeys).size).toBe(9);
  });

  it("usa data e formato na chave com o prefixo obrigatório", () => {
    for (const { dueDate, format, sourceKey } of RECOVERY_CREDIT_2026_SLOTS) {
      expect(sourceKey).toBe(`recovery-credit-2026:${dueDate}:${format}`);
    }
  });
});
