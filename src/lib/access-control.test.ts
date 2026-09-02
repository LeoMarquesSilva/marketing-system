import { describe, expect, it } from "vitest";
import {
  ACCESS_PRESETS,
  canAccessPath,
  canEditPartyInvite,
  hasCafeCulturaAccess,
  isManualOnlyKey,
  normalizePermissionsInput,
  resolveAllowedSections,
} from "@/lib/access-control";

describe("access-control permissions catalog", () => {
  it("não inclui Meus Clientes/RH no Marketing completo", () => {
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/meus-clientes");
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/rh");
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/ferias");
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/cafe-cultura");
  });

  it("libera Meus Clientes para qualquer autenticado", () => {
    const colaborador = { role: null, permissions: ["/conteudo/roteiros"] };
    expect(canAccessPath(colaborador, "/meus-clientes")).toBe(true);
    expect(canAccessPath(colaborador, "/meus-clientes/nps")).toBe(true);
    expect(canAccessPath(colaborador, "/planner")).toBe(false);
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

  it("marca RH e Café com Cultura como liberação manual", () => {
    expect(isManualOnlyKey("/meus-clientes")).toBe(false);
    expect(isManualOnlyKey("/rh")).toBe(true);
    expect(isManualOnlyKey("/cafe-cultura")).toBe(true);
    expect(isManualOnlyKey("/ferias")).toBe(false);
    expect(isManualOnlyKey("/planner")).toBe(false);
  });

  it("libera o painel do Café com Cultura só com a permissão, sem ser admin", () => {
    const user = { role: null, permissions: ["/cafe-cultura"] };
    expect(hasCafeCulturaAccess(user)).toBe(true);
    expect(canAccessPath(user, "/cafe-cultura")).toBe(true);
    expect(canAccessPath(user, "/admin")).toBe(false);
  });

  it("não libera o painel do Café sem a permissão nem cargo admin", () => {
    expect(hasCafeCulturaAccess({ role: "designer", permissions: null })).toBe(false);
    expect(hasCafeCulturaAccess({ role: null, permissions: ["/planner"] })).toBe(false);
    expect(canAccessPath({ role: null, permissions: ["/planner"] }, "/cafe-cultura")).toBe(false);
  });

  it("admin acessa o painel do Café mesmo sem a chave no cadastro", () => {
    expect(hasCafeCulturaAccess({ role: "admin", permissions: null })).toBe(true);
    expect(canAccessPath({ role: "admin" }, "/cafe-cultura")).toBe(true);
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

  it("gestor só com Meus Clientes nas permissions ainda acessa a rota e não o Planner", () => {
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
