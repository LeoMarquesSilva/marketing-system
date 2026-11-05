import { describe, expect, it } from "vitest";
import { chaveDaFrase, compararTeor, frasesDoTexto, marcarDiferencas } from "./comparar-teor";

const principal = "Processo 0001234-56.2026.5.02.0001. Intimado: FULANO DE TAL. Fica a parte intimada para pagar R$ 1.000,00 no prazo de 15 dias.\nIntime-se.";
const copia = "Processo 0001234-56.2026.5.02.0001. Intimado: BELTRANO LTDA. Fica a parte intimada para pagar R$ 1.000,00 no prazo de 15 dias.\nintime-se";

describe("comparação do texto das duplicidades", () => {
  it("quebra em frases sem cortar valores nem números", () => {
    expect(frasesDoTexto(principal)).toEqual([
      "Processo 0001234-56.2026.5.02.0001.",
      "Intimado: FULANO DE TAL.",
      "Fica a parte intimada para pagar R$ 1.000,00 no prazo de 15 dias.",
      "Intime-se.",
    ]);
  });

  it("ignora maiúsculas, acentos, espaços e a pontuação das pontas", () => {
    expect(chaveDaFrase("  Intime-SE. ")).toBe(chaveDaFrase("intime-se"));
    expect(chaveDaFrase("Ação")).toBe("acao");
  });

  it("aponta só o que muda entre as cópias", () => {
    const resultado = compararTeor(principal, copia);
    expect(resultado.iguais).toBe(false);
    expect(resultado.soNaPrincipal).toEqual(["Intimado: FULANO DE TAL."]);
    expect(resultado.soNaCopia).toEqual(["Intimado: BELTRANO LTDA."]);
    // Palavra a palavra: 17 das 20 palavras da principal estão na cópia, e a tela pinta 2 trechos (um em cada texto).
    expect(resultado.semelhanca).toBeCloseTo(17 / 20);
    expect(resultado.trechosDiferentes).toBe(2);
  });

  it("textos iguais", () => {
    expect(compararTeor(principal, principal.toUpperCase()).iguais).toBe(true);
    expect(compararTeor("", "").semelhanca).toBe(1);
  });

  it("marca os trechos diferentes por parágrafo, com os espaços já no texto", () => {
    const marcado = marcarDiferencas(principal, copia);
    expect(marcado).toHaveLength(2);
    // Palavra a palavra: "Intimado:" é igual nos dois; muda só o nome.
    expect(marcado[0].filter((trecho) => trecho.diferente).map((trecho) => trecho.texto)).toEqual(["FULANO DE TAL."]);
    expect(marcado[0].map((trecho) => trecho.texto).join("")).toBe(principal.split("\n")[0]);
    expect(marcado[1].every((trecho) => !trecho.diferente)).toBe(true);
  });

  it("numa frase parecida, pinta só as palavras que mudam (o cabeçalho com outro intimado)", () => {
    const a = "PROCESSO 0100465-18.2026.5.01.0401 ÓRGÃO 1ª Vara do Trabalho de Angra dos Reis DESTINATÁRIO VIAFORT ENGENHARIA LTDA TIPO Intimação";
    const b = "PROCESSO 0100465-18.2026.5.01.0401 ÓRGÃO 1ª Vara do Trabalho de Angra dos Reis DESTINATÁRIO CONCESSIONARIA RIO SP TIPO Intimação";
    const diferentes = marcarDiferencas(a, b)[0].filter((trecho) => trecho.diferente).map((trecho) => trecho.texto.trim());
    expect(diferentes).toEqual(["VIAFORT ENGENHARIA LTDA"]);
  });
});
