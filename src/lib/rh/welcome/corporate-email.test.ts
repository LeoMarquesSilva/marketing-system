import { describe, expect, it } from "vitest";
import { corporateEmail, emailLookupVariants } from "./corporate-email";

describe("corporateEmail", () => {
  it("troca o domínio antigo pelo atual", () => {
    expect(corporateEmail("Leonardo.Marques@BPPLAW.com.br ")).toBe("leonardo.marques@bismarchipires.com.br");
  });

  it("mantém o domínio atual e outros domínios como estão", () => {
    expect(corporateEmail("maria@bismarchipires.com.br")).toBe("maria@bismarchipires.com.br");
    expect(corporateEmail("pessoa@gmail.com")).toBe("pessoa@gmail.com");
  });

  it("vazio e endereço sem domínio não quebram", () => {
    expect(corporateEmail(null)).toBe("");
    expect(corporateEmail("semarroba")).toBe("semarroba");
    expect(corporateEmail("bpplaw.com.br")).toBe("bpplaw.com.br");
  });
});

describe("emailLookupVariants", () => {
  it("procura o cadastro nos dois domínios", () => {
    expect(emailLookupVariants("joao@bpplaw.com.br")).toEqual(["joao@bismarchipires.com.br", "joao@bpplaw.com.br"]);
  });

  it("outros domínios ficam só como estão", () => {
    expect(emailLookupVariants("joao@gmail.com")).toEqual(["joao@gmail.com"]);
  });
});
