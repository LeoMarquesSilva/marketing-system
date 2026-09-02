import { describe, expect, it } from "vitest";
import {
  hasOperacoesLegaisAccess,
  isOperacoesLegaisDepartment,
  isOperacoesLegaisPath,
} from "./access";

describe("operacoes-legais access", () => {
  it("reconhece só o department Operações Legais", () => {
    expect(isOperacoesLegaisDepartment("Operações Legais")).toBe(true);
    expect(isOperacoesLegaisDepartment("operacoes legais")).toBe(true);
    expect(isOperacoesLegaisDepartment("Marketing")).toBe(false);
    expect(isOperacoesLegaisDepartment("Cível")).toBe(false);
    expect(isOperacoesLegaisDepartment("Facilities")).toBe(false);
  });

  it("admin e department Ops entram; advogado de outra área não", () => {
    expect(hasOperacoesLegaisAccess({ role: "admin", department: "Cível" })).toBe(true);
    expect(
      hasOperacoesLegaisAccess({ role: "designer", department: "Operações Legais" })
    ).toBe(true);
    expect(hasOperacoesLegaisAccess({ role: null, department: "Trabalhista" })).toBe(false);
    expect(
      hasOperacoesLegaisAccess({
        role: null,
        department: "Cível",
        permissions: ["/operacoes-legais"],
      })
    ).toBe(true);
  });

  it("casa a árvore /operacoes-legais", () => {
    expect(isOperacoesLegaisPath("/operacoes-legais")).toBe(true);
    expect(isOperacoesLegaisPath("/operacoes-legais/vistagem")).toBe(true);
    expect(isOperacoesLegaisPath("/rh")).toBe(false);
  });
});
