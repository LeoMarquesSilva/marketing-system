import { describe, expect, it } from "vitest";
import { buildQualificationText } from "@/lib/rh/qualifications/text";

describe("buildQualificationText", () => {
  it("gera o parágrafo completo no feminino", () => {
    const text = buildQualificationText({
      full_name: "Midian Barbosa da Silva",
      nationality: "brasileira",
      marital_status: "solteiro",
      profession: "advogada",
      treatment_gender: "f",
      oab_number: "497.646",
      oab_uf: "SP",
      rg: "56.151.372-7",
      cpf: "45125957836",
      street: "Rua Rafael Andrade Duarte",
      number: "580",
      district: "Jd. Paraíso",
      cep: "13100011",
      city: "Campinas",
      state: "SP",
    });

    expect(text).toBe(
      "MIDIAN BARBOSA DA SILVA, brasileira, solteira, advogada, inscrita na OAB/SP 497.646, portadora do RG nº 56.151.372-7, inscrita no CPF sob o nº 451.259.578-36, residente e domiciliada na Rua Rafael Andrade Duarte, nº 580, Bairro Jd. Paraíso, CEP 13100-011, Campinas/SP;"
    );
  });

  it("flexiona no masculino e omite OAB quando vazia", () => {
    const text = buildQualificationText({
      full_name: "João da Silva",
      nationality: "brasileira",
      marital_status: "casado",
      profession: "advogado",
      treatment_gender: "m",
      rg: "12.345.678-9",
      cpf: "52998224725",
      street: "Av. Paulista",
      number: "1000",
      district: "Bela Vista",
      cep: "01310100",
      city: "São Paulo",
      state: "SP",
    });

    expect(text).toContain("brasileiro, casado, advogado");
    expect(text).toContain("portador do RG");
    expect(text).toContain("inscrito no CPF");
    expect(text).toContain("residente e domiciliado");
    expect(text).not.toContain("OAB");
  });

  it("flexiona nacionalidades fechadas no masculino", () => {
    const text = buildQualificationText({
      full_name: "Mario Rossi",
      nationality: "italiana",
      treatment_gender: "m",
    });

    expect(text).toContain("italiano");
  });

  it("retorna string vazia sem dados", () => {
    expect(buildQualificationText({})).toBe("");
  });
});
