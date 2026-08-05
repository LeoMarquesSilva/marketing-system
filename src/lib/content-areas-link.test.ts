import { describe, expect, it } from "vitest";
import { canCreateRoteiroFromLink } from "@/lib/content-areas";

describe("canCreateRoteiroFromLink", () => {
  it("libera marketing, admin e designer", () => {
    expect(canCreateRoteiroFromLink({ department: "Marketing", role: null })).toBe(true);
    expect(canCreateRoteiroFromLink({ department: "Cível", role: "admin" })).toBe(true);
    expect(canCreateRoteiroFromLink({ department: null, role: "designer" })).toBe(true);
  });

  it("libera colaborador de área jurídica (ex.: Maria Heloiza / Operações Legais)", () => {
    expect(
      canCreateRoteiroFromLink({ department: "Operações Legais", role: null })
    ).toBe(true);
    expect(canCreateRoteiroFromLink({ department: "Trabalhista", role: null })).toBe(true);
  });

  it("bloqueia perfil sem área de conteúdo", () => {
    expect(canCreateRoteiroFromLink(null)).toBe(false);
    expect(canCreateRoteiroFromLink({ department: null, role: null })).toBe(false);
    expect(canCreateRoteiroFromLink({ department: "TI", role: null })).toBe(false);
  });
});
