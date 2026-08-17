import { describe, expect, it } from "vitest";
import { isLawyerCollaborator } from "@/lib/rh/qualifications/lawyers";

describe("isLawyerCollaborator", () => {
  it("reconhece cargos de advogado", () => {
    expect(
      isLawyerCollaborator({
        user_name: "Midian Barbosa da Silva",
        position: "Advogado Jr I",
        department: "Cível",
      })
    ).toBe(true);
  });

  it("reconhece gerentes como advogados", () => {
    expect(
      isLawyerCollaborator({
        user_name: "Leonardo Loureiro Basso",
        position: "Gerente",
        department: "Insolvência",
      })
    ).toBe(true);
  });

  it("reconhece coordenadores, exceto o do Financeiro", () => {
    expect(
      isLawyerCollaborator({
        user_name: "Ana Clara Borba Tavares",
        position: "Coordenador",
        department: "Insolvência",
      })
    ).toBe(true);
    expect(
      isLawyerCollaborator({
        user_name: "Samuel Willian Silva",
        position: "Coordenador",
        department: "Operações Legais",
      })
    ).toBe(true);
    expect(
      isLawyerCollaborator({
        user_name: "Juliana Herculano Bangart Pires",
        position: "Coordenador",
        department: "Financeiro",
      })
    ).toBe(false);
  });

  it("não trata estagiário, sócio ou consultor como advogado", () => {
    expect(
      isLawyerCollaborator({
        user_name: "Caio Augusto",
        position: "Estagiário",
        department: "Contratos",
      })
    ).toBe(false);
    expect(
      isLawyerCollaborator({
        user_name: "Ricardo Viscardi Pires",
        position: "Sócio",
        department: "Sócio",
      })
    ).toBe(false);
    expect(
      isLawyerCollaborator({
        user_name: "Leonardo Marques Silva",
        position: "Consultor",
        department: "Comercial",
      })
    ).toBe(false);
  });

  it("exclui Zamboni, Camila e Gabriela Consul pelo nome", () => {
    expect(
      isLawyerCollaborator({
        user_name: "Carlos Zamboni",
        position: "Gerente",
        department: "Consultoria Estratégica",
      })
    ).toBe(false);
    expect(
      isLawyerCollaborator({
        name: "Camila Souza",
        position: "Advogado",
        department: "Cível",
      })
    ).toBe(false);
    expect(
      isLawyerCollaborator({
        user_name: "Gabriela Nicolau Olmedo Consul",
        position: "Coordenador",
        department: "Cível",
      })
    ).toBe(false);
  });
});
