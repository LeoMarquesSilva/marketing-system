import { describe, expect, it } from "vitest";
import {
  buildMeusClientesTourSteps,
  isMeusClientesUserForTour,
  shouldShowMeusClientesTutorial,
} from "@/lib/meus-clientes-tour";

describe("meus-clientes-tour", () => {
  it("identifica usuário com acesso a Meus Clientes", () => {
    expect(
      isMeusClientesUserForTour({
        permissions: ["/meus-clientes"],
      })
    ).toBe(true);
    expect(
      isMeusClientesUserForTour({
        permissions: ["/planner"],
      })
    ).toBe(false);
  });

  it("mostra tutorial na primeira visita", () => {
    expect(
      shouldShowMeusClientesTutorial({
        permissions: ["/meus-clientes"],
        meus_clientes_tutorial_completed_at: null,
      })
    ).toBe(true);
    expect(
      shouldShowMeusClientesTutorial({
        permissions: ["/meus-clientes"],
        meus_clientes_tutorial_completed_at: "2026-07-07T12:00:00.000Z",
      })
    ).toBe(false);
  });

  it("permite forçar tutorial mesmo após conclusão", () => {
    expect(
      shouldShowMeusClientesTutorial(
        {
          permissions: ["/meus-clientes"],
          meus_clientes_tutorial_completed_at: "2026-07-07T12:00:00.000Z",
        },
        { forced: true }
      )
    ).toBe(true);
  });

  it("nunca mostra tutorial enquanto deve trocar a senha", () => {
    expect(
      shouldShowMeusClientesTutorial({
        permissions: ["/meus-clientes"],
        meus_clientes_tutorial_completed_at: null,
        must_change_password: true,
      })
    ).toBe(false);
    expect(
      shouldShowMeusClientesTutorial(
        {
          permissions: ["/meus-clientes"],
          meus_clientes_tutorial_completed_at: null,
          must_change_password: true,
        },
        { forced: true }
      )
    ).toBe(false);
  });

  it("monta passos do gestor e do responsável", () => {
    const gestor = buildMeusClientesTourSteps({
      hasSampleGroup: true,
      isAreaManager: true,
      canShowAreaContactStep: true,
    });
    expect(gestor.some((step) => step.id === "area-contact")).toBe(true);
    expect(gestor.some((step) => step.id === "nps-send")).toBe(true);
    expect(gestor.some((step) => step.id === "nps-mark-sent")).toBe(true);
    expect(gestor.find((step) => step.id === "nps-mark-sent")?.body).toMatch(
      /não é possível desmarcar/
    );
    expect(gestor.some((step) => step.id === "finish-gestor")).toBe(true);
    expect(gestor.some((step) => step.id === "finish-colaborador")).toBe(true);

    const colaborador = buildMeusClientesTourSteps({
      hasSampleGroup: true,
      isAreaManager: false,
      canShowAreaContactStep: false,
    });
    expect(colaborador.some((step) => step.id === "area-contact")).toBe(false);
    expect(colaborador.some((step) => step.id === "finish-gestor")).toBe(false);
    expect(colaborador.some((step) => step.id === "contact-nps")).toBe(true);
    expect(colaborador.some((step) => step.id === "nps-mark-sent")).toBe(true);
  });

  it("omite passos de card quando não há grupo de exemplo", () => {
    const steps = buildMeusClientesTourSteps({
      hasSampleGroup: false,
      isAreaManager: true,
      canShowAreaContactStep: false,
    });
    expect(steps.some((step) => step.id === "group-sample")).toBe(false);
    expect(steps.some((step) => step.id === "nps-send")).toBe(false);
    expect(steps.some((step) => step.id === "nps-mark-sent")).toBe(false);
    expect(steps.some((step) => step.id === "welcome")).toBe(true);
  });
});
