import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FaceReviewButtons } from "./event-photo-lightbox";

function render(match: "sure" | "maybe" | null, busy = false) {
  return renderToStaticMarkup(
    <FaceReviewButtons match={match} busy={busy} onConfirmMe={vi.fn()} onNotMe={vi.fn()} />
  );
}

describe("FaceReviewButtons", () => {
  it("na dúvida, pergunta: Sou eu e Não sou eu", () => {
    const html = render("maybe");
    expect(html).toContain("Sou eu");
    expect(html).toContain("Não sou eu");
  });

  it("marcação certa só permite recusar", () => {
    const html = render("sure");
    expect(html).not.toContain(">Sou eu<");
    expect(html).toContain("Não sou eu");
  });

  it("foto sem marcação não mostra nada", () => {
    expect(render(null)).toBe("");
  });

  it("desabilita enquanto salva", () => {
    expect(render("maybe", true).match(/disabled=""/g)).toHaveLength(2);
  });
});
