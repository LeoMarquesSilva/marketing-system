import { describe, expect, it } from "vitest";
import { blockBox, cleanFontName, groupTextBlocks, weightFromName, type TextRun } from "./pdf-text";

const run = (str: string, x: number, y: number, size: number, font = "Gotham-Book", width = str.length * size * 0.55): TextRun => ({
  str,
  x,
  y,
  width,
  size,
  font,
  ascent: 0.75,
  anchor: [x, 1350 - y],
});

describe("blocos de texto da prancheta", () => {
  it("junta trechos da linha e linhas do parágrafo; separa título e rodapé", () => {
    const blocks = groupTextBlocks(
      [
        run("BLOQUEIO NÃO É", 100, 300, 80, "Gobold"),
        run("PAGAMENTO", 100, 390, 80, "Gobold"),
        run("Valor tratado antes", 100, 520, 30),
        run("da recuperação", 430, 520, 30),
        run("judicial não vai", 100, 560, 30),
        run("@bismarchipires", 700, 1300, 22, "Gotham-Medium"),
      ],
      1080
    );
    expect(blocks.map((b) => b.text)).toEqual(["BLOQUEIO NÃO É\nPAGAMENTO", "Valor tratado antes da recuperação\njudicial não vai", "@bismarchipires"]);
    expect(blocks[0].upper).toBe(true);
    expect(blocks[0].lineHeight).toBe(1.13);
    expect(blocks[1].lines).toBe(2);
    expect(blocks[0].runs).toHaveLength(2);
  });

  it("descobre o alinhamento pelas bordas das linhas", () => {
    const [centered] = groupTextBlocks([run("linha bem comprida aqui", 290, 400, 40, "X", 500), run("curta", 465, 450, 40, "X", 150)], 1080);
    expect(centered.align).toBe("center");
    const [right] = groupTextBlocks([run("comprida", 300, 400, 40, "X", 500), run("curta", 650, 450, 40, "X", 150)], 1080);
    expect(right.align).toBe("right");
  });

  it("caixa começa acima da linha base e cabe as linhas", () => {
    const [block] = groupTextBlocks([run("A", 100, 300, 100, "X", 60), run("B", 100, 420, 100, "X", 60)], 1080);
    const box = blockBox(block);
    expect(box.y).toBe(Math.round(300 - 100 * (0.75 + 0.1)));
    expect(box.h).toBe(Math.round(2 * 1.2 * 100 + 2));
    expect(blockBox(block, 1).linhas).toBe(3);
  });

  it("peso e nome da fonte", () => {
    expect(weightFromName("Gotham-Bold")).toBe(700);
    expect(weightFromName("Montserrat-SemiBold")).toBe(600);
    expect(weightFromName("Gotham-Book")).toBe(400);
    expect(cleanFontName("ABCDEF+Gotham-Book")).toBe("Gotham-Book");
  });
});
