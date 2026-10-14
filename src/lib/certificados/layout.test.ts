import { describe, expect, it } from "vitest";
import { layoutParagraph, PAGE, PARAGRAPH, signatureSlots, wrapRuns, type MeasureText } from "./layout";
import type { TextRun } from "./model";

// Fonte de largura fixa: 10 pt por caractere, para contas fáceis.
const measure: MeasureText = (text) => text.length * 10;
const text = (lines: TextRun[][]) => lines.map((runs) => runs.map((r) => r.text).join(""));

describe("quebra de linha", () => {
  it("não quebra quando cabe", () => {
    expect(text(wrapRuns([{ text: "uma linha curta", weight: "regular" }], measure, 200))).toEqual(["uma linha curta"]);
  });

  it("equilibra as linhas em vez de deixar sobra curta", () => {
    const lines = text(wrapRuns([{ text: "aaaa bbbb cccc dddd eeee", weight: "regular" }], measure, 200));
    expect(lines).toEqual(["aaaa bbbb cccc", "dddd eeee"]);
  });

  it("mantém o nome em destaque inteiro numa linha", () => {
    const runs: TextRun[] = [
      { text: "certifica que ", weight: "regular" },
      { text: "ANA NUNES", weight: "bold" },
    ];
    const lines = wrapRuns(runs, measure, 150);
    expect(text(lines)).toEqual(["certifica que", "ANA NUNES"]);
    expect(lines[1]).toEqual([{ text: "ANA NUNES", weight: "bold" }]);
  });
});

describe("parágrafo", () => {
  it("reduz a fonte um pouco antes de quebrar", () => {
    const line = [{ text: "x".repeat(70), weight: "regular" as const }]; // 700 pt no tamanho padrão
    const result = layoutParagraph([line], measure);
    expect(result.lines).toHaveLength(1);
    expect(result.size).toBeLessThan(PARAGRAPH.fontSize);
    expect(result.size).toBeGreaterThanOrEqual(PARAGRAPH.minFontSize);
  });

  it("quebra só a linha que não cabe, sem quebrar a do nome", () => {
    const nameLine = [{ text: "x".repeat(70), weight: "regular" as const }];
    const courseLine = [{ text: Array.from({ length: 20 }, () => "palavra").join(" "), weight: "regular" as const }];
    const result = layoutParagraph([nameLine, courseLine], measure);
    expect(result.size).toBeLessThan(PARAGRAPH.fontSize);
    expect(text(result.lines)[0]).toBe("x".repeat(70));
    expect(result.lines.length).toBeGreaterThan(2);
  });

  it("quebra quando reduzir não basta", () => {
    const line = [{ text: Array.from({ length: 20 }, () => "palavra").join(" "), weight: "regular" as const }];
    const result = layoutParagraph([line], measure);
    expect(result.size).toBe(PARAGRAPH.fontSize);
    expect(result.lines.length).toBeGreaterThan(1);
  });
});

describe("linha de assinaturas", () => {
  it("reproduz o espaçamento do modelo com três pessoas", () => {
    const slots = signatureSlots(3);
    expect(slots[1].centerX).toBeCloseTo(PAGE.width / 2);
    expect(slots[2].centerX - slots[1].centerX).toBeCloseTo(256.4);
    expect(slots[0].lineWidth).toBeCloseTo(170.5);
  });

  it("centraliza uma pessoa só e aperta com muitas", () => {
    expect(signatureSlots(1)[0].centerX).toBeCloseTo(PAGE.width / 2);
    const five = signatureSlots(5);
    expect(five[4].centerX - five[0].centerX).toBeLessThan(PAGE.width);
    expect(five[0].lineWidth).toBeLessThan(170.5);
    expect(signatureSlots(0)).toEqual([]);
  });
});
