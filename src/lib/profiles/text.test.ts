import { describe, expect, it } from "vitest";
import { toTitleCasePt } from "@/lib/profiles/text";

describe("toTitleCasePt", () => {
  it("capitaliza a primeira letra de cada palavra", () => {
    expect(toTitleCasePt("FELIPE SOARES DE CAMARGO")).toBe("Felipe Soares de Camargo");
    expect(toTitleCasePt("gabriela nicolau olmedo consul")).toBe(
      "Gabriela Nicolau Olmedo Consul"
    );
  });

  it("mantém partículas em minúsculas no meio", () => {
    expect(toTitleCasePt("MARIA CAROLINE DA CUNHA THOMÉ")).toBe(
      "Maria Caroline da Cunha Thomé"
    );
    expect(toTitleCasePt("CAIO AUGUSTO DE ALCÂNTARA CÉSAR SILVA")).toBe(
      "Caio Augusto de Alcântara César Silva"
    );
  });

  it("capitaliza a primeira palavra mesmo se for partícula", () => {
    expect(toTitleCasePt("DE SOUZA")).toBe("De Souza");
  });

  it("lida com vazio", () => {
    expect(toTitleCasePt(null)).toBe("");
    expect(toTitleCasePt("   ")).toBe("");
  });
});
