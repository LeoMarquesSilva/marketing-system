import { describe, expect, it } from "vitest";
import {
  diffQualificationContact,
  qualificationContactPatch,
  type QualificationContact,
} from "./qualification-sync";
import { emptyRegistrationAnswers, type RegistrationAnswers } from "./types";

function qualification(overrides: Partial<QualificationContact> = {}): QualificationContact {
  return {
    rg: "12.345.678-9",
    rg_issuer: "ssp/sp",
    cep: "01310100",
    street: "Av. Paulista",
    number: "1000",
    complement: "Apto 12",
    district: "Bela Vista",
    city: "São Paulo",
    state: "sp",
    personal_phone: "(11) 98888-7777",
    personal_email: "Ana@Example.com",
    ...overrides,
  };
}

/** Ficha como a pessoa envia depois do pré-preenchimento a partir da qualificação. */
function answers(overrides: Partial<RegistrationAnswers> = {}): RegistrationAnswers {
  return {
    ...emptyRegistrationAnswers(),
    rg: "12.345.678-9",
    rgIssuer: "SSP/SP",
    cep: "01310-100",
    street: "Av. Paulista",
    number: "1000",
    complement: "Apto 12",
    district: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    personalPhone: "(11) 98888-7777",
    personalEmail: "ana@example.com",
    ...overrides,
  };
}

describe("diffQualificationContact", () => {
  it("não aponta mudança quando só o formato difere", () => {
    expect(
      diffQualificationContact(
        qualification({ rg: "123456789", personal_phone: "11988887777", street: "Av.  Paulista " }),
        answers()
      )
    ).toEqual([]);
  });

  it("lista endereço novo com o valor atual e o novo prontos para leitura", () => {
    const changes = diffQualificationContact(
      qualification(),
      answers({
        cep: "13010-111",
        street: "Rua Barão de Jaguara",
        number: "50",
        complement: "",
        district: "Centro",
        city: "Campinas",
      })
    );
    expect(changes.map((change) => change.column)).toEqual([
      "cep",
      "street",
      "number",
      "complement",
      "district",
      "city",
    ]);
    expect(changes[0]).toEqual({
      column: "cep",
      label: "CEP",
      current: "01310-100",
      next: "13010-111",
      value: "13010111",
    });
    expect(changes.find((change) => change.column === "number")?.label).toBe("Número do endereço");
  });

  it("limpa o complemento quando a pessoa deixa em branco", () => {
    const [change] = diffQualificationContact(qualification(), answers({ complement: "" }));
    expect(change).toMatchObject({ column: "complement", current: "Apto 12", next: "", value: null });
  });

  it("campo obrigatório vazio na ficha não apaga a qualificação", () => {
    expect(diffQualificationContact(qualification(), answers({ rg: "", city: "", personalEmail: "" }))).toEqual([]);
  });

  it("preenche o que a qualificação ainda não tinha", () => {
    const changes = diffQualificationContact(
      qualification({ rg_issuer: null, personal_phone: null, complement: null }),
      answers({ complement: "" })
    );
    expect(changes).toEqual([
      { column: "rg_issuer", label: "Órgão emissor do RG", current: "", next: "SSP/SP", value: "SSP/SP" },
      {
        column: "personal_phone",
        label: "Telefone particular",
        current: "",
        next: "(11) 98888-7777",
        value: "(11) 98888-7777",
      },
    ]);
  });

  it("grava telefone com máscara, e-mail em minúsculas e UF em maiúsculas", () => {
    const changes = diffQualificationContact(
      qualification(),
      answers({ personalPhone: "19 3333-4444", personalEmail: " Ana.Nova@Example.com ", state: "mg", rg: "MG-12.345.678" })
    );
    expect(qualificationContactPatch(changes)).toEqual({
      rg: "MG-12.345.678",
      state: "MG",
      personal_phone: "(19) 3333-4444",
      personal_email: "ana.nova@example.com",
    });
  });

  it("órgão emissor com outra caixa não conta como mudança", () => {
    expect(diffQualificationContact(qualification({ rg_issuer: "Ssp / sp" }), answers({ rgIssuer: "SSP / SP" }))).toEqual(
      []
    );
  });
});
