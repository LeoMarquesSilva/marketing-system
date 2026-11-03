import { describe, expect, it } from "vitest";
import { chaveGrupo, iniciaisDoGrupo } from "./logos";

describe("chaveGrupo", () => {
  it("ignora acento, caixa e o 'Grupo' do começo", () => {
    expect(chaveGrupo("Grupo Ádamo")).toBe("ADAMO");
    expect(chaveGrupo("grupo  ádamo")).toBe(chaveGrupo("Adamo"));
  });
});

describe("iniciaisDoGrupo", () => {
  it("usa as duas primeiras palavras sem o 'Grupo'", () => {
    expect(iniciaisDoGrupo("Grupo Adalberto Salvador")).toBe("AS");
    expect(iniciaisDoGrupo("Grupo Rápido 900")).toBe("R9");
    expect(iniciaisDoGrupo("Grupo CDA")).toBe("CD");
  });
});
