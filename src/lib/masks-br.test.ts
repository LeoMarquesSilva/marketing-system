import { describe, expect, it } from "vitest";
import { isValidCPF, maskCEP, maskCPF, maskOAB, onlyDigits } from "@/lib/masks-br";

describe("masks-br", () => {
  it("mascara CPF e CEP", () => {
    expect(maskCPF("45125957836")).toBe("451.259.578-36");
    expect(maskCEP("13100011")).toBe("13100-011");
    expect(onlyDigits("451.259.578-36")).toBe("45125957836");
  });

  it("mascara OAB com milhar", () => {
    expect(maskOAB("497646")).toBe("497.646");
  });

  it("valida dígitos verificadores do CPF", () => {
    expect(isValidCPF("451.259.578-36")).toBe(true);
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("123")).toBe(false);
  });
});
