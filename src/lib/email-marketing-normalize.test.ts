import { describe, expect, it } from "vitest";
import { formatPersonDisplayName, personNameKey } from "@/lib/email-marketing-normalize";

describe("formatPersonDisplayName", () => {
  it("converte ALL CAPS para title case", () => {
    expect(formatPersonDisplayName("ANDRE ANSELMO CASTILHO")).toBe("Andre Anselmo Castilho");
    expect(formatPersonDisplayName("FERNANDA ANSELMO CASTILHO GASPAROTTO")).toBe(
      "Fernanda Anselmo Castilho Gasparotto"
    );
  });

  it("mantém partículas em minúsculas no meio do nome", () => {
    expect(formatPersonDisplayName("MARIA DA SILVA")).toBe("Maria da Silva");
    expect(formatPersonDisplayName("JOSE DE SOUZA")).toBe("Jose de Souza");
  });

  it("preserva deduplicação RD × SIOE após formatação", () => {
    expect(personNameKey(formatPersonDisplayName("ANDRE ANSELMO CASTILHO"))).toBe(
      personNameKey("Andre Anselmo Castilho")
    );
  });
});
