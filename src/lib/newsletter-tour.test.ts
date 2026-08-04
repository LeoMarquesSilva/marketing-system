import { describe, expect, it } from "vitest";
import {
  canAccessNewsletterTour,
  NEWSLETTER_EDITOR_TOUR_STEPS,
  NEWSLETTER_LIST_TOUR_STEPS,
  shouldShowNewsletterTutorial,
} from "@/lib/newsletter-tour";

describe("acesso ao tour da Newsletter", () => {
  it("libera quem tem seção de conteúdo (legado ou permissão explícita)", () => {
    expect(
      canAccessNewsletterTour({ role: null, permissions: ["/conteudo/boletim"] })
    ).toBe(true);
    expect(canAccessNewsletterTour({ role: "admin", permissions: null })).toBe(true);
  });

  it("mostra o tour até concluir, e de novo quando forçado", () => {
    const profile = {
      permissions: ["/conteudo/boletim"],
      newsletter_tutorial_completed_at: null as string | null,
    };
    expect(shouldShowNewsletterTutorial(profile)).toBe(true);

    profile.newsletter_tutorial_completed_at = "2026-08-04T12:00:00.000Z";
    expect(shouldShowNewsletterTutorial(profile)).toBe(false);
    expect(shouldShowNewsletterTutorial(profile, { forced: true })).toBe(true);
  });

  it("não inicia com troca de senha obrigatória", () => {
    expect(
      shouldShowNewsletterTutorial({
        permissions: ["/conteudo/boletim"],
        must_change_password: true,
        newsletter_tutorial_completed_at: null,
      })
    ).toBe(false);
  });
});

describe("passos do guia", () => {
  it("tem tour da lista e do editor com alvos principais", () => {
    expect(NEWSLETTER_LIST_TOUR_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(NEWSLETTER_EDITOR_TOUR_STEPS.some((s) => s.id === "editor-pick")).toBe(true);
    expect(NEWSLETTER_EDITOR_TOUR_STEPS.some((s) => s.target === '[data-tour="nl-pick-news"]')).toBe(
      true
    );
  });
});
