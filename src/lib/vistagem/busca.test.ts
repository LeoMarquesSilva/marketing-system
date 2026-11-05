import { describe, expect, it } from "vitest";
import { combinaCampos, termosDaBusca } from "./busca";

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
