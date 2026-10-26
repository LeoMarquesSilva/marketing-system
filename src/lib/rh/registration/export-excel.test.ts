import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx-js-style";
import { emptyRegistrationAnswers, type EmployeeRegistrationRow } from "./types";

vi.mock("server-only", () => ({}));

const { buildRegistrationsWorkbook } = await import("./export-excel");

const ROW: EmployeeRegistrationRow = {
  employeeId: "e1",
  fullName: "Pessoa Exemplo",
  email: "exemplo@example.com",
  avatarUrl: null,
  department: "Cível",
  position: "Analista",
  employmentType: "CLT",
  vinculoLabel: "CLT",
  kind: "clt",
  isActive: true,
  admissionDate: null,
  formId: null,
  formOrigin: null,
  status: "sem_envio",
  submittedAt: null,
  approvedAt: null,
  requiredCount: 26,
  filledCount: 4,
  missingFields: ["parentName"],
  gender: "feminino",
  raceColor: "",
  age: 34,
  residenceCity: "Campinas",
  residenceState: "SP",
  dietaryRestrictions: [],
  oab: "sim",
};

describe("buildRegistrationsWorkbook", () => {
  it("gera título, grupos, cabeçalho com filtro e painel congelado", async () => {
    const data = await buildRegistrationsWorkbook(
      [{ row: ROW, answers: { ...emptyRegistrationAnswers(), fullName: "Pessoa Exemplo" } }],
      new Date("2026-10-20T12:00:00Z")
    );
    const wb = XLSX.read(new Uint8Array(data), { type: "array" });
    const ws = wb.Sheets["Fichas cadastrais"];
    expect(ws.A1.v).toBe("Fichas cadastrais — Bismarchi | Pires");
    expect(String(ws.A2.v)).toContain("1 colaborador ·");
    expect(ws.A3.v).toBe("Colaborador");
    expect(ws.A4.v).toBe("Nome");
    expect(ws.A5.v).toBe("Pessoa Exemplo");
    expect(ws["!autofilter"]?.ref.startsWith("A4:")).toBe(true);

    const xml = await (await JSZip.loadAsync(data)).file("xl/worksheets/sheet1.xml")?.async("string");
    expect(xml).toContain('state="frozen"');
    expect(xml).toContain('ySplit="4"');
  });
});
