import { describe, expect, it } from "vitest";
import { diferencasDaAlteracao, porArea } from "./historico-configuracoes";

describe("diferencasDaAlteracao", () => {
  it("vistadores: mostra só quem entrou, saiu ou trocou de tipo", () => {
    const antes = {
      Cível: { normal: ["Maria Caroline", "Giovani"], risco: ["Giancarlo", "Gabriela Consul"] },
      Trabalhista: { normal: ["Isadora Godoy"], risco: ["Caroline Abdalla"] },
    };
    const depois = {
      Cível: { normal: ["Maria Caroline", "Giovani", "Gabriela Consul"], risco: ["Giancarlo"] },
      Trabalhista: { normal: ["Isadora Godoy"], risco: ["Caroline Abdalla", "Daniel Pressatto"] },
    };
    expect(diferencasDaAlteracao("vistadores", antes, depois)).toEqual([
      { tipo: "moveu", area: "Cível", nome: "Gabriela Consul", de: "risco", para: "normal" },
      { tipo: "pessoa", area: "Trabalhista", demanda: "risco", nome: "Daniel Pressatto", acao: "entrou" },
    ]);
  });

  it("pessoa que fica nos dois tipos ou sai de um só aparece como entrou/saiu daquele tipo", () => {
    const diferencas = diferencasDaAlteracao("vistadores", { Cível: { normal: ["Giovani"] } }, { Cível: { normal: ["Giovani"], risco: ["Giovani"] } });
    expect(diferencas).toEqual([{ tipo: "pessoa", area: "Cível", demanda: "risco", nome: "Giovani", acao: "entrou" }]);
  });

  it("área nova e área que saiu inteira", () => {
    const diferencas = diferencasDaAlteracao("vistadores", { Tributário: { normal: ["Francisco Zanin"] } }, { Contratos: { normal: ["Wagner Armani"] } });
    expect(diferencas).toEqual([
      { tipo: "pessoa", area: "Tributário", demanda: "normal", nome: "Francisco Zanin", acao: "saiu" },
      { tipo: "pessoa", area: "Contratos", demanda: "normal", nome: "Wagner Armani", acao: "entrou" },
    ]);
    expect(porArea(diferencas).map((grupo) => grupo.area)).toEqual(["Tributário", "Contratos"]);
  });

  it("salvar sem mudar nada não gera diferença", () => {
    const mapa = { Cível: { normal: ["Giovani"], risco: ["Giancarlo"] } };
    expect(diferencasDaAlteracao("vistadores", mapa, JSON.parse(JSON.stringify(mapa)))).toEqual([]);
    expect(diferencasDaAlteracao("horaArquivoEsperado", 8, 8)).toEqual([]);
  });

  it("etiquetas: entrou e saiu, sem diferença de acento", () => {
    expect(diferencasDaAlteracao("etiquetasDeRisco", ["Demanda de risco", "Crítico"], ["demanda de risco", "Urgente"])).toEqual([
      { tipo: "etiqueta", etiqueta: "Crítico", acao: "saiu" },
      { tipo: "etiqueta", etiqueta: "Urgente", acao: "entrou" },
    ]);
  });

  it("hora e IA: de → para", () => {
    expect(diferencasDaAlteracao("horaArquivoEsperado", 8, 9)).toEqual([{ tipo: "valor", antes: "8h", depois: "9h" }]);
    expect(diferencasDaAlteracao("iaSugestaoTarefa", true, false)).toEqual([{ tipo: "valor", antes: "Ligada", depois: "Desligada" }]);
    expect(diferencasDaAlteracao("iaSugestaoTarefa", null, false)).toEqual([{ tipo: "valor", antes: "padrão", depois: "Desligada" }]);
  });
});
