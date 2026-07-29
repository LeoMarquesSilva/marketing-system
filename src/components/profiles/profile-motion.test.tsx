import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getProfileMotionState,
  ProfileMotionItem,
} from "@/components/profiles/profile-motion";

describe("getProfileMotionState", () => {
  it("usa keyframes sutis e preserva o atraso no modo normal hidratado", () => {
    expect(getProfileMotionState(false, 0.12, true)).toMatchObject({
      initial: false,
      animate: {
        opacity: [1, 0.96, 1],
        y: [0, 8, 0],
      },
      transition: { delay: 0.12 },
    });
  });

  it("mantém o primeiro render estático antes da hidratação", () => {
    expect(getProfileMotionState(false, 0.12, false)).toEqual({
      initial: false,
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    });
  });

  it("remove deslocamento e atraso com movimento reduzido", () => {
    expect(getProfileMotionState(true, 0.12, true)).toEqual({
      initial: false,
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    });
  });
});

describe("ProfileMotionItem — SSR", () => {
  it("entrega conteúdo essencial visível sem JavaScript", () => {
    const markup = renderToStaticMarkup(
      <ProfileMotionItem>
        <p>Conteúdo profissional essencial</p>
      </ProfileMotionItem>
    );

    expect(markup).toContain("Conteúdo profissional essencial");
    expect(markup).not.toMatch(/opacity\s*:\s*0(?:[;"']|$)/);
    expect(markup).not.toContain("translateY");
  });
});
