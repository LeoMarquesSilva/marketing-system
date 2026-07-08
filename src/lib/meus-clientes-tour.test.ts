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
});
