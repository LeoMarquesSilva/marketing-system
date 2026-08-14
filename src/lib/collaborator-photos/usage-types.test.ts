import { describe, expect, it } from "vitest";
import {
  assertUsageTypeCanDeactivate,
  assertUsageTypeCanDelete,
  slugifyUsageLabel,
  withCreatedUsageType,
} from "@/lib/collaborator-photos/usage-types";
import type { PhotoUsageType } from "@/lib/collaborator-photos/types";

const oficial: PhotoUsageType = {
  id: "t-oficial",
  slug: "oficial",
  label: "Oficial",
  isOfficial: true,
  isSystem: true,
  sortOrder: 0,
  isActive: true,
};

const posts: PhotoUsageType = {
  id: "t-posts",
  slug: "posts",
  label: "Posts",
  isOfficial: false,
  isSystem: false,
  sortOrder: 1,
  isActive: true,
};

describe("photo usage types", () => {
  it("impede apagar o uso oficial", () => {
    expect(() => assertUsageTypeCanDelete(oficial)).toThrow(/oficial/i);
  });

  it("impede desativar o uso oficial", () => {
    expect(() => assertUsageTypeCanDeactivate(oficial)).toThrow(/oficial/i);
  });

  it("permite desativar categoria extra", () => {
    expect(() => assertUsageTypeCanDeactivate(posts)).not.toThrow();
  });

  it("gera slug estável a partir do rótulo", () => {
    expect(slugifyUsageLabel("Site/materiais")).toBe("site-materiais");
    expect(slugifyUsageLabel("  Eventos  ")).toBe("eventos");
  });

  it("nova categoria entra ativa, não oficial e no fim da ordem", () => {
    const next = withCreatedUsageType([oficial, posts], {
      id: "t-novo",
      label: "Campanhas",
    });
    expect(next.at(-1)).toMatchObject({
      id: "t-novo",
      slug: "campanhas",
      label: "Campanhas",
      isOfficial: false,
      isSystem: false,
      isActive: true,
      sortOrder: 2,
    });
  });
});
