import { describe, expect, it } from "vitest";
import { EXPORT_COLUMNS, exportColumnGroups, exportFilename, exportRows, formatDateBR } from "./export";
import { emptyRegistrationAnswers, employeeFichaStatus, type EmployeeRegistrationRow } from "./types";

const ROW: EmployeeRegistrationRow = {
  employeeId: "e1",
  fullName: "Ana Souza",
  email: "ana@bismarchipires.com.br",
  avatarUrl: null,
  department: "Cível",
  position: "Advogada",
  employmentType: "SÓCIO DE SERVIÇO",
  vinculoLabel: "Sócio de serviço",
  kind: "socio_servico",
  isActive: true,
  admissionDate: "2024-03-01",
  formId: "f1",
  formOrigin: "atualizacao",
  status: "para_revisar",
  submittedAt: "2026-10-19T15:00:00Z",
  approvedAt: null,
  requiredCount: 24,
  filledCount: 22,
  missingFields: ["bankName", "bankAgency"],
  gender: "feminino",
  raceColor: "",
  age: 34,
  residenceCity: "Campinas",
  residenceState: "SP",
  dietaryRestrictions: [],
  oab: "sim",
};

function column(header: string): number {
  return EXPORT_COLUMNS.findIndex((item) => item.header === header);
}

describe("planilha de fichas cadastrais", () => {
  it("formata rótulos, datas e pendências para leitura", () => {
    const [values] = exportRows([
      {
        row: ROW,
        answers: {
          ...emptyRegistrationAnswers(),
          birthDate: "1990-04-10",
          gender: "feminino",
          raceColor: "parda",
          dietaryRestrictions: ["vegano", "alergia"],
          dietaryNotes: "amendoim",
          oabNumber: "123.456",
          oabUf: "SP",
        },
      },
    ]);
    expect(values[column("Nome")]).toBe("Ana Souza");
    expect(values[column("Admissão")]).toBe("01/03/2024");
    expect(values[column("Situação da ficha")]).toBe("Para revisar");
    expect(values[column("Preenchimento")]).toBe("22 de 24");
    expect(values[column("O que falta")]).toBe("Banco, Agência");
    expect(values[column("Origem")]).toBe("Atualização");
    expect(values[column("Enviada em")]).toBe("19/10/2026");
    expect(values[column("Nascimento")]).toBe("10/04/1990");
    expect(values[column("Gênero")]).toBe("Feminino");
    expect(values[column("Raça/cor")]).toBe("Parda");
    expect(values[column("Tem OAB")]).toBe("Sim");
    expect(values[column("Restrição alimentar")]).toBe("Vegano, Alergia alimentar");
  });

  it("agrupa as colunas como na ficha", () => {
    const groups = exportColumnGroups().map((group) => group.group);
    expect(groups).toEqual([
      "Colaborador",
      "Ficha",
      "Dados pessoais",
      "Complementares",
      "Contato",
      "Saúde e alimentação",
      "Dados bancários",
      "Endereço",
    ]);
  });

  it("nome do arquivo com a data de Brasília", () => {
    expect(exportFilename(new Date("2026-10-20T02:00:00Z"))).toBe("fichas-cadastrais-2026-10-19.xlsx");
    expect(formatDateBR(null)).toBe("");
  });
});

describe("situação da ficha do colaborador", () => {
  it("vem do status da ficha vinculada", () => {
    expect(employeeFichaStatus(null)).toBe("sem_envio");
    expect(employeeFichaStatus({ status: "cancelada" })).toBe("sem_envio");
    expect(employeeFichaStatus({ status: "pendente", reopen_note: null })).toBe("aguardando");
    expect(employeeFichaStatus({ status: "pendente", reopen_note: "Falta o dígito" })).toBe("devolvida");
    expect(employeeFichaStatus({ status: "recebida" })).toBe("para_revisar");
    expect(employeeFichaStatus({ status: "aprovada" })).toBe("aprovada");
  });
});
