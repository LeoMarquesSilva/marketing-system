import { describe, expect, it } from "vitest";
import { NOVIDADES_TOUR_ID, novidadesTourSteps, shouldShowNovidadesTour } from "./novidades-tour";

const base = { seen: false, mustChangePassword: false, onboardingActive: false, onboardingPending: false };

describe("tour de novidades do Gerador", () => {
  it("abre sozinho só para quem ainda não viu", () => {
    expect(shouldShowNovidadesTour(base)).toBe(true);
    expect(shouldShowNovidadesTour({ ...base, seen: true })).toBe(false);
    // Sem resposta do servidor, não abre (melhor não mostrar do que mostrar toda vez).
    expect(shouldShowNovidadesTour({ ...base, seen: null })).toBe(false);
  });

  it("não atropela o tour de boas-vindas nem a troca de senha", () => {
    expect(shouldShowNovidadesTour({ ...base, onboardingPending: true })).toBe(false);
    expect(shouldShowNovidadesTour({ ...base, onboardingActive: true, forced: true })).toBe(false);
    expect(shouldShowNovidadesTour({ ...base, mustChangePassword: true, forced: true })).toBe(false);
  });

  it("o botão Novidades reabre mesmo para quem já viu", () => {
    expect(shouldShowNovidadesTour({ ...base, seen: true, forced: true })).toBe(true);
  });

  it("Marketing vê Escolhas e Configurações antes do passo final; advogado não", () => {
    const lawyer = novidadesTourSteps(false).map((step) => step.id);
    const marketing = novidadesTourSteps(true).map((step) => step.id);
    expect(lawyer).not.toContain("escolhas");
    expect(marketing.slice(-3)).toEqual(["escolhas", "configuracoes", "detalhe"]);
    expect(marketing).toHaveLength(lawyer.length + 2);
  });

  it("todo passo com destaque aponta para um alvo e o id do tour é válido para a API", () => {
    for (const step of novidadesTourSteps(true)) {
      expect(step.title.length).toBeGreaterThan(5);
      if (step.target) expect(step.target).toMatch(/^\[data-tour="|^a\[href="/);
    }
    expect(NOVIDADES_TOUR_ID).toMatch(/^[a-z0-9-]{3,80}$/);
  });
});
