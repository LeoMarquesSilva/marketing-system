import { describe, expect, it } from "vitest";
import {
  ACCESS_PRESETS,
  canAccessPath,
  canSeeTeamPosts,
  canEditPartyInvite,
  firstAllowedPath,
  hasCafeCulturaAccess,
  hasIcpAccess,
  hasOperacoesLegaisAccess,
  hasVistagemAccess,
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
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/operacoes-legais");
  });

  it("inclui Operações Legais só no preset Administrador", () => {
    expect(ACCESS_PRESETS.Administrador).toContain("/operacoes-legais");
    expect(isManualOnlyKey("/operacoes-legais")).toBe(true);
  });

  it("libera Operações Legais somente para admin", () => {
    expect(hasOperacoesLegaisAccess({ role: "admin" })).toBe(true);
    expect(canAccessPath({ role: "admin" }, "/operacoes-legais")).toBe(true);
    expect(canAccessPath({ role: "admin" }, "/operacoes-legais/vistagem")).toBe(true);
    expect(hasOperacoesLegaisAccess({ role: null, permissions: ["/operacoes-legais"] })).toBe(false);
    expect(canAccessPath({ role: null, permissions: ["/operacoes-legais"] }, "/operacoes-legais")).toBe(
      false
    );
    expect(canAccessPath({ role: "designer", permissions: null }, "/operacoes-legais")).toBe(false);
  });

  it("libera a Vistagem para admin e para quem tem a chave marcada", () => {
    expect(isManualOnlyKey("/operacoes-legais/vistagem")).toBe(true);
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/operacoes-legais/vistagem");
    expect(hasVistagemAccess({ role: "admin" })).toBe(true);
    const vistador = { role: null, permissions: ["/operacoes-legais/vistagem"] };
    expect(hasVistagemAccess(vistador)).toBe(true);
    expect(canAccessPath(vistador, "/operacoes-legais/vistagem")).toBe(true);
    expect(canAccessPath(vistador, "/operacoes-legais/vistagem/juridico")).toBe(true);
    expect(canAccessPath(vistador, "/operacoes-legais")).toBe(false);
    expect(canAccessPath(vistador, "/planner")).toBe(false);
    expect(firstAllowedPath(vistador)).toBe("/operacoes-legais/vistagem");
  });

  it("não libera a Vistagem pelo modo legado nem pela chave de Operações Legais", () => {
    expect(hasVistagemAccess({ role: "designer", permissions: null })).toBe(false);
    expect(hasVistagemAccess({ role: null, permissions: ["/operacoes-legais"] })).toBe(false);
    expect(canAccessPath({ role: "designer", permissions: null }, "/operacoes-legais/vistagem")).toBe(false);
  });

  it("libera o ICP para admin e para quem tem a chave marcada", () => {
    expect(hasIcpAccess({ role: "admin" })).toBe(true);
    expect(canAccessPath({ role: "admin" }, "/icp")).toBe(true);
    expect(canAccessPath({ role: null, permissions: ["/icp", "/"] }, "/icp")).toBe(true);
    expect(normalizePermissionsInput(["/icp"])).toEqual(["/icp"]);
    expect(isManualOnlyKey("/icp")).toBe(true);
    expect(ACCESS_PRESETS["Marketing completo"]).not.toContain("/icp");
  });

  it("não libera o ICP pelo modo legado nem por outras chaves", () => {
    expect(hasIcpAccess(null)).toBe(false);
    expect(canAccessPath({ role: "designer", permissions: null }, "/icp")).toBe(false);
    expect(canAccessPath({ role: null, permissions: ["/", "/planner"] }, "/icp")).toBe(false);
  });

  it("perfil só com ICP cai direto no ICP e não vê o resto", () => {
    const icpOnly = { role: null, permissions: ["/icp"] };
    expect(canAccessPath(icpOnly, "/icp")).toBe(true);
    expect(canAccessPath(icpOnly, "/")).toBe(false);
    expect(canAccessPath(icpOnly, "/planner")).toBe(false);
    expect(firstAllowedPath(icpOnly)).toBe("/icp");
  });

  it("perfil ICP + conteúdo vê ICP, conteúdo e fotos, mas não gerencia a galeria", () => {
    const perfil = {
      role: null,
      permissions: ["/conteudo/roteiros", "/conteudo/boletim", "/conteudo/reels", "/icp"],
    };
    expect(canAccessPath(perfil, "/icp")).toBe(true);
    expect(canAccessPath(perfil, "/conteudo/inicio")).toBe(true);
    expect(canAccessPath(perfil, "/conteudo/boletim")).toBe(true);
    expect(canAccessPath(perfil, "/minhas-fotos")).toBe(true);
    expect(canAccessPath(perfil, "/fotos-eventos")).toBe(true);
    expect(canAccessPath(perfil, "/fotos-colaboradores")).toBe(false);
    expect(canAccessPath(perfil, "/planner")).toBe(false);
    expect(firstAllowedPath(perfil)).toBe("/conteudo/inicio");
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

  it("chave legada /ferias sozinha não libera mais rotas de RH (migrada para /rh)", () => {
    const legado = { role: null, permissions: ["/ferias"] };
    expect(canAccessPath(legado, "/rh/ferias")).toBe(false);
    expect(canAccessPath(legado, "/ferias")).toBe(false);
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

  it("qualquer autenticado vê os álbuns de Fotos de eventos", () => {
    const colaborador = { role: null, permissions: ["/conteudo/roteiros"] };
    expect(canAccessPath(colaborador, "/fotos-eventos")).toBe(true);
    expect(canAccessPath(colaborador, "/fotos-eventos/cafe-com-cultura-setembro-2026")).toBe(true);
  });

  it("qualquer autenticado pode abrir um briefing que será autorizado pelo banco", () => {
    const colaborador = { role: null, permissions: ["/conteudo/roteiros"] };
    expect(canAccessPath(colaborador, "/briefings/identidade-visual/pedido-1")).toBe(true);
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

  it("Postagens da equipe: líder de área e Marketing, nunca colaborador sem liderança", () => {
    const lider = { role: null, permissions: ["/conteudo/roteiros"], ferias_view_enabled: true };
    expect(canAccessPath(lider, "/postagens-equipe")).toBe(true);
    expect(canAccessPath({ role: "admin" }, "/postagens-equipe")).toBe(true);
    expect(canSeeTeamPosts({ role: "designer", permissions: null })).toBe(true);
    expect(canSeeTeamPosts({ role: null, permissions: ["/planner"], department: "Marketing" })).toBe(true);
    expect(canSeeTeamPosts({ role: null, permissions: ["/instagram-insights"] })).toBe(true);
    expect(canAccessPath({ role: null, permissions: ["/conteudo/roteiros"] }, "/postagens-equipe")).toBe(false);
    expect(canAccessPath({ role: null, permissions: ["/rh"] }, "/postagens-equipe")).toBe(false);
  });

  it("libera a página de download das peças para qualquer usuário logado", () => {
    const socio = { role: null, department: "Sócio", permissions: ["/conteudo/inicio", "/meus-clientes"] };
    expect(canAccessPath(socio, "/entregas/oab")).toBe(true);
    expect(canAccessPath({ role: "designer", permissions: null }, "/entregas/dc")).toBe(true);
  });

  it("libera a atualização da própria ficha cadastral para qualquer usuário logado", () => {
    const socio = { role: null, department: "Sócio", permissions: ["/conteudo/inicio", "/meus-clientes"] };
    expect(canAccessPath(socio, "/minha-ficha")).toBe(true);
    expect(canAccessPath({ role: null, permissions: ["/conteudo/roteiros"] }, "/minha-ficha")).toBe(true);
    // A tela de revisão continua restrita à RH.
    expect(canAccessPath(socio, "/rh/fichas-cadastrais")).toBe(false);
  });
});
