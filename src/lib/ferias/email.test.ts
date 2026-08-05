import { describe, expect, it } from "vitest";
import { hrEmailsMatch, normalizeHrEmail } from "@/lib/ferias/email";

describe("normalizeHrEmail", () => {
  it("equaliza bpplaw e bismarchipires", () => {
    expect(normalizeHrEmail("Ana.Tavares@bismarchipires.com.br")).toBe(
      "ana.tavares@bpplaw.com.br"
    );
    expect(normalizeHrEmail("ana.tavares@bpplaw.com.br")).toBe("ana.tavares@bpplaw.com.br");
    expect(
      hrEmailsMatch("ana.tavares@bismarchipires.com.br", "Ana.Tavares@bpplaw.com.br")
    ).toBe(true);
  });

  it("retorna null para vazio", () => {
    expect(normalizeHrEmail(null)).toBeNull();
    expect(normalizeHrEmail("   ")).toBeNull();
  });
});
