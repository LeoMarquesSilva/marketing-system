import { describe, expect, it } from "vitest";
import { normalizeRegistrationAnswers, validateRegistrationAnswers } from "./validation";
import { emptyRegistrationAnswers, type RegistrationAnswers } from "./types";

const NOW = new Date("2026-10-05T12:00:00Z");

function validAnswers(overrides: Partial<RegistrationAnswers> = {}): RegistrationAnswers {
  return {
    ...emptyRegistrationAnswers(),
    fullName: "Ana Souza",
    birthDate: "1998-04-10",
    gender: "feminino",
    parentName: "Maria Souza",
    rg: "12.345.678-9",
    rgIssuer: "SSP/SP",
    cpf: "529.982.247-25",
    nationality: "Brasileira",
    birthplace: "Campinas/SP",
    raceColor: "parda",
    pis: "123.45678.90-1",
    personalPhone: "(11) 98888-7777",
    emergencyPhone: "(11) 97777-6666",
    personalEmail: "ana@example.com",
    dietaryRestrictions: ["nenhuma"],
    bankName: "Banco X",
    bankAgency: "0001",
    bankAccount: "12345-6",
    cep: "01310-100",
    street: "Av. Paulista",
    number: "1000",
    district: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    ...overrides,
  };
}

describe("validateRegistrationAnswers", () => {
  it("aceita uma ficha de sócio de serviço completa", () => {
    const answers = validAnswers({ oabNumber: "123.456", oabUf: "SP" });
    expect(validateRegistrationAnswers(answers, "socio_servico", NOW)).toEqual({});
  });

  it("exige CTPS e título de eleitor só para CLT", () => {
    const errors = validateRegistrationAnswers(validAnswers(), "clt", NOW);
    expect(Object.keys(errors).sort()).toEqual(["ctpsNumber", "voterTitle"]);
  });

  it("PIS é opcional fora da CLT, mas validado se informado", () => {
    expect(
      validateRegistrationAnswers(
        validAnswers({ pis: "", institution: "USP", coursePeriod: "5º semestre", studentRa: "123" }),
        "estagio",
        NOW
      )
    ).toEqual({});
    expect(
      validateRegistrationAnswers(
        validAnswers({ pis: "123", institution: "USP", coursePeriod: "5º", studentRa: "1" }),
        "estagio",
        NOW
      ).pis
    ).toBeDefined();
  });

  it("pede detalhe para alergia", () => {
    const errors = validateRegistrationAnswers(
      validAnswers({ dietaryRestrictions: ["alergia"], oabNumber: "1", oabUf: "SP" }),
      "socio_servico",
      NOW
    );
    expect(errors.dietaryNotes).toBeDefined();
  });

  it("recusa CPF inválido", () => {
    const errors = validateRegistrationAnswers(
      validAnswers({ cpf: "111.111.111-11", oabNumber: "1", oabUf: "SP" }),
      "socio_servico",
      NOW
    );
    expect(errors.cpf).toBe("CPF inválido.");
  });
});

describe("normalizeRegistrationAnswers", () => {
  it("descarta campos de outro vínculo e torna 'nenhuma' exclusiva", () => {
    const result = normalizeRegistrationAnswers(
      validAnswers({
        oabNumber: "123",
        studentRa: " 999 ",
        dietaryRestrictions: ["nenhuma", "vegano", "invalida"],
        dietaryNotes: "algo",
      }),
      "estagio"
    );
    expect(result.oabNumber).toBe("");
    expect(result.studentRa).toBe("999");
    expect(result.dietaryRestrictions).toEqual(["vegano"]);
    expect(result.dietaryNotes).toBe("");
  });
});
