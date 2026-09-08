import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReadingExperience } from "./reading-experience";
import type { ReadingRecommendation } from "@/lib/reading-trajectories/types";

function recommendation(patch: Partial<ReadingRecommendation>): ReadingRecommendation {
  return {
    id: "1",
    userId: "user-1",
    publicName: "Daniel Pressatto",
    practiceArea: "Trabalhista",
    role: "Sócio de Área",
    roleOverride: null,
    profilePhotoUrl: null,
    photoOverrideUrl: null,
    photoUrl: null,
    bookTitle: "Manual do CEO",
    bookAuthor: "Josh Kaufman",
    bookCoverUrl: null,
    recommendationText: "Leitura imprescindível para quem advoga para empresas.",
    trajectoryNote: "Gustavo me indicou esse livro quando entrei no escritório.",
    bookLink: null,
    displayOrder: 1,
    isVisible: true,
    isComplete: true,
    updatedAt: "2026-09-08T12:00:00Z",
    ...patch,
  };
}

describe("ReadingExperience", () => {
  it("apresenta a história completa sem marca interna do sistema", () => {
    const html = renderToStaticMarkup(<ReadingExperience items={[recommendation({})]} />);
    expect(html).toContain("Leituras que");
    expect(html).toContain("Leitura imprescindível");
    expect(html).toContain("Gustavo me indicou");
    expect(html).not.toContain("ORQESTRAI");
  });

  it("mostra uma indicação pendente sem inventar livro", () => {
    const html = renderToStaticMarkup(
      <ReadingExperience items={[recommendation({ id: "2", publicName: "Ricardo Viscardi Pires", bookTitle: null, recommendationText: null, isComplete: false })]} />
    );
    expect(html).toContain("Indicação em preparação");
    expect(html).toContain("Ricardo Viscardi Pires");
  });
});
