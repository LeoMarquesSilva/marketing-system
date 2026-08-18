import { describe, expect, it } from "vitest";
import { canSeeContentRoteiro } from "@/lib/content-areas";
import { resolveAreaFilter, type UserContentAccess } from "@/lib/content-access";

/** Espelho do Wagner: Contratos → Societário e Contratos. */
const WAGNER: UserContentAccess = {
  id: "89431fec-abb1-4a6a-beab-120dabff6f56",
  name: "Wagner José Penereiro Armani",
  email: "wagner.armani@bismarchipires.com.br",
  department: "Contratos",
  role: null,
};

describe("canSeeContentRoteiro — post gerado por link de outra área", () => {
  it("colaborador de Contratos vê o post que ele gerou mesmo classificado como Reestruturação", () => {
    expect(
      canSeeContentRoteiro(WAGNER, {
        area: "Reestruturação",
        createdById: WAGNER.id,
      })
    ).toBe(true);
  });

  it("colaborador de Contratos não vê post de Reestruturação gerado por outra pessoa", () => {
    expect(
      canSeeContentRoteiro(WAGNER, {
        area: "Reestruturação",
        createdById: "outra-pessoa",
      })
    ).toBe(false);
  });

  it("colaborador de Contratos continua vendo post da própria área", () => {
    expect(
      canSeeContentRoteiro(WAGNER, {
        area: "Societário e Contratos",
        createdById: null,
      })
    ).toBe(true);
  });
});

describe("resolveAreaFilter — lista inclui o que o colaborador gerou", () => {
  it("na lista padrão, pede também os posts criados pelo colaborador", () => {
    const access = resolveAreaFilter(WAGNER);
    expect(access.areas).toEqual(["Societário e Contratos"]);
    expect(access.includeCreatedById).toBe(WAGNER.id);
  });

  it("quando filtra uma área específica, não mistura posts de outras áreas", () => {
    const access = resolveAreaFilter(WAGNER, "Societário e Contratos");
    expect(access.area).toBe("Societário e Contratos");
    expect(access.includeCreatedById).toBeUndefined();
  });

  it("gestor de Marketing vê todas as áreas e não precisa do atalho de criador", () => {
    const access = resolveAreaFilter({
      id: "mkt",
      name: "Marketing",
      email: null,
      department: "Marketing",
      role: null,
    });
    expect(access.areas).toBeNull();
    expect(access.includeCreatedById).toBeUndefined();
  });
});
