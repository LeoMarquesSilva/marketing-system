import { describe, expect, it } from "vitest";
import {
  isContentCollaboratorForTour,
  shouldShowContentTutorial,
} from "@/lib/content-tour";

describe("content-tour", () => {
  it("identifica colaborador de conteúdo", () => {
    expect(
      isContentCollaboratorForTour({
        permissions: ["/conteudo/inicio", "/conteudo/roteiros"],
      })
    ).toBe(true);
    expect(
      isContentCollaboratorForTour({
        permissions: ["/planner"],
      })
    ).toBe(false);
  });

  it("mostra tutorial na primeira visita", () => {
    expect(
      shouldShowContentTutorial({
        permissions: ["/conteudo/inicio"],
        content_tutorial_completed_at: null,
      })
    ).toBe(true);
    expect(
      shouldShowContentTutorial({
        permissions: ["/conteudo/inicio"],
        content_tutorial_completed_at: "2026-07-08T12:00:00.000Z",
      })
    ).toBe(false);
  });

  it("permite forçar tutorial mesmo após conclusão", () => {
    expect(
      shouldShowContentTutorial(
        {
          permissions: ["/conteudo/inicio"],
          content_tutorial_completed_at: "2026-07-08T12:00:00.000Z",
        },
        { forced: true }
      )
    ).toBe(true);
  });

  it("nunca mostra tutorial enquanto deve trocar a senha", () => {
    expect(
      shouldShowContentTutorial({
        permissions: ["/conteudo/inicio"],
        content_tutorial_completed_at: null,
        must_change_password: true,
      })
    ).toBe(false);
    expect(
      shouldShowContentTutorial(
        {
          permissions: ["/conteudo/inicio"],
          content_tutorial_completed_at: null,
          must_change_password: true,
        },
        { forced: true }
      )
    ).toBe(false);
  });
});
