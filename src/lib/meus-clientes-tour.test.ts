import { describe, expect, it } from "vitest";
import {
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
});
