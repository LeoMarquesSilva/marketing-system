import { describe, expect, it } from "vitest";
import { collectReports, createsCycle, type EmployeeLink } from "./team";

const link = (id: string, manager: string | null): EmployeeLink => ({
  id,
  manager_employee_id: manager,
  department: null,
  is_active: true,
});

// gerente → coordenador → (analista, estagiário); gerente → assistente
const links = [
  link("gerente", null),
  link("coordenador", "gerente"),
  link("analista", "coordenador"),
  link("estagiario", "coordenador"),
  link("assistente", "gerente"),
];

describe("collectReports", () => {
  it("traz liderados diretos e indiretos", () => {
    expect([...collectReports("gerente", links)].sort()).toEqual(["analista", "assistente", "coordenador", "estagiario"]);
    expect([...collectReports("coordenador", links)].sort()).toEqual(["analista", "estagiario"]);
    expect(collectReports("analista", links).size).toBe(0);
  });

  it("não entra em laço se o cadastro tiver ciclo", () => {
    const loop = [link("a", "b"), link("b", "a")];
    expect([...collectReports("a", loop)]).toEqual(["b"]);
  });
});

describe("createsCycle", () => {
  it("bloqueia gestor que é liderado da pessoa", () => {
    expect(createsCycle("coordenador", "analista", links)).toBe(true);
    expect(createsCycle("gerente", "estagiario", links)).toBe(true);
    expect(createsCycle("analista", "analista", links)).toBe(true);
  });
  it("libera troca normal", () => {
    expect(createsCycle("analista", "gerente", links)).toBe(false);
    expect(createsCycle("assistente", "coordenador", links)).toBe(false);
  });
});
