import { describe, expect, it } from "vitest";
import {
  HR_DEPARTMENT_OPTIONS,
  HR_POSITION_OPTIONS,
  listHrDepartmentOptions,
  listHrPositionOptions,
} from "@/lib/ferias/hr-form-options";

describe("hr-form-options", () => {
  it("mantém opções fechadas de área e cargo", () => {
    expect(HR_DEPARTMENT_OPTIONS).toContain("Cível");
    expect(HR_DEPARTMENT_OPTIONS).toContain("Recuperação de Crédito");
    expect(HR_POSITION_OPTIONS).toContain("Advogado Júnior");
    expect(HR_POSITION_OPTIONS).toContain("Gerente");
  });

  it("inclui valor legado atual nas opções sem perder a lista canônica", () => {
    expect(listHrDepartmentOptions("Contratos")).toEqual(
      expect.arrayContaining(["Contratos", "Cível", "Societário e Contratos"])
    );
    expect(listHrPositionOptions("Parceiro")).toEqual(
      expect.arrayContaining(["Parceiro", "Advogado Pleno"])
    );
  });
});
