import { describe, expect, it } from "vitest";
import { canAccessPath, firstAllowedPath, resolveAllowedSections } from "@/lib/access-control";
import {
  canAccessContentArea,
  getAllowedLegalAreas,
  isContentCollaborator,
} from "@/lib/content-areas";
import {
  canAccessNewsletterTour,
  shouldShowNewsletterTutorial,
} from "@/lib/newsletter-tour";
import { parseGeneratedSection } from "@/lib/content-newsletter";
import {
  buildNewsletterHtml,
  buildNewsletterWordHtml,
  newsletterWordSlug,
} from "@/lib/content-newsletter-word";

/** Espelho das permissões liberadas para o Ricardo Viscardi Pires. */
const RICARDO_LIKE = {
  id: "test-ricardo",
  name: "Ricardo Teste Newsletter",
  department: "Sócio",
  role: null as string | null,
  permissions: [
    "/conteudo/inicio",
    "/conteudo/roteiros",
    "/conteudo/boletim",
    "/conteudo/reels",
    "/meus-clientes",
  ],
  must_change_password: false,
  newsletter_tutorial_completed_at: null as string | null,
};

describe("acesso do perfil tipo Ricardo à Newsletter", () => {
  it("resolve as seções explícitas de conteúdo", () => {
    const allowed = resolveAllowedSections(RICARDO_LIKE);
    expect(allowed).toEqual(RICARDO_LIKE.permissions);
  });

  it("pode abrir a rota da Newsletter e a subárvore /conteudo", () => {
    expect(canAccessPath(RICARDO_LIKE, "/conteudo/boletim")).toBe(true);
    expect(canAccessPath(RICARDO_LIKE, "/conteudo/roteiros")).toBe(true);
    expect(canAccessPath(RICARDO_LIKE, "/conteudo/inicio")).toBe(true);
    expect(canAccessPath(RICARDO_LIKE, "/conteudo/reels")).toBe(true);
  });

  it("não acessa Planner/admin sem permissão", () => {
    expect(canAccessPath(RICARDO_LIKE, "/planner")).toBe(false);
    expect(canAccessPath(RICARDO_LIKE, "/admin")).toBe(false);
    expect(canAccessPath(RICARDO_LIKE, "/usuarios")).toBe(false);
  });

  it("acessa Meus Clientes (manual-only) porque está nas permissions", () => {
    expect(canAccessPath(RICARDO_LIKE, "/meus-clientes")).toBe(true);
  });

  it("cai na home de conteúdo como primeira rota", () => {
    expect(firstAllowedPath(RICARDO_LIKE)).toBe("/conteudo/inicio");
  });

  it("como Sócio enxerga todas as áreas jurídicas, inclusive Reestruturação", () => {
    expect(isContentCollaborator(RICARDO_LIKE)).toBe(true);
    const areas = getAllowedLegalAreas(RICARDO_LIKE);
    expect(areas).toContain("Reestruturação (Insolvência)");
    expect(canAccessContentArea(RICARDO_LIKE, "Reestruturação (Insolvência)")).toBe(true);
  });

  it("recebe o tour da Newsletter até concluir", () => {
    expect(canAccessNewsletterTour(RICARDO_LIKE)).toBe(true);
    expect(shouldShowNewsletterTutorial(RICARDO_LIKE)).toBe(true);
    expect(
      shouldShowNewsletterTutorial({
        ...RICARDO_LIKE,
        newsletter_tutorial_completed_at: "2026-08-04T12:00:00.000Z",
      })
    ).toBe(false);
  });
});

describe("fluxo de documento que o Ricardo baixa", () => {
  it("monta Word com abertura, sumário, seções e assinatura", () => {
    const newsletter = {
      title: "Newsletter de Reestruturação e Insolvência",
      edition_label: "1ª Edição | 2026",
      area: "Reestruturação (Insolvência)",
      intro_title: "Nesta edição",
      intro_body: "Panorama do período.",
      signature_names: "Ricardo Viscardi Pires",
      collaborator_names: "Equipe da área",
      signed_by_name: "Ricardo Viscardi Pires",
      signed_at: "2026-08-04T15:00:00.000Z",
    };
    const items = [
      {
        headline: "Raízen obtém aprovação de plano",
        body: "Primeiro parágrafo.\n\nSegundo parágrafo.",
        source_link: "https://exemplo.com/raizen",
      },
    ];

    const html = buildNewsletterWordHtml(newsletter, items);
    expect(html).toContain("urn:schemas-microsoft-com:office:word");
    expect(html).toContain("Newsletter");
    expect(html).toContain("Ricardo Viscardi Pires");
    expect(html).toContain("Raízen obtém aprovação de plano");
    expect(html).toContain("não constitui parecer ou aconselhamento jurídico");
    expect(newsletterWordSlug(newsletter.title)).toContain("newsletter");
  });

  it("escapa HTML malicioso no texto editado pelo sócio", () => {
    const html = buildNewsletterHtml(
      {
        title: "Teste",
        edition_label: null,
        area: "Reestruturação (Insolvência)",
        intro_title: null,
        intro_body: null,
        signature_names: null,
        collaborator_names: null,
        signed_by_name: null,
        signed_at: null,
      },
      [{ headline: "<img onerror=alert(1)>", body: "<b>ok</b>", source_link: null }]
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("parseia resposta da IA no formato usado ao redigir seções", () => {
    const parsed = parseGeneratedSection(
      "Título: STJ firma tese sobre período suspeito\nCorpo: Em julgamento recente o STJ firmou parâmetros.\n\nO tema impacta adquirentes de boa-fé."
    );
    expect(parsed.headline).toMatch(/STJ/);
    expect(parsed.body.split("\n\n").length).toBeGreaterThanOrEqual(2);
  });
});
