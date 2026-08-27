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

  it("não inclui Meus Clientes/RH no Marketing completo", () => {
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/meus-clientes");
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/rh");
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/ferias");
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/cafe-cultura");
  });

  it("mantém o Café com Cultura no preset administrativo", () => {
    expect(ACCESS_PRESETS.Administrador).toContain("/cafe-cultura");
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

  it("marca Meus Clientes e RH como manual-only", () => {
    expect(isManualOnlyKey("/meus-clientes")).toBe(true);
    expect(isManualOnlyKey("/rh")).toBe(true);
    expect(isManualOnlyKey("/ferias")).toBe(false);
    expect(isManualOnlyKey("/planner")).toBe(false);
  });

  it("permissão /rh libera /rh/ferias e /rh/qualificacoes", () => {
    const rh = { role: null, permissions: ["/rh"] };
    expect(canAccessPath(rh, "/rh")).toBe(true);
    expect(canAccessPath(rh, "/rh/ferias")).toBe(true);
    expect(canAccessPath(rh, "/rh/qualificacoes")).toBe(true);
    expect(canAccessPath(rh, "/planner")).toBe(false);
  });

  it("permissão legada /ferias ainda libera rotas de RH", () => {
    const legado = { role: null, permissions: ["/ferias"] };
    expect(canAccessPath(legado, "/rh/ferias")).toBe(true);
    expect(canAccessPath(legado, "/ferias")).toBe(true);
  });

  it("viewer de férias acessa somente Férias, não Qualificações", () => {
    const viewer = {
      role: null,
      permissions: ["/conteudo/roteiros"],
      ferias_view_enabled: true,
    };
    expect(canAccessPath(viewer, "/rh")).toBe(true);
    expect(canAccessPath(viewer, "/rh/ferias")).toBe(true);
    expect(canAccessPath(viewer, "/ferias")).toBe(true);
    expect(canAccessPath(viewer, "/rh/qualificacoes")).toBe(false);
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

  it("qualquer autenticado acessa Minhas fotos, mesmo com permissões restritas", () => {
    const colaborador = { role: null, permissions: ["/conteudo/roteiros"] };
    expect(canAccessPath(colaborador, "/minhas-fotos")).toBe(true);
    expect(canAccessPath(colaborador, "/fotos-colaboradores")).toBe(false);
  });

  it("qualquer autenticado acessa o check-in do Café com Cultura", () => {
    const colaborador = { role: null, permissions: ["/conteudo/roteiros"] };
    expect(canAccessPath(colaborador, "/cafe-com-cultura")).toBe(true);
    expect(canAccessPath(colaborador, "/cafe-cultura")).toBe(false);
  });

  it("admin gerencia Fotos Colaboradores mesmo sem a chave no catálogo", () => {
    const admin = { id: "admin-1", role: "admin", permissions: null };
    expect(canAccessPath(admin, "/fotos-colaboradores")).toBe(true);
    expect(canAccessPath(admin, "/minhas-fotos")).toBe(true);
  });
});
