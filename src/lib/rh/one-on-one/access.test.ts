import { describe, expect, it } from "vitest";
import { ONE_ON_ONE_HR_ONLY, canAccessPath } from "@/lib/access-control";
import { buildNav } from "@/lib/navigation";

const admin = { role: "admin", permissions: [] };
const rh = { role: null, permissions: ["/rh"] };
const gestor = { role: null, permissions: ["/ferias"], department: "Cível" };
const advogado = { role: null, permissions: [], department: "Trabalhista" };

function navHrefs(profile: Parameters<typeof buildNav>[0]): string[] {
  return buildNav(profile).flatMap((front) => front.features.flatMap((feature) => feature.pages.map((page) => page.href)));
}

describe.runIf(ONE_ON_ONE_HR_ONLY)("1:1 em teste (só RH e admin)", () => {
  it("admin e RH abrem Minhas 1:1, a dupla e a gestão", () => {
    for (const profile of [admin, rh]) {
      expect(canAccessPath(profile, "/1-1")).toBe(true);
      expect(canAccessPath(profile, "/1-1/a/b")).toBe(true);
      expect(canAccessPath(profile, "/rh/1-1")).toBe(true);
      expect(navHrefs(profile)).toEqual(expect.arrayContaining(["/1-1", "/rh/1-1"]));
    }
  });

  it("gestor e colaborador sem a chave do RH não veem nem abrem", () => {
    for (const profile of [gestor, advogado]) {
      expect(canAccessPath(profile, "/1-1")).toBe(false);
      expect(canAccessPath(profile, "/1-1/a/b")).toBe(false);
      expect(canAccessPath(profile, "/rh/1-1")).toBe(false);
      expect(navHrefs(profile)).not.toContain("/1-1");
      expect(navHrefs(profile)).not.toContain("/rh/1-1");
    }
  });
});

describe.runIf(!ONE_ON_ONE_HR_ONLY)("1:1 liberada", () => {
  it("todos abrem Minhas 1:1 e só o RH a gestão", () => {
    expect(canAccessPath(advogado, "/1-1")).toBe(true);
    expect(canAccessPath(rh, "/rh/1-1")).toBe(true);
    expect(canAccessPath(advogado, "/rh/1-1")).toBe(false);
  });
});
