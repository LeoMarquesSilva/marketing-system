import { describe, expect, it } from "vitest";
import { readingRecommendationUpdateSchema } from "./validation";

const valid = {
  publicName: "Daniel Pressatto",
  practiceArea: "Trabalhista",
  roleOverride: "",
  photoOverrideUrl: "",
  bookTitle: "Manual do CEO",
  bookAuthor: "Josh Kaufman",
  bookCoverUrl: "https://example.com/capa.jpg",
  recommendationText: "Leitura imprescindível.",
  trajectoryNote: "Gustavo me indicou esse livro.",
  bookLink: "",
  displayOrder: 4,
  isVisible: true,
};

describe("readingRecommendationUpdateSchema", () => {
  it("normaliza campos opcionais vazios", () => {
    const parsed = readingRecommendationUpdateSchema.parse(valid);
    expect(parsed.roleOverride).toBeNull();
    expect(parsed.bookLink).toBeNull();
  });

  it("rejeita protocolos inseguros", () => {
    const result = readingRecommendationUpdateSchema.safeParse({
      ...valid,
      bookLink: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });
});
