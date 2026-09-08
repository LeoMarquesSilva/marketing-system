import { describe, expect, it } from "vitest";
import {
  EMPTY_IDENTITY_VISUAL_BRIEFING,
  identityVisualBriefingSchema,
  isIdentityVisualRequest,
} from "@/lib/identity-visual-briefing";

describe("briefing de identidade visual", () => {
  it("reconhece somente solicitações de identidade visual", () => {
    expect(isIdentityVisualRequest("Identidade Visual")).toBe(true);
    expect(isIdentityVisualRequest("  identidade visual  ")).toBe(true);
    expect(isIdentityVisualRequest("Post Redes Sociais")).toBe(false);
    expect(isIdentityVisualRequest(null)).toBe(false);
  });

  it("aceita um briefing parcialmente preenchido", () => {
    const result = identityVisualBriefingSchema.parse({
      ...EMPTY_IDENTITY_VISUAL_BRIEFING,
      brandName: "Aurora",
      audienceType: "ambos",
      personality: ["Moderna", "Confiável"],
    });

    expect(result.brandName).toBe("Aurora");
    expect(result.personality).toEqual(["Moderna", "Confiável"]);
  });

  it("limita a personalidade a cinco características", () => {
    const result = identityVisualBriefingSchema.safeParse({
      ...EMPTY_IDENTITY_VISUAL_BRIEFING,
      personality: ["1", "2", "3", "4", "5", "6"],
    });

    expect(result.success).toBe(false);
  });

  it("exige a descrição do público quando a opção é outro", () => {
    const result = identityVisualBriefingSchema.safeParse({
      ...EMPTY_IDENTITY_VISUAL_BRIEFING,
      audienceType: "outro",
      audienceOther: "",
    });

    expect(result.success).toBe(false);
  });
});
