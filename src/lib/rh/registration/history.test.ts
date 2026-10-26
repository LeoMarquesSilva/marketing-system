import { describe, expect, it } from "vitest";
import {
  coerceChanges,
  diffAnswers,
  fieldsForKind,
  firstField,
  flaggedItems,
  formatAnswerValue,
  sanitizeFields,
  untouchedFields,
} from "./history";
import { emptyRegistrationAnswers, type RegistrationAnswers } from "./types";

function answers(overrides: Partial<RegistrationAnswers> = {}): RegistrationAnswers {
  return { ...emptyRegistrationAnswers(), ...overrides };
}

describe("sanitizeFields", () => {
  it("mantém só campos conhecidos, sem repetir, na ordem da ficha", () => {
    expect(sanitizeFields(["bankAccount", "cpf", "xpto", 3, "cpf"])).toEqual(["cpf", "bankAccount"]);
  });

  it("devolve vazio para o que não é lista", () => {
    expect(sanitizeFields(null)).toEqual([]);
    expect(sanitizeFields("cpf")).toEqual([]);
  });
});

describe("fieldsForKind", () => {
  it("só traz os campos do vínculo", () => {
    expect(fieldsForKind("clt")).toContain("ctpsNumber");
    expect(fieldsForKind("clt")).not.toContain("studentRa");
    expect(fieldsForKind("estagio")).toContain("studentRa");
  });
});

describe("diffAnswers", () => {
  it("lista só o que mudou, ignorando espaços e a ordem das restrições", () => {
    const before = answers({ bankAccount: "1234-5", street: "Rua A", dietaryRestrictions: ["vegano", "lactose"] });
    const after = answers({ bankAccount: "12345-6", street: " Rua A ", dietaryRestrictions: ["lactose", "vegano"] });
    expect(diffAnswers(before, after)).toEqual([{ field: "bankAccount", before: "1234-5", after: "12345-6" }]);
  });

  it("registra campo apagado", () => {
    expect(diffAnswers(answers({ pixKey: "ana@x.com" }), answers())).toEqual([
      { field: "pixKey", before: "ana@x.com", after: "" },
    ]);
  });
});

describe("untouchedFields", () => {
  it("aponta o campo pedido que continuou igual", () => {
    expect(untouchedFields(["bankAgency", "bankAccount"], ["bankAccount"])).toEqual(["bankAgency"]);
  });

  it("mexer em um campo do grupo conta para o grupo todo", () => {
    expect(untouchedFields(["hasOab", "oabNumber", "oabUf"], ["oabNumber"])).toEqual([]);
    expect(untouchedFields(["city", "state", "cep"], ["state"])).toEqual(["cep"]);
  });
});

describe("flaggedItems", () => {
  it("junta o grupo marcado inteiro num item só", () => {
    expect(flaggedItems(["oabUf", "cpf", "hasOab", "oabNumber"])).toEqual([
      { field: "cpf", label: "CPF", fields: ["cpf"] },
      { field: "hasOab", label: "OAB", fields: ["hasOab", "oabNumber", "oabUf"] },
    ]);
  });

  it("grupo pela metade mostra cada campo", () => {
    expect(flaggedItems(["state"]).map((item) => item.label)).toEqual(["UF"]);
  });
});

describe("firstField", () => {
  it("escolhe o primeiro na ordem do formulário", () => {
    expect(firstField(["bankAccount", "cpf", "cep"])).toBe("cpf");
    expect(firstField([])).toBeNull();
  });
});

describe("coerceChanges", () => {
  it("descarta itens inválidos do jsonb", () => {
    expect(
      coerceChanges([{ field: "cpf", before: "1", after: "2" }, { field: "nope" }, null, { field: "rg", after: 5 }])
    ).toEqual([
      { field: "cpf", before: "1", after: "2" },
      { field: "rg", before: "", after: "" },
    ]);
  });
});

describe("formatAnswerValue", () => {
  it("formata data e restrições", () => {
    expect(formatAnswerValue("birthDate", "1990-04-10")).toBe("10/04/1990");
    expect(formatAnswerValue("dietaryRestrictions", "nenhuma")).toBe("Nenhuma restrição");
  });
});
