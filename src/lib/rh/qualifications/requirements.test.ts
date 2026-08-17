import { describe, expect, it } from "vitest";
import {
  listQualificationPositionsForArea,
  matchesQualificationRequirementTarget,
} from "@/lib/rh/qualifications/requirements";

describe("matchesQualificationRequirementTarget", () => {
  it("combina equipe canônica e cargo", () => {
    expect(
      matchesQualificationRequirementTarget(
        { department: "R.H.", position: "Gerente" },
        {
          scopes: [{ area: "Operações Legais", positions: ["Gerente"] }],
        }
      )
    ).toBe(true);

    expect(
      matchesQualificationRequirementTarget(
        { department: "Insolvência", position: "Gerente" },
        {
          scopes: [{ area: "Operações Legais", positions: ["Gerente"] }],
        }
      )
    ).toBe(false);
  });

  it("não seleciona ninguém sem escopo ou cargo", () => {
    const target = { department: "Marketing", position: "Coordenador" };
    expect(
      matchesQualificationRequirementTarget(target, { scopes: [] })
    ).toBe(false);
    expect(
      matchesQualificationRequirementTarget(target, {
        scopes: [{ area: "Operações Legais", positions: [] }],
      })
    ).toBe(false);
  });

  it("compara cargos sem diferença de acento ou caixa", () => {
    expect(
      matchesQualificationRequirementTarget(
        { department: "Insolvência", position: "Estagiário" },
        {
          scopes: [{ area: "Reestruturação", positions: ["estagiario"] }],
        }
      )
    ).toBe(true);
  });

  it("não cruza cargos selecionados para áreas diferentes", () => {
    const selection = {
      scopes: [
        { area: "Cível", positions: ["Gerente"] },
        { area: "Contratos", positions: ["Estagiário"] },
      ],
    };

    expect(
      matchesQualificationRequirementTarget(
        { department: "Cível", position: "Gerente" },
        selection
      )
    ).toBe(true);
    expect(
      matchesQualificationRequirementTarget(
        { department: "Contratos", position: "Gerente" },
        selection
      )
    ).toBe(false);
  });
});

describe("listQualificationPositionsForArea", () => {
  it("lista somente os cargos da área selecionada", () => {
    expect(
      listQualificationPositionsForArea(
        [
          { department: "Cível", position: "Gerente" },
          { department: "Cível", position: "Advogado Jr I" },
          { department: "Contratos", position: "Estagiário" },
          { department: "Financeiro", position: null },
        ],
        "Cível"
      )
    ).toEqual(["Advogado Jr I", "Gerente"]);
  });
});
