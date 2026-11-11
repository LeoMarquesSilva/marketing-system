import { describe, expect, it } from "vitest";
import { etiquetasEmDestaque, listaDeEtiquetas, temEtiqueta } from "./etiquetas";

describe("listaDeEtiquetas", () => {
  it("separa o texto do VIOS pelo |", () => {
    expect(listaDeEtiquetas("Carteira GPR | Crédito Ativo | RC-Insolvência")).toEqual(["Carteira GPR", "Crédito Ativo", "RC-Insolvência"]);
    expect(listaDeEtiquetas("RC-Insolvência")).toEqual(["RC-Insolvência"]);
  });

  it("sem etiqueta é lista vazia", () => {
    expect(listaDeEtiquetas(null)).toEqual([]);
    expect(listaDeEtiquetas(undefined)).toEqual([]);
    expect(listaDeEtiquetas("")).toEqual([]);
    expect(listaDeEtiquetas(" | ")).toEqual([]);
  });

  it("tira espaços a mais e repetidas", () => {
    expect(listaDeEtiquetas("  Crítico  |RC-Insolvência|  rc - insolvencia | Crítico")).toEqual(["Crítico", "RC-Insolvência"]);
  });
});

describe("etiquetasEmDestaque", () => {
  it("acha a RC-Insolvência em qualquer grafia", () => {
    expect(etiquetasEmDestaque(["Carteira Decorwatts", "RC-Insolvência"])).toEqual(["RC-Insolvência"]);
    expect(etiquetasEmDestaque(["RC - INSOLVENCIA"])).toEqual(["RC-Insolvência"]);
  });

  it("pasta sem a etiqueta não tem selo", () => {
    expect(etiquetasEmDestaque(["Demanda de risco", "Carteira Pague Menos"])).toEqual([]);
    expect(etiquetasEmDestaque([])).toEqual([]);
    // Parecida não vale: só a etiqueta inteira.
    expect(etiquetasEmDestaque(["RC-Insolvência Antiga"])).toEqual([]);
  });

  it("aceita outra lista de destaque", () => {
    expect(etiquetasEmDestaque(["Crédito Ativo", "Crítico"], ["Crítico"])).toEqual(["Crítico"]);
  });
});

describe("temEtiqueta", () => {
  it("compara sem acento e maiúscula", () => {
    expect(temEtiqueta(["Crédito Ativo"], "credito ativo")).toBe(true);
    expect(temEtiqueta(["Crédito Ativo"], "Crítico")).toBe(false);
  });
});
