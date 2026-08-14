import { describe, expect, it } from "vitest";
import {
  canAccessMinhasFotosTour,
  filterMinhasFotosTourSteps,
  MINHAS_FOTOS_TOUR_STEPS,
  resolveMinhasFotosTourSteps,
  shouldShowMinhasFotosTutorial,
} from "@/lib/minhas-fotos-tour";

const baseProfile = {
  permissions: ["/planner"],
  minhas_fotos_tutorial_completed_at: null as string | null,
};

describe("acesso ao tour de Minhas fotos", () => {
  it("libera qualquer usuário autenticado com acesso a /minhas-fotos", () => {
    expect(canAccessMinhasFotosTour({ permissions: ["/planner"] })).toBe(true);
    expect(canAccessMinhasFotosTour({ role: "admin", permissions: null })).toBe(true);
    expect(canAccessMinhasFotosTour(null)).toBe(false);
  });

  it("abre automaticamente no primeiro acesso com fotos", () => {
    expect(shouldShowMinhasFotosTutorial(baseProfile, { photoCount: 2 })).toBe(true);
  });

  it("não abre automaticamente quando o tutorial já foi concluído", () => {
    expect(
      shouldShowMinhasFotosTutorial(
        {
          ...baseProfile,
          minhas_fotos_tutorial_completed_at: "2026-08-14T12:00:00.000Z",
        },
        { photoCount: 2 }
      )
    ).toBe(false);
  });

  it("reabre quando forçado manualmente, mesmo após conclusão", () => {
    expect(
      shouldShowMinhasFotosTutorial(
        {
          ...baseProfile,
          minhas_fotos_tutorial_completed_at: "2026-08-14T12:00:00.000Z",
        },
        { photoCount: 2, forced: true }
      )
    ).toBe(true);
  });

  it("não abre automaticamente enquanto o usuário precisa trocar a senha", () => {
    expect(
      shouldShowMinhasFotosTutorial(
        {
          ...baseProfile,
          must_change_password: true,
        },
        { photoCount: 2 }
      )
    ).toBe(false);
    expect(
      shouldShowMinhasFotosTutorial(
        {
          ...baseProfile,
          must_change_password: true,
        },
        { photoCount: 2, forced: true }
      )
    ).toBe(false);
  });

  it("não abre automaticamente com galeria vazia e permanece elegível quando houver fotos", () => {
    expect(shouldShowMinhasFotosTutorial(baseProfile, { photoCount: 0 })).toBe(false);
    expect(shouldShowMinhasFotosTutorial(baseProfile, { photoCount: 1 })).toBe(true);
  });

  it("permite reabertura forçada mesmo com galeria vazia", () => {
    expect(
      shouldShowMinhasFotosTutorial(baseProfile, { photoCount: 0, forced: true })
    ).toBe(true);
  });
});

describe("passos do guia", () => {
  it("define os 7 passos aprovados com alvos principais", () => {
    expect(MINHAS_FOTOS_TOUR_STEPS).toHaveLength(7);
    expect(MINHAS_FOTOS_TOUR_STEPS.map((step) => step.id)).toEqual([
      "welcome",
      "header",
      "gallery",
      "session",
      "usage-options",
      "official-usage",
      "finish",
    ]);
    expect(MINHAS_FOTOS_TOUR_STEPS[0]?.target).toBeNull();
    expect(MINHAS_FOTOS_TOUR_STEPS[1]?.target).toBe('[data-tour="mf-header"]');
    expect(MINHAS_FOTOS_TOUR_STEPS[5]?.title).toBe("Foto dos sistemas do escritório");
  });

  it("filtra passos condicionais cujos targets não existem, preservando a sequência", () => {
    const resolved = filterMinhasFotosTourSteps(MINHAS_FOTOS_TOUR_STEPS, [
      "mf-header",
      "mf-gallery",
      "mf-usage-options",
      "mf-actions",
    ]);

    expect(resolved.map((step) => step.id)).toEqual([
      "welcome",
      "header",
      "gallery",
      "usage-options",
      "finish",
    ]);
    expect(resolved.some((step) => step.id === "session")).toBe(false);
    expect(resolved.some((step) => step.id === "official-usage")).toBe(false);
  });

  it("resolve somente passos cujos elementos estão presentes no DOM", () => {
    const availableSelectors = new Set([
      '[data-tour="mf-header"]',
      '[data-tour="mf-gallery"]',
      '[data-tour="mf-usage-options"]',
      '[data-tour="mf-actions"]',
    ]);

    const resolved = resolveMinhasFotosTourSteps(
      MINHAS_FOTOS_TOUR_STEPS,
      (selector) => availableSelectors.has(selector)
    );

    expect(resolved.map((step) => step.id)).toEqual([
      "welcome",
      "header",
      "gallery",
      "usage-options",
      "finish",
    ]);
  });
});
