import { describe, expect, it } from "vitest";
import { PDI_ADMIN_ONLY, canAccessPath } from "@/lib/access-control";
import { buildNav } from "@/lib/navigation";

const admin = { role: "admin", permissions: [] };
const rh = { role: null, permissions: ["/rh"] };
const advogado = { role: null, permissions: [], department: "Trabalhista" };

function navHrefs(profile: Parameters<typeof buildNav>[0]): string[] {
  return buildNav(profile).flatMap((front) => front.features.flatMap((feature) => feature.pages.map((page) => page.href)));
}

describe.runIf(PDI_ADMIN_ONLY)("PDI em teste (só admin)", () => {
  it("admin abre Meu PDI, o plano e a gestão", () => {
    expect(canAccessPath(admin, "/pdi")).toBe(true);
    expect(canAccessPath(admin, "/pdi/123")).toBe(true);
    expect(canAccessPath(admin, "/rh/pdi")).toBe(true);
    expect(navHrefs(admin)).toEqual(expect.arrayContaining(["/pdi", "/rh/pdi"]));
  });

  it("RH sem admin e colaborador não veem nem abrem", () => {
    for (const profile of [rh, advogado]) {
      expect(canAccessPath(profile, "/pdi")).toBe(false);
      expect(canAccessPath(profile, "/pdi/123")).toBe(false);
      expect(canAccessPath(profile, "/rh/pdi")).toBe(false);
      expect(navHrefs(profile)).not.toContain("/pdi");
      expect(navHrefs(profile)).not.toContain("/rh/pdi");
    }
  });
});

describe.runIf(!PDI_ADMIN_ONLY)("PDI liberado", () => {
  it("todos abrem Meu PDI e só o RH a gestão", () => {
    expect(canAccessPath(advogado, "/pdi")).toBe(true);
    expect(canAccessPath(rh, "/rh/pdi")).toBe(true);
    expect(canAccessPath(advogado, "/rh/pdi")).toBe(false);
  });
});
