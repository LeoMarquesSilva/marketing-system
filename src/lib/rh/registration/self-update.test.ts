import { describe, expect, it } from "vitest";
import { prefillSelfAnswers, type PrefillEmployee, type PrefillQualification } from "./self-prefill";
import {
  emptyRegistrationAnswers,
  employmentTypeLabel,
  registrationKindForEmploymentType,
  type RegistrationAnswers,
} from "./types";
import { missingRegistrationFields, normalizeRegistrationAnswers, validateRegistrationAnswers } from "./validation";

const NOW = new Date("2026-10-19T12:00:00Z");

const EMPLOYEE: PrefillEmployee = {
  full_name: "Ana Souza",
  cpf: "52998224725",
  rg: "12.345.678-9",
  birth_date: "1990-04-10",
  gender: "F",
  oab_number: "123456",
  oab_uf: "sp",
};

function qualification(overrides: Partial<PrefillQualification> = {}): PrefillQualification {
  return {
    full_name: null,
    birth_date: null,
    nationality: "brasileira",
    treatment_gender: null,
    cpf: null,
    rg: null,
    rg_issuer: "ssp/sp",
    oab_number: null,
    oab_uf: null,
    cep: "01310100",
    street: "Av. Paulista",
    number: "1000",
    complement: null,
    district: "Bela Vista",
    city: "São Paulo",
    state: "sp",
    personal_phone: "11988887777",
    personal_email: "Ana@Example.com",
    ...overrides,
  };
}

function complete(overrides: Partial<RegistrationAnswers> = {}): RegistrationAnswers {
  return {
    ...emptyRegistrationAnswers(),
    fullName: "Ana Souza",
    birthDate: "1990-04-10",
    gender: "feminino",
    parentName: "Maria Souza",
    rg: "12.345.678-9",
    rgIssuer: "SSP/SP",
    cpf: "529.982.247-25",
    birthplace: "Campinas/SP",
    raceColor: "parda",
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

describe("registrationKindForEmploymentType", () => {
  it("leva cada vínculo do VIOS para a ficha certa", () => {
    expect(registrationKindForEmploymentType("CLT")).toBe("clt");
    expect(registrationKindForEmploymentType("ASSISTENTE")).toBe("clt");
    expect(registrationKindForEmploymentType("ESTAGIÁRIO")).toBe("estagio");
    expect(registrationKindForEmploymentType("SÓCIO DE SERVIÇO")).toBe("socio_servico");
    expect(registrationKindForEmploymentType("SÓCIO COTISTA")).toBe("socio_servico");
    expect(registrationKindForEmploymentType("sócio patrimonial")).toBe("socio_servico");
    expect(registrationKindForEmploymentType("PRESTADOR")).toBe("prestador");
    expect(registrationKindForEmploymentType(null)).toBe("geral");
    expect(registrationKindForEmploymentType("TERCEIRIZADO")).toBe("geral");
  });

  it("mostra à pessoa o nome do vínculo do VIOS", () => {
    expect(employmentTypeLabel("SÓCIO COTISTA", "socio_servico")).toBe("Sócio cotista");
    expect(employmentTypeLabel(null, "geral")).toBe("Sem vínculo definido");
  });
});

describe("prefillSelfAnswers", () => {
  it("junta qualificação e cadastro do VIOS, formatando para a ficha", () => {
    const answers = prefillSelfAnswers(null, qualification(), EMPLOYEE);
    expect(answers.fullName).toBe("Ana Souza");
    expect(answers.cpf).toBe("529.982.247-25");
    expect(answers.gender).toBe("feminino");
    expect(answers.nationality).toBe("Brasileira");
    expect(answers.rgIssuer).toBe("SSP/SP");
    expect(answers.cep).toBe("01310-100");
    expect(answers.state).toBe("SP");
    expect(answers.personalPhone).toBe("(11) 98888-7777");
    expect(answers.personalEmail).toBe("ana@example.com");
    expect(answers.oabNumber).toBe("123.456");
    expect(answers.oabUf).toBe("SP");
    // O que o escritório não tem continua em branco.
    expect(answers.bankName).toBe("");
    expect(answers.dietaryRestrictions).toEqual([]);
  });

  it("a ficha anterior da pessoa vence as outras fontes", () => {
    const previous = { ...emptyRegistrationAnswers(), city: "Campinas", bankName: "Banco Y" };
    const answers = prefillSelfAnswers(previous, qualification(), EMPLOYEE);
    expect(answers.city).toBe("Campinas");
    expect(answers.bankName).toBe("Banco Y");
    expect(answers.street).toBe("Av. Paulista");
  });

  it("sem qualificação, usa o cadastro do VIOS e assume nacionalidade brasileira", () => {
    const answers = prefillSelfAnswers(null, null, { ...EMPLOYEE, cpf: "123" });
    expect(answers.cpf).toBe("");
    expect(answers.nationality).toBe("Brasileira");
    expect(answers.birthDate).toBe("1990-04-10");
  });
});

describe("missingRegistrationFields", () => {
  it("lista só o que falta, na ordem da ficha", () => {
    const answers = prefillSelfAnswers(null, qualification(), EMPLOYEE);
    expect(missingRegistrationFields(answers, "socio_servico", NOW)).toEqual([
      "parentName",
      "birthplace",
      "raceColor",
      "emergencyPhone",
      "dietaryRestrictions",
      "bankName",
      "bankAgency",
      "bankAccount",
    ]);
  });

  it("ficha completa não tem pendência", () => {
    expect(missingRegistrationFields(complete(), "geral", NOW)).toEqual([]);
  });
});

describe("prestador e sem vínculo", () => {
  it("não exigem CTPS, PIS nem OAB", () => {
    expect(validateRegistrationAnswers(complete(), "prestador", NOW)).toEqual({});
  });

  it("aceitam OAB opcional, mas exigem o par número + UF", () => {
    const partial = normalizeRegistrationAnswers(complete({ oabNumber: "123.456" }), "prestador");
    expect(validateRegistrationAnswers(partial, "prestador", NOW).oabUf).toBeDefined();
    const full = normalizeRegistrationAnswers(complete({ oabNumber: "123.456", oabUf: "SP" }), "geral");
    expect(full.oabNumber).toBe("123.456");
    expect(validateRegistrationAnswers(full, "geral", NOW)).toEqual({});
  });

  it("CLT continua descartando a OAB", () => {
    const answers = normalizeRegistrationAnswers(complete({ oabNumber: "123.456", oabUf: "SP" }), "clt");
    expect(answers.oabNumber).toBe("");
  });
});
