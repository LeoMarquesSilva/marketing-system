import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { cleanArtboard, pageContentSource } from "./pdf-artboard";
import { binaryToBytes, bytesToBinary, removeTextInZones, tokenizeOps } from "./pdf-clean";

/** Prancheta de teste: 2ª página com um título sobre um retângulo e um rodapé. */
async function artboards(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([1080, 1350]);
  const page = doc.addPage([1080, 1350]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 80, y: 1180, width: 600, height: 90 });
  page.drawText("TITULO", { x: 100, y: 1200, size: 60, font });
  page.drawText("rodape fixo", { x: 100, y: 100, size: 24, font });
  return doc.save();
}

async function contentOf(pdf: Uint8Array, index = 0): Promise<string> {
  const doc = await PDFDocument.load(pdf);
  return pageContentSource(doc, doc.getPage(index));
}

describe("limpeza do texto da prancheta", () => {
  it("tira só o texto que começa na região e mantém formas e o resto", async () => {
    const source = await contentOf(await artboards(), 1);
    const { pdf, removed } = await cleanArtboard(await artboards(), 1, [{ x0: 90, y0: 1190, x1: 700, y1: 1270 }]);
    const cleaned = await contentOf(pdf);
    expect(tokenizeOps(source).filter((o) => o.op === "Tj")).toHaveLength(2);
    expect(removed).toBe(1);
    expect(tokenizeOps(cleaned).filter((o) => o.op === "Tj")).toHaveLength(1);
    // o retângulo atrás do título continua
    expect(tokenizeOps(cleaned).filter((o) => o.op === "m" || o.op === "re").length).toBe(tokenizeOps(source).filter((o) => o.op === "m" || o.op === "re").length);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });

  it("sem regiões não muda nada", async () => {
    const source = await contentOf(await artboards(), 1);
    expect(removeTextInZones(source, []).cleaned).toBe(source);
  });

  it("lê strings com parênteses e arrays de TJ sem se perder", () => {
    const ops = tokenizeOps("BT /F1 12 Tf 10 20 Td (a \\) b (c)) Tj [(x) -20 (y)] TJ ET");
    expect(ops.map((o) => o.op)).toEqual(["BT", "Tf", "Td", "Tj", "TJ", "ET"]);
    const { removed } = removeTextInZones("BT 1 0 0 1 10 20 Tm (a) Tj 0 -30 Td (b) Tj ET", [{ x0: 0, y0: 15, x1: 50, y1: 25 }]);
    expect(removed).toBe(1);
  });

  it("converte bytes e texto sem perder os bytes altos", () => {
    const bytes = new Uint8Array([0, 0x80, 0x93, 0xff, 65]);
    expect(Array.from(binaryToBytes(bytesToBinary(bytes)))).toEqual(Array.from(bytes));
  });
});
