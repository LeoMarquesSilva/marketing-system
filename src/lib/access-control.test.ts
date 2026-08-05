import { describe, expect, it } from "vitest";
import {
  ACCESS_PRESETS,
  canAccessPath,
  canEditPartyInvite,
  isManualOnlyKey,
  normalizePermissionsInput,
  resolveAllowedSections,
} from "@/lib/access-control";

describe("access-control permissions catalog", () => {
  it("expõe preset Gestor Meus Clientes só com a rota manual", () => {
    expect(ACCESS_PRESETS["Gestor Meus Clientes"]).toEqual(["/meus-clientes"]);
  });

  it("não inclui Meus Clientes/Férias no Marketing completo", () => {
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/meus-clientes");
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/ferias");
  });

  it("normaliza array vazio para null (regra legada)", () => {
    expect(normalizePermissionsInput([])).toBeNull();
    expect(normalizePermissionsInput(null)).toBeNull();
  });

  it("filtra chaves inválidas e ordena pelo catálogo", () => {
    expect(normalizePermissionsInput(["/meus-clientes", "/nao-existe", "/planner"])).toEqual([
      "/planner",
      "/meus-clientes",
    ]);
  });

  it("marca Meus Clientes e Férias como manual-only", () => {
    expect(isManualOnlyKey("/meus-clientes")).toBe(true);
    expect(isManualOnlyKey("/ferias")).toBe(true);
    expect(isManualOnlyKey("/planner")).toBe(false);
  });

  it("gestor só com Meus Clientes acessa a rota e não o Planner", () => {
    const gestor = { role: null, permissions: ["/meus-clientes"] };
    expect(canAccessPath(gestor, "/meus-clientes")).toBe(true);
    expect(canAccessPath(gestor, "/planner")).toBe(false);
    expect(resolveAllowedSections(gestor)).toEqual(["/meus-clientes"]);
  });

  it("só admin edita Festa de 10 anos", () => {
    expect(canEditPartyInvite({ role: "admin", permissions: null })).toBe(true);
    expect(canEditPartyInvite({ role: null, permissions: ["/meus-clientes"] })).toBe(false);
  });
});
