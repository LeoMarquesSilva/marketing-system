import { describe, expect, it } from "vitest";
import {
  ACCESS_PRESETS,
  canAccessPath,
  canSeeTeamPosts,
  canSeeVistagemPath,
  canEditPartyInvite,
  entradaDaVistagem,
  firstAllowedPath,
  hasCafeCulturaAccess,
  hasIcpAccess,
  canEditPe27,
  hasOperacoesLegaisAccess,
  hasPe27Access,
  hasTeamSurveysAccess,
  isPe27OnlyProfile,
  hasVistagemAccess,
  isManualOnlyKey,
  normalizePermissionsInput,
  papelVistagem,
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
    expect(firstAllowedPath(vistador)).toBe("/");
  });

  it("o jurídico abre a Visão geral e a aba Vistagem; sem papel ou admin é controladoria", () => {
    const juridico = { role: null, permissions: ["/operacoes-legais/vistagem"], vistagem_papel: "juridico" };
    expect(papelVistagem(juridico)).toBe("juridico");
    expect(canAccessPath(juridico, "/operacoes-legais/vistagem")).toBe(true);
    expect(canAccessPath(juridico, "/operacoes-legais/vistagem/juridico")).toBe(true);
    for (const aba of [
      "/operacoes-legais/vistagem/base",
      "/operacoes-legais/vistagem/controladoria",
      "/operacoes-legais/vistagem/duplicidades",
      "/operacoes-legais/vistagem/conferencia",
      "/operacoes-legais/vistagem/check",
      "/operacoes-legais/vistagem/configuracoes",
    ]) {
      expect(canAccessPath(juridico, aba)).toBe(false);
    }
    // Entra pela tela inicial; no menu, a entrada da Vistagem continua sendo a aba Vistagem.
    expect(firstAllowedPath(juridico)).toBe("/");
    expect(entradaDaVistagem(juridico)).toBe("/operacoes-legais/vistagem/juridico");
    expect(entradaDaVistagem({ role: null, permissions: ["/operacoes-legais/vistagem"] })).toBe("/operacoes-legais/vistagem");
    expect(papelVistagem({ role: null, permissions: ["/operacoes-legais/vistagem"], vistagem_papel: null })).toBe("controladoria");
    expect(papelVistagem({ role: "admin", vistagem_papel: "juridico" })).toBe("controladoria");
    // o papel sozinho não dá acesso
    expect(papelVistagem({ role: null, permissions: ["/planner"], vistagem_papel: "juridico" })).toBeNull();
    expect(canSeeVistagemPath({ role: null, permissions: ["/planner"], vistagem_papel: "juridico" }, "/operacoes-legais/vistagem/juridico")).toBe(false);
  });

  it("configurações da Vistagem só para admin (nem a controladoria abre)", () => {
    const configuracoes = "/operacoes-legais/vistagem/configuracoes";
    expect(canSeeVistagemPath({ role: "admin" }, configuracoes)).toBe(true);
    expect(canSeeVistagemPath({ role: null, permissions: ["/operacoes-legais/vistagem"] }, configuracoes)).toBe(false);
    expect(canSeeVistagemPath({ role: null, permissions: ["/operacoes-legais/vistagem"], vistagem_papel: "juridico" }, configuracoes)).toBe(false);
    expect(canSeeVistagemPath({ role: null, permissions: ["/operacoes-legais/vistagem"] }, "/operacoes-legais/vistagem/conferencia")).toBe(true);
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

  it("perfil só com ICP entra pela tela inicial e não vê o resto", () => {
    const icpOnly = { role: null, permissions: ["/icp"] };
    expect(canAccessPath(icpOnly, "/icp")).toBe(true);
    expect(canAccessPath(icpOnly, "/")).toBe(true);
    expect(canAccessPath(icpOnly, "/painel-marketing")).toBe(false);
    expect(canAccessPath(icpOnly, "/planner")).toBe(false);
    expect(firstAllowedPath(icpOnly)).toBe("/");
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
    expect(firstAllowedPath(perfil)).toBe("/");
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

  it("permissão /rh libera /rh/ferias e /rh/fichas-cadastrais", () => {
    const rh = { role: null, permissions: ["/rh"] };
    expect(canAccessPath(rh, "/rh")).toBe(true);
    expect(canAccessPath(rh, "/rh/ferias")).toBe(true);
    expect(canAccessPath(rh, "/rh/fichas-cadastrais")).toBe(true);
    expect(canAccessPath(rh, "/planner")).toBe(false);
  });

  it("chave legada /ferias sozinha não libera mais rotas de RH (migrada para /rh)", () => {
    const legado = { role: null, permissions: ["/ferias"] };
    expect(canAccessPath(legado, "/rh/ferias")).toBe(false);
    expect(canAccessPath(legado, "/ferias")).toBe(false);
  });

  it("viewer de férias acessa somente Férias, não as outras telas do RH", () => {
    const viewer = {
      role: null,
      permissions: ["/conteudo/roteiros"],
      ferias_view_enabled: true,
    };
    expect(canAccessPath(viewer, "/rh")).toBe(true);
    expect(canAccessPath(viewer, "/rh/ferias")).toBe(true);
    expect(canAccessPath(viewer, "/ferias")).toBe(true);
    expect(canAccessPath(viewer, "/rh/fichas-cadastrais")).toBe(false);
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

  it("libera a votação do BP Awards para qualquer usuário logado; comitê e telão só com RH", () => {
    const colaborador = { role: null, department: "Trabalhista", permissions: ["/conteudo/roteiros"] };
    expect(canAccessPath(colaborador, "/bp-awards")).toBe(true);
    expect(canAccessPath({ role: null, permissions: null }, "/bp-awards")).toBe(true);
    expect(canAccessPath(colaborador, "/rh/bp-awards")).toBe(false);
    expect(canAccessPath(colaborador, "/rh/bp-awards/revelacao")).toBe(false);
    expect(canAccessPath({ role: null, permissions: ["/rh"] }, "/rh/bp-awards/revelacao")).toBe(true);
  });
});

describe("pesquisas com a equipe", () => {
  it("gestão e resultados só para admin, mesmo com a chave salva no cadastro", () => {
    const comChave = { role: null, permissions: ["/operacoes-legais/pesquisas"] };
    expect(hasTeamSurveysAccess({ role: "admin" })).toBe(true);
    expect(hasTeamSurveysAccess(comChave)).toBe(false);
    expect(canAccessPath(comChave, "/operacoes-legais/pesquisas/123")).toBe(false);
    expect(normalizePermissionsInput(["/operacoes-legais/pesquisas"])).toBeNull();
  });

  it("a página de resposta abre para qualquer pessoa logada", () => {
    expect(canAccessPath({ role: null, permissions: ["/planner"] }, "/pesquisa/pe27-operacoes-legais")).toBe(true);
  });
});

describe("PE27 (planejamento estratégico)", () => {
  it("admin abre e edita; a chave /pe27 abre só para ler; o modo legado não abre", () => {
    expect(hasPe27Access({ role: "admin" })).toBe(true);
    expect(canEditPe27({ role: "admin" })).toBe(true);
    expect(canAccessPath({ role: "admin" }, "/pe27/insumos")).toBe(true);
    expect(canAccessPath({ role: null, permissions: null }, "/pe27")).toBe(false);
    const comChave = { role: null, permissions: ["/pe27"] };
    expect(canAccessPath(comChave, "/pe27/insumos")).toBe(true);
    expect(canEditPe27(comChave)).toBe(false);
    expect(normalizePermissionsInput(["/pe27"])).toEqual(["/pe27"]);
    expect(isManualOnlyKey("/pe27")).toBe(true);
  });

  it("perfil só com o PE27 (consultores) não vê nem as telas abertas a todos", () => {
    const consultor = { role: null, permissions: ["/pe27"] };
    expect(isPe27OnlyProfile(consultor)).toBe(true);
    for (const path of ["/", "/meus-clientes", "/minhas-fotos", "/fotos-eventos", "/conteudo/cronograma", "/perfil", "/planner"]) {
      expect(canAccessPath(consultor, path)).toBe(false);
    }
    expect(canAccessPath(consultor, "/alterar-senha")).toBe(true);
    expect(firstAllowedPath(consultor)).toBe("/pe27");
  });

  it("a chave /pe27/editar libera decidir e editar, e o perfil continua restrito ao módulo", () => {
    const consultor = { role: null, permissions: ["/pe27", "/pe27/editar"] };
    expect(hasPe27Access(consultor)).toBe(true);
    expect(canEditPe27(consultor)).toBe(true);
    expect(isPe27OnlyProfile(consultor)).toBe(true);
    expect(canAccessPath(consultor, "/pe27/insumos")).toBe(true);
    expect(canAccessPath(consultor, "/meus-clientes")).toBe(false);
    expect(firstAllowedPath(consultor)).toBe("/pe27");
    // Só a chave de edição também abre o módulo e entra pela Visão geral.
    const soEdicao = { role: null, permissions: ["/pe27/editar"] };
    expect(hasPe27Access(soEdicao)).toBe(true);
    expect(firstAllowedPath(soEdicao)).toBe("/pe27");
    expect(normalizePermissionsInput(["/pe27/editar"])).toEqual(["/pe27/editar"]);
    expect(isManualOnlyKey("/pe27/editar")).toBe(true);
  });

  it("a chave junto com outras não restringe o resto", () => {
    const socio = { role: null, permissions: ["/planner", "/pe27"] };
    expect(isPe27OnlyProfile(socio)).toBe(false);
    expect(isPe27OnlyProfile({ role: "admin", permissions: ["/pe27"] })).toBe(false);
    expect(canAccessPath(socio, "/meus-clientes")).toBe(true);
    expect(canAccessPath(socio, "/pe27")).toBe(true);
  });
});

describe("tela inicial e dashboard de marketing", () => {
  it("a tela inicial abre para todos os perfis, menos o liberado só no PE27", () => {
    expect(canAccessPath({ role: "admin" }, "/")).toBe(true);
    expect(canAccessPath({ role: null, permissions: ["/conteudo/roteiros"] }, "/")).toBe(true);
    expect(canAccessPath({ role: null, permissions: null, department: "Trabalhista" }, "/")).toBe(true);
    expect(canAccessPath({ role: "designer", permissions: null }, "/")).toBe(true);
    expect(canAccessPath({ role: null, permissions: ["/pe27"] }, "/")).toBe(false);
  });

  it("todo mundo entra pela tela inicial; o perfil só-PE27, pelo módulo", () => {
    expect(firstAllowedPath({ role: "admin" })).toBe("/");
    expect(firstAllowedPath({ role: null, permissions: ["/", "/planner"] })).toBe("/");
    expect(firstAllowedPath({ role: "designer", permissions: null })).toBe("/");
    expect(firstAllowedPath({ role: null, permissions: ["/pe27"] })).toBe("/pe27");
  });

  it("a chave antiga do dashboard continua liberando o dashboard de marketing", () => {
    expect(canAccessPath({ role: null, permissions: ["/", "/planner"] }, "/painel-marketing")).toBe(true);
    expect(canAccessPath({ role: null, permissions: ["/planner"] }, "/painel-marketing")).toBe(false);
    expect(normalizePermissionsInput(["/", "/planner"])).toEqual(["/painel-marketing", "/planner"]);
    expect(normalizePermissionsInput(["/", "/painel-marketing"])).toEqual(["/painel-marketing"]);
    expect(ACCESS_PRESETS["Marketing completo"]).toContain("/painel-marketing");
  });
});
