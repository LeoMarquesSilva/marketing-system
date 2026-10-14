import { describe, expect, it } from "vitest";
import {
  buildNav,
  findActiveHref,
  NAV_FRONTS,
  resolveHeaderContext,
  type NavProfile,
} from "@/lib/navigation";

function visibleHrefs(profile: NavProfile | null) {
  return buildNav(profile).flatMap((front) =>
    front.features.flatMap((feature) => feature.pages.map((page) => page.href))
  );
}

function frontIds(profile: NavProfile | null) {
  return buildNav(profile).map((front) => front.id);
}

describe("catálogo de navegação", () => {
  it("não repete páginas entre funcionalidades", () => {
    const hrefs = NAV_FRONTS.flatMap((front) =>
      front.features.flatMap((feature) => feature.pages.map((page) => page.href))
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("organiza as funcionalidades nas frentes do escritório", () => {
    const admin = buildNav({ role: "admin" });
    expect(admin.map((front) => front.label)).toEqual([
      "Visão geral",
      "Marketing",
      "Relacionamento / Comercial",
      "Pessoas e Cultura",
      "Operações Legais",
      "Administração",
    ]);
    const marketing = admin.find((front) => front.id === "marketing")!;
    expect(marketing.features.map((feature) => feature.label)).toContain("Gerador de conteúdo");
    expect(marketing.features.map((feature) => feature.label)).toContain("Métricas de redes sociais");
  });
});

describe("visibilidade por perfil", () => {
  it("admin vê tudo menos a home do colaborador de conteúdo", () => {
    const hrefs = visibleHrefs({ role: "admin" });
    expect(hrefs).toContain("/");
    expect(hrefs).not.toContain("/conteudo/inicio");
    for (const href of ["/nfc", "/icp", "/operacoes-legais", "/operacoes-legais/vistagem", "/operacoes-legais/vistagem/controladoria", "/operacoes-legais/vistagem/duplicidades", "/rh/organograma", "/admin", "/fotos-colaboradores"]) {
      expect(hrefs).toContain(href);
    }
  });

  it("designer no modo legado não vê áreas restritas", () => {
    const hrefs = visibleHrefs({ role: "designer", permissions: null, department: "Marketing" });
    expect(hrefs).toContain("/planner");
    expect(hrefs).toContain("/usuarios");
    expect(hrefs).toContain("/meus-clientes/nps");
    for (const href of ["/nfc", "/icp", "/operacoes-legais", "/operacoes-legais/vistagem", "/operacoes-legais/vistagem/controladoria", "/operacoes-legais/vistagem/duplicidades", "/cafe-cultura", "/rh/ferias", "/admin", "/conteudo/inicio"]) {
      expect(hrefs).not.toContain(href);
    }
  });

  it("colaborador de área jurídica sem permissões vê só o fluxo de conteúdo", () => {
    const hrefs = visibleHrefs({ role: null, permissions: null, department: "Trabalhista" });
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/conteudo/inicio",
        "/conteudo/roteiros",
        "/conteudo/aprovacao-reels",
        "/conteudo/cronograma",
        "/minhas-fotos",
        "/meus-clientes",
      ])
    );
    expect(hrefs).not.toContain("/");
    expect(hrefs).not.toContain("/planner");
    expect(frontIds({ role: null, permissions: null, department: "Trabalhista" })).not.toContain("pessoas");
  });

  it("aprovação de Reels é um item próprio do menu, fora do Gerador de conteúdo", () => {
    const features = buildNav({ role: null, permissions: null, department: "Trabalhista" }).flatMap((front) => front.features);
    const reels = features.find((feature) => feature.id === "aprovacao-reels");
    expect(reels?.href).toBe("/conteudo/aprovacao-reels");
    const gerador = features.find((feature) => feature.id === "gerador-conteudo");
    expect(gerador?.pages.map((page) => page.href)).not.toContain("/conteudo/aprovacao-reels");
    expect(resolveHeaderContext("/conteudo/aprovacao-reels", buildNav({ role: "admin" })).tabs).toEqual([]);
  });

  it("colaborador com férias liberadas ganha só a gestão de férias em Pessoas e Cultura", () => {
    const nav = buildNav({ role: null, permissions: null, department: "Trabalhista", ferias_view_enabled: true });
    const pessoas = nav.find((front) => front.id === "pessoas");
    expect(pessoas?.features.map((feature) => feature.id)).toEqual(["ferias"]);
  });

  it("permissão de conteúdo libera toda a subárvore /conteudo, sem Dashboard", () => {
    const hrefs = visibleHrefs({ role: null, permissions: ["/conteudo/roteiros"] });
    expect(hrefs).toEqual(
      expect.arrayContaining(["/conteudo/inicio", "/conteudo/boletim", "/conteudo/reels", "/conteudo/roteiros"])
    );
    expect(hrefs).not.toContain("/");
    expect(hrefs).not.toContain("/conteudo/gustavo");
  });

  it("permissão /rh libera todas as telas de Pessoas e Cultura do RH", () => {
    const hrefs = visibleHrefs({ role: null, permissions: ["/planner", "/rh"] });
    expect(hrefs).toEqual(
      expect.arrayContaining(["/rh/ferias", "/rh/qualificacoes", "/rh/fichas-cadastrais", "/rh/organograma"])
    );
    expect(hrefs).not.toContain("/solicitacoes");
  });

  it("ICP aparece com a liberação manual em Usuários", () => {
    expect(visibleHrefs({ role: null, permissions: ["/icp"] })).toContain("/icp");
    expect(visibleHrefs({ role: null, permissions: ["/planner"] })).not.toContain("/icp");
  });

  it("a funcionalidade aponta para a primeira página liberada", () => {
    const nav = buildNav({ role: null, permissions: ["/vios-tarefas"] });
    const planner = nav.flatMap((front) => front.features).find((feature) => feature.id === "planner");
    expect(planner?.href).toBe("/vios-tarefas");
  });
});

