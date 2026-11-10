import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { extrairPaginas } from "./leitura-pdf";

async function pdfDeTeste(paginas: string[][]): Promise<Uint8Array> {
  const documento = await PDFDocument.create();
  const fonte = await documento.embedFont(StandardFonts.Helvetica);
  for (const linhas of paginas) {
    const pagina = documento.addPage([595, 842]);
    linhas.forEach((linha, indice) => pagina.drawText(linha, { x: 50, y: 780 - indice * 18, size: 11, font: fonte }));
  }
  return documento.save();
}

describe("extrairPaginas", () => {
  it("devolve o texto de cada página, na ordem", async () => {
    const bytes = await pdfDeTeste([["EXECUCAO DE TITULO EXTRAJUDICIAL", "Exequente: Credora Eletrica Ltda"], [], ["Certifico que citei o executado em 15/03/2024."]]);
    const texto = await extrairPaginas(bytes);
    expect(texto.total).toBe(3);
    expect(texto.paginas).toHaveLength(3);
    expect(texto.paginas[0]).toContain("EXECUCAO DE TITULO EXTRAJUDICIAL");
    expect(texto.paginas[0]).toContain("Credora Eletrica Ltda");
    expect(texto.paginas[1]).toBe("");
    expect(texto.paginas[2]).toContain("citei o executado em 15/03/2024");
  });

  it("para no limite de páginas e ainda informa o total", async () => {
    const bytes = await pdfDeTeste([["um"], ["dois"], ["tres"]]);
    const texto = await extrairPaginas(bytes, 2);
    expect(texto.total).toBe(3);
    expect(texto.paginas).toHaveLength(2);
  });

  it("recusa o que não é PDF", async () => {
    await expect(extrairPaginas(new TextEncoder().encode("isto não é um PDF"))).rejects.toThrow();
  });
});
