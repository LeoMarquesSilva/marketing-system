import { describe, expect, it } from "vitest";
import { CONFIGURACOES_PADRAO, lerValor, montarConfiguracoes, normalizarValor } from "./configuracoes";
import { temDemandaDeRisco, type PastaSioe } from "./triagem";

describe("configurações da Vistagem", () => {
  it("sem nada no banco, vale o padrão do código", () => {
    expect(montarConfiguracoes([])).toEqual(CONFIGURACOES_PADRAO);
    expect(CONFIGURACOES_PADRAO.etiquetasDeRisco).toEqual(["Demanda de risco", "Crítico"]);
    expect(CONFIGURACOES_PADRAO.iaSugestaoTarefa).toBe(true);
  });

  it("usa o que está no banco e ignora valor inválido", () => {
    const configuracoes = montarConfiguracoes([
      { chave: "horaArquivoEsperado", valor: 9 },
      { chave: "iaSugestaoTarefa", valor: false },
      { chave: "etiquetasDeRisco", valor: [] },
    ]);
    expect(configuracoes.horaArquivoEsperado).toBe(9);
    expect(configuracoes.iaSugestaoTarefa).toBe(false);
    // Lista vazia não vale (precisa de pelo menos uma etiqueta): fica o padrão.
    expect(configuracoes.etiquetasDeRisco).toEqual(CONFIGURACOES_PADRAO.etiquetasDeRisco);
  });

  it("hora do alerta só entre 7h e 9h (o cron confere às 9h)", () => {
    expect(lerValor("horaArquivoEsperado", 10)).toBe(CONFIGURACOES_PADRAO.horaArquivoEsperado);
    expect(() => normalizarValor("horaArquivoEsperado", 6)).toThrow();
    expect(normalizarValor("horaArquivoEsperado", 7)).toBe(7);
  });

  it("limpa etiquetas repetidas (sem diferença de acento e maiúscula)", () => {
    expect(normalizarValor("etiquetasDeRisco", ["Crítico", "critico", " Demanda de risco "])).toEqual(["Crítico", "Demanda de risco"]);
  });

  it("vistadores: tira nomes vazios e áreas sem ninguém; recusa área fora da lista", () => {
    expect(normalizarValor("vistadores", { Trabalhista: { normal: " Isadora Godoy ", risco: "" }, Cível: { normal: null, risco: null } })).toEqual({
      Trabalhista: { normal: "Isadora Godoy" },
    });
    expect(() => normalizarValor("vistadores", { "Área inventada": { normal: "Fulano" } })).toThrow();
  });
});

describe("etiquetas de risco configuráveis", () => {
  const pasta = (etiquetas: string) => ({ etiquetas }) as PastaSioe;

  it("vale a lista escolhida, como palavra inteira e sem acento", () => {
    expect(temDemandaDeRisco(pasta("Carteira X | Urgente"), ["Urgente"])).toBe(true);
    expect(temDemandaDeRisco(pasta("Carteira X | Demanda de risco"), ["Urgente"])).toBe(false);
    expect(temDemandaDeRisco(pasta("Carteira Urgentíssima"), ["Urgente"])).toBe(false);
  });
});
