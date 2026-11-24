import { describe, expect, it } from "vitest";
import { FEEDBACK_HR_ONLY, canAccessPath } from "@/lib/access-control";
import { buildNav } from "@/lib/navigation";

const admin = { role: "admin", permissions: [] };
const rh = { role: null, permissions: ["/rh"] };
const gestor = { role: null, permissions: ["/ferias"], department: "Cível" };
const advogado = { role: null, permissions: [], department: "Trabalhista" };

function navHrefs(profile: Parameters<typeof buildNav>[0]): string[] {
  return buildNav(profile).flatMap((front) => front.features.flatMap((feature) => feature.pages.map((page) => page.href)));
}

describe.runIf(FEEDBACK_HR_ONLY)("Feedback em teste (só RH e admin)", () => {
  it("admin e RH abrem Meu feedback e a gestão", () => {
    for (const profile of [admin, rh]) {
      expect(canAccessPath(profile, "/feedback")).toBe(true);
      expect(canAccessPath(profile, "/feedback/x")).toBe(true);
      expect(canAccessPath(profile, "/rh/feedback")).toBe(true);
      expect(navHrefs(profile)).toEqual(expect.arrayContaining(["/feedback", "/rh/feedback"]));
    }
  });

  it("gestor e colaborador sem a chave do RH não veem nem abrem", () => {
    for (const profile of [gestor, advogado]) {
      expect(canAccessPath(profile, "/feedback")).toBe(false);
      expect(canAccessPath(profile, "/feedback/x")).toBe(false);
      expect(canAccessPath(profile, "/rh/feedback")).toBe(false);
      expect(navHrefs(profile)).not.toContain("/feedback");
      expect(navHrefs(profile)).not.toContain("/rh/feedback");
    }
  });
});

describe.runIf(!FEEDBACK_HR_ONLY)("Feedback liberado", () => {
  it("todos abrem Meu feedback e só o RH a gestão", () => {
    expect(canAccessPath(advogado, "/feedback")).toBe(true);
    expect(canAccessPath(rh, "/rh/feedback")).toBe(true);
    expect(canAccessPath(advogado, "/rh/feedback")).toBe(false);
  });
});
