import { describe, expect, it } from "vitest";
import {
  employeeMatchesFeriasAccess,
  redactFeriasEmployee,
  resolveFeriasAccess,
} from "@/lib/ferias/access";

describe("resolveFeriasAccess", () => {
  it("mantém RH e admin como editores globais", () => {
    expect(
      resolveFeriasAccess({
        role: null,
        permissions: ["/rh"],
        accessMode: "disabled",
        areaScope: [],
        position: null,
        department: null,
      })
    ).toMatchObject({ level: "editor", areas: null });
  });

  it("libera gerente e coordenador na área canônica do cadastro RH", () => {
    expect(
      resolveFeriasAccess({
        role: null,
        permissions: [],
        accessMode: "auto",
        areaScope: null,
        position: "Gerente",
        department: "Insolvência",
      })
    ).toEqual({ level: "viewer", areas: ["Reestruturação"] });

    expect(
      resolveFeriasAccess({
        role: null,
        permissions: [],
        accessMode: "auto",
        areaScope: null,
        position: "Coordenador",
        department: "Financeiro",
      })
    ).toEqual({ level: "viewer", areas: ["Operações Legais"] });
  });

  it("reconhece supervisores, coordenadores comerciais e sócios de área", () => {
    for (const position of [
      "Supervisor",
      "Coordenador Comercial",
      "Sócio de Área",
      "Sócio Patrimonial",
    ]) {
      expect(
        resolveFeriasAccess({
          role: null,
          permissions: [],
          accessMode: "auto",
          areaScope: null,
          position,
          department: "Cível",
        })
      ).toEqual({ level: "viewer", areas: ["Cível"] });
    }
  });

  it("nega acesso automático a cargos não gestores", () => {
    expect(
      resolveFeriasAccess({
        role: null,
        permissions: [],
        accessMode: "auto",
        areaScope: null,
        position: "Advogado Sênior I",
        department: "Cível",
      })
    ).toEqual({ level: "denied", areas: [] });
  });

  it("aplica desativação e escopo customizado completos", () => {
    expect(
      resolveFeriasAccess({
        role: null,
        permissions: [],
        accessMode: "disabled",
        areaScope: ["Cível"],
        position: "Gerente",
        department: "Cível",
      })
    ).toEqual({ level: "denied", areas: [] });

    expect(
      resolveFeriasAccess({
        role: null,
        permissions: [],
        accessMode: "custom",
        areaScope: ["Cível", "Insolvência"],
        position: null,
        department: null,
      })
    ).toEqual({ level: "viewer", areas: ["Cível", "Reestruturação"] });
  });

  it("usa asterisco para visão global somente leitura", () => {
    expect(
      resolveFeriasAccess({
        role: null,
        permissions: [],
        accessMode: "custom",
        areaScope: ["*"],
        position: "Sócio",
        department: "Sócio",
      })
    ).toEqual({ level: "viewer", areas: null });
  });
});

describe("employeeMatchesFeriasAccess", () => {
  const civelViewer = { level: "viewer" as const, areas: ["Cível"] };

  it("aceita apenas colaboradores dentro do escopo", () => {
    expect(employeeMatchesFeriasAccess("Cível", civelViewer)).toBe(true);
    expect(employeeMatchesFeriasAccess("Trabalhista", civelViewer)).toBe(false);
  });

  it("aceita todas as áreas para editor e viewer global", () => {
    expect(
      employeeMatchesFeriasAccess("Trabalhista", { level: "editor", areas: null })
    ).toBe(true);
    expect(
      employeeMatchesFeriasAccess("Trabalhista", { level: "viewer", areas: null })
    ).toBe(true);
  });
});

describe("redactFeriasEmployee", () => {
  const employee = {
    id: "employee-1",
    user_id: "user-1",
    cpf: "123",
    email: "pessoa@example.com",
    notes: "anotação interna",
    vios_ci: "42",
  };

  it("remove dados pessoais e internos para viewers", () => {
    expect(
      redactFeriasEmployee(employee, { level: "viewer", areas: ["Cível"] })
    ).toEqual({
      ...employee,
      user_id: null,
      cpf: null,
      email: null,
      notes: null,
      vios_ci: null,
    });
  });

  it("preserva a ficha completa para editores", () => {
    expect(
      redactFeriasEmployee(employee, { level: "editor", areas: null })
    ).toEqual(employee);
  });
});
