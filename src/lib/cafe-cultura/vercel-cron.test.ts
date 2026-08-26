import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("cron do Café com Cultura na Vercel", () => {
  it("usa uma execução diária compatível com o plano atual", () => {
    const config = JSON.parse(
      readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8")
    ) as { crons?: Array<{ path: string; schedule: string }> };
    const cron = config.crons?.find((item) => item.path === "/api/cron/cafe-cultura-sync");

    expect(cron?.schedule).toBe("0 10 * * *");
  });
});
