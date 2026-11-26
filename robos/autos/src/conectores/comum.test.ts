import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dividirPdfGrande } from "./comum";

// PDF fictício: páginas com texto qualquer. Limites pequenos no teste para forçar a divisão sem arquivo gigante.
let pasta = "";
beforeAll(async () => {
  pasta = await mkdtemp(join(tmpdir(), "dividir-pdf-"));
});
afterAll(async () => {
  await rm(pasta, { recursive: true, force: true });
});

async function pdfDeTeste(paginas: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < paginas; i += 1) doc.addPage([595, 842]).drawText(`pagina ${i + 1} ${"x".repeat(2000)}`, { x: 20, y: 400, size: 6, font: fonte });
  return doc.save({ useObjectStreams: false });
}

describe("PDF acima do limite", () => {
  it("não mexe no arquivo que cabe", async () => {
    const arquivo = join(pasta, "pequeno.pdf");
    await writeFile(arquivo, await pdfDeTeste(3));
    expect(await dividirPdfGrande(arquivo)).toBeNull();
  });

  it("divide por páginas, com a primeira parte no próprio arquivo e todas as páginas preservadas", async () => {
    const arquivo = join(pasta, "grande.pdf");
    await writeFile(arquivo, await pdfDeTeste(40));
    const { size } = await stat(arquivo);
    const partes = await dividirPdfGrande(arquivo, Math.floor(size * 0.6), Math.floor(size * 0.3));
    expect(partes).not.toBeNull();
    expect(partes![0]).toBe(arquivo);
    expect(partes!.length).toBeGreaterThanOrEqual(2);
    let paginas = 0;
    for (const parte of partes!) {
      expect((await stat(parte)).size).toBeLessThanOrEqual(Math.floor(size * 0.6));
      paginas += (await PDFDocument.load(await readFile(parte))).getPageCount();
    }
    expect(paginas).toBe(40);
  });
});
