import { describe, expect, it } from "vitest";
import { avisosDoAcesso, lerPedidoDeAcesso, ondeVista, ordenarAcessos, type AcessoVistagem } from "./acessos";
import { VistagemError } from "./errors";

describe("pedido de acesso à Vistagem", () => {
  it("controladoria: todas as áreas e o risco, sem guardar áreas", () => {
    expect(lerPedidoDeAcesso({ papel: "controladoria", areas: ["Cível"], risco: false })).toEqual({ papel: "controladoria", areas: [], risco: true });
  });

  it("jurídico: só áreas do sistema, na ordem do sistema; risco só sai com um não explícito", () => {
    expect(lerPedidoDeAcesso({ papel: "juridico", areas: ["Trabalhista", "Área inventada", "Cível"] })).toEqual({
      papel: "juridico",
      areas: ["Cível", "Trabalhista"],
      risco: true,
    });
    expect(lerPedidoDeAcesso({ papel: "juridico", areas: ["Cível"], risco: false }).risco).toBe(false);
  });

  it("recusa papel desconhecido e jurídico sem área", () => {
    expect(() => lerPedidoDeAcesso({ papel: "admin" })).toThrow(VistagemError);
    expect(() => lerPedidoDeAcesso(null)).toThrow("Escolha o papel");
    expect(() => lerPedidoDeAcesso({ papel: "juridico", areas: ["Área inventada"] })).toThrow("Marque ao menos uma área");
  });
});

describe("onde a pessoa é vistadora", () => {
  const mapa = {
    Cível: { normal: ["Giovani Pina de Freitas", "Maria Caroline"], risco: ["Giovani Pina de Freitas"] },
    Trabalhista: { normal: ["Isadora Godoy"], risco: ["Caroline Abdalla"] },
    "Todas as áreas": { normal: ["Ricardo Viscardi Pires"] },
  };

  it("acha pelo nome sem acento nem maiúscula, nos dois tipos", () => {
    expect(ondeVista("GIOVANI PINA DE FREITAS", mapa)).toEqual([{ area: "Cível", tipos: ["normal", "risco"] }]);
    expect(ondeVista("Ricardo Viscardi Pires", mapa)).toEqual([{ area: "Todas as áreas", tipos: ["normal"] }]);
    expect(ondeVista("Fulano de Tal", mapa)).toEqual([]);
  });

  it("acha também pelo nome do RH de quem está na lista pelo nome do dia a dia", () => {
    expect(ondeVista("Isadora Godoy Conte", mapa)).toEqual([{ area: "Trabalhista", tipos: ["normal"] }]);
  });
});

describe("avisos do acesso", () => {
  const juridico = { papel: "juridico" as const, areas: ["Cível"], veRisco: true, vistadorEm: [] };

  it("jurídico sem área não vê nada", () => {
    expect(avisosDoAcesso({ ...juridico, areas: [] })).toEqual(["Sem área marcada: não vê nenhuma publicação."]);
  });

  it("vistador numa área que não está marcada e vistador de risco que não vê risco", () => {
    expect(
      avisosDoAcesso({
        ...juridico,
        veRisco: false,
        vistadorEm: [
          { area: "Cível", tipos: ["risco"] },
          { area: "Trabalhista", tipos: ["normal"] },
          { area: "Todas as áreas", tipos: ["normal"] },
        ],
      })
    ).toEqual([
      "Vistador em Trabalhista, mas essa área não está marcada.",
      "Vistador de demandas de risco, mas está marcado para não vistar as de risco.",
    ]);
  });

  it("controladoria vê tudo: nada a avisar", () => {
    expect(avisosDoAcesso({ papel: "controladoria", areas: [], veRisco: true, vistadorEm: [{ area: "Cível", tipos: ["risco"] }] })).toEqual([]);
  });
});

describe("ordem da lista", () => {
  it("jurídico primeiro, depois a controladoria, cada um pelo nome", () => {
    const pessoa = (nome: string, papel: AcessoVistagem["papel"]): AcessoVistagem => ({
      id: nome,
      nome,
      email: null,
      foto: null,
      admin: false,
      papel,
      areas: [],
      veRisco: true,
      vistadorEm: [],
    });
    const ordem = ordenarAcessos([pessoa("Ana", "controladoria"), pessoa("Zélia", "juridico"), pessoa("Bruno", "juridico")]);
    expect(ordem.map((item) => item.nome)).toEqual(["Bruno", "Zélia", "Ana"]);
  });
});