describe("rota ativa e cabeçalho", () => {
  it("escolhe a página mais específica", () => {
    const hrefs = ["/", "/meus-clientes", "/meus-clientes/nps", "/eventos"];
    expect(findActiveHref("/meus-clientes/nps", hrefs)).toBe("/meus-clientes/nps");
    expect(findActiveHref("/meus-clientes", hrefs)).toBe("/meus-clientes");
    expect(findActiveHref("/eventos/abc", hrefs)).toBe("/eventos");
    expect(findActiveHref("/eventos-antigos", hrefs)).toBeNull();
    expect(findActiveHref("/", hrefs)).toBe("/");
  });

  it("mostra frente, funcionalidade e abas das páginas irmãs", () => {
    const nav = buildNav({ role: "admin" });
    const header = resolveHeaderContext("/linkedin-insights", nav);
    expect(header.eyebrow).toBe("Marketing");
    expect(header.title).toBe("Métricas de redes sociais");
    expect(header.tabs.map((tab) => tab.label)).toEqual(["Instagram", "LinkedIn", "Site (GA4)"]);
    expect(header.activeHref).toBe("/linkedin-insights");
  });

  it("sem abas quando só uma página da funcionalidade está liberada", () => {
    const nav = buildNav({ role: null, permissions: ["/linkedin-insights"] });
    expect(resolveHeaderContext("/linkedin-insights", nav).tabs).toEqual([]);
  });

  it("usa o nome completo da funcionalidade no cabeçalho", () => {
    const nav = buildNav({ role: "admin" });
    expect(resolveHeaderContext("/icp", nav).title).toBe("ICP (perfil de cliente ideal)");
    expect(resolveHeaderContext("/meus-clientes/nps", nav).title).toBe("Gestão de NPS");
    expect(resolveHeaderContext("/perfil", nav).title).toBe("Meu perfil");
    expect(resolveHeaderContext("/nfc/leituras", nav).title).toBe("Leituras que formam trajetórias");
    expect(resolveHeaderContext("/nfc/tags", nav).title).toBe("NFC Hub");
  });
});
