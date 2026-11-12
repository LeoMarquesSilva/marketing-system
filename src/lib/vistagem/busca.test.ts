import { describe, expect, it } from "vitest";
import { combinaCampos, digitosDoTermo, padraoDoTermo, termosDaBusca } from "./busca";

const campos = ["0010869-53.2024.5.15.0126", "Grupo Pague Menos", "Pague Menos Comércio de Produtos Alimentícios Ltda", "TRT15", "Isadora Godoy Conte", "LEILÃO"];

describe("busca da Vistagem", () => {
  it("acha por três letras, sem acento e sem diferença de maiúsculas", () => {
    expect(combinaCampos(campos, "pag")).toBe(true);
    expect(combinaCampos(campos, "COMERCIO")).toBe(true);
    expect(combinaCampos(campos, "leilao")).toBe(true);
    expect(combinaCampos(campos, "xyz")).toBe(false);
  });

  it("aceita as palavras em qualquer ordem, todas precisam aparecer", () => {
    expect(combinaCampos(campos, "menos pague")).toBe(true);
    expect(combinaCampos(campos, "pague isadora")).toBe(true);
    expect(combinaCampos(campos, "pague metalcasty")).toBe(false);
  });

  it("acha o número com ou sem pontuação, a partir de 4 dígitos", () => {
    expect(combinaCampos(campos, "0010869-53")).toBe(true);
    expect(combinaCampos(campos, "108695320245150126")).toBe(true);
    expect(combinaCampos(campos, "0126")).toBe(true);
    expect(combinaCampos(campos, "999999")).toBe(false);
  });

  it("busca vazia combina com tudo", () => {
    expect(combinaCampos(campos, "   ")).toBe(true);
    expect(termosDaBusca("  Pague   Menos ")).toEqual(["pague", "menos"]);
  });
});

describe("busca das Checadas no banco", () => {
  it("a palavra vira uma expressão que acha com ou sem acento", () => {
    const padrao = padraoDoTermo("insolvencia");
    expect(padrao).toBe("[iíìîï][nñ]s[oóòôõö]lv[eéèêë][nñ][cç][iíìîï][aáàâãä]");
    expect(new RegExp(padrao, "i").test("Cível | Insolvência")).toBe(true);
    expect(new RegExp(padraoDoTermo("LEILÃO"), "i").test("leilao")).toBe(true);
  });

  it("sinais viram qualquer caractere, sem nada que quebre o filtro do banco", () => {
    const padrao = padraoDoTermo("2166876-03.2026");
    expect(padrao).toBe("2166876.03.2026");
    expect(new RegExp(padrao).test("2166876-03.2026.8.26.0000")).toBe(true);
    expect(padraoDoTermo('a,b(c)"d*')).not.toMatch(/[,()"*]/);
  });

  it("número com 4 dígitos ou mais vale também sem a pontuação", () => {
    expect(digitosDoTermo("2166876-03.2026.8.26.0000")).toBe("21668760320268260000");
    expect(digitosDoTermo("940166")).toBe("940166");
    expect(digitosDoTermo("123")).toBeNull();
    expect(digitosDoTermo("hewitt")).toBeNull();
  });
});
