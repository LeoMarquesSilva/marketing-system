import { describe, expect, it } from "vitest";
import { maskBankAccount, maskBankAgency, maskEmail, maskPersonName } from "@/lib/masks-br";
import { joinUf, maskIssuerAcronym, splitUf } from "./format";

describe("splitUf / joinUf", () => {
  it("separa pela barra e junta de volta", () => {
    expect(splitUf("SSP/SP")).toEqual({ head: "SSP", uf: "SP" });
    expect(splitUf("/SP")).toEqual({ head: "", uf: "SP" });
    expect(joinUf("Campinas", "SP")).toBe("Campinas/SP");
    expect(joinUf("Campinas", "")).toBe("Campinas");
  });

  it("enquanto a pessoa digita, só a barra separa", () => {
    expect(splitUf("Porto Al")).toEqual({ head: "Porto Al", uf: "" });
    expect(splitUf("Porto Al", { lenient: true })).toEqual({ head: "Porto", uf: "AL" });
  });

  it("modo tolerante entende formatos antigos", () => {
    expect(splitUf("Campinas, sp", { lenient: true })).toEqual({ head: "Campinas", uf: "SP" });
    expect(splitUf("SSP-SP", { lenient: true })).toEqual({ head: "SSP", uf: "SP" });
    expect(splitUf("IFPRJ", { lenient: true, acronym: true })).toEqual({ head: "IFP", uf: "RJ" });
    expect(splitUf("Rio de Janeiro", { lenient: true })).toEqual({ head: "Rio de Janeiro", uf: "" });
  });
});

describe("máscaras", () => {
  it("agência e conta bancária", () => {
    expect(maskBankAgency("0001")).toBe("0001");
    expect(maskBankAgency("12345")).toBe("1234-5");
    expect(maskBankAgency("1234x")).toBe("1234-X");
    expect(maskBankAccount("123456")).toBe("12345-6");
    expect(maskBankAccount("12.345-6")).toBe("12345-6");
    expect(maskBankAccount("1")).toBe("1");
  });

  it("nome, e-mail e órgão emissor", () => {
    expect(maskPersonName("Ana  Souza 2")).toBe("Ana Souza ");
    expect(maskPersonName("D'Ávila-Neto")).toBe("D'Ávila-Neto");
    expect(maskEmail(" Ana@Email.COM ")).toBe("ana@email.com");
    expect(maskIssuerAcronym("ssp-1 ")).toBe("SSP ");
    expect(maskIssuerAcronym("Detrán")).toBe("DETRAN");
  });
});
