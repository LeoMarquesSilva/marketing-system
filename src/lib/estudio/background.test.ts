import { describe, expect, it } from "vitest";
import { carryOverImages, normalizeSlides, switchSlideTemplate } from "./domain";
import { getTemplate } from "./templates";

const conteudo = (fundo: unknown) => normalizeSlides([{ id: "s1", modelo: "bp-conteudo", valores: {}, fundo }], "BP", "carrossel")[0];

describe("fundo do slide", () => {
  it("aceita variação existente e foto da pasta de fundos", () => {
    expect(conteudo({ tipo: "variacao", n: 2 }).fundo).toEqual({ tipo: "variacao", n: 2 });
    expect(conteudo({ tipo: "imagem", path: "BP/fundos/1-escritorio.jpg", camada: 0.5, credito: "Foto: Ana Souza" }).fundo).toEqual({
      tipo: "imagem",
      path: "BP/fundos/1-escritorio.jpg",
      camada: 0.5,
      credito: "Foto: Ana Souza",
    });
  });

  it("limita a camada e recusa variação ou pasta fora do lugar", () => {
    const fundo = conteudo({ tipo: "imagem", path: "BP/fundos/a.jpg", camada: 4 }).fundo;
    expect(fundo).toEqual({ tipo: "imagem", path: "BP/fundos/a.jpg", camada: 0.95 });
    expect(conteudo({ tipo: "variacao", n: 9 }).fundo).toBeUndefined();
    expect(conteudo({ tipo: "imagem", path: "BP/fotos/a.png" }).fundo).toBeUndefined();
    expect(conteudo({ tipo: "imagem", path: "../x.jpg" }).fundo).toBeUndefined();
  });

  it("modelo sem troca de fundo descarta o fundo", () => {
    const [capa] = normalizeSlides([{ modelo: "bp-capa", valores: {}, fundo: { tipo: "variacao", n: 1 } }], "BP", "carrossel");
    expect(capa.fundo).toBeUndefined();
    const switched = switchSlideTemplate(conteudo({ tipo: "variacao", n: 3 }), getTemplate("bp-capa")!);
    expect(switched.fundo).toBeUndefined();
  });

  it("volta depois da IA no slide que ficou no mesmo lugar", () => {
    const before = [conteudo({ tipo: "variacao", n: 3 })];
    const after = carryOverImages(before, [{ id: "novo", modelo: "bp-conteudo", valores: before[0].valores }]);
    expect(after[0].fundo).toEqual({ tipo: "variacao", n: 3 });
  });
});
