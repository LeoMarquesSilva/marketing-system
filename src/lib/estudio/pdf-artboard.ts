import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, type PDFPage } from "pdf-lib";
import { binaryToBytes, bytesToBinary, removeTextInZones, type Zone } from "./pdf-clean";

/** Content stream da página inteiro (pode vir em vários pedaços). */
export function pageContentSource(doc: PDFDocument, page: PDFPage): string {
  const contents = page.node.get(PDFName.of("Contents"));
  const resolved = contents ? doc.context.lookup(contents) : null;
  const refs = resolved instanceof PDFArray ? resolved.asArray() : contents ? [contents] : [];
  return refs
    .map((ref) => {
      const stream = doc.context.lookup(ref);
      return stream instanceof PDFRawStream ? bytesToBinary(decodePDFRawStream(stream).decode()) : "";
    })
    .join("\n");
}

/**
 * PDF de uma página só (a prancheta escolhida) sem os textos que começam nas regiões.
 * Os dados privados do Illustrator ficam de fora para o arquivo não pesar.
 */
export async function cleanArtboard(bytes: Uint8Array, pageIndex: number, zones: Zone[]): Promise<{ pdf: Uint8Array; removed: number }> {
  const src = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  src.getPage(pageIndex).node.delete(PDFName.of("PieceInfo"));
  const doc = await PDFDocument.create();
  const [page] = await doc.copyPages(src, [pageIndex]);
  doc.addPage(page);
  const { cleaned, removed } = removeTextInZones(pageContentSource(doc, page), zones);
  page.node.set(PDFName.of("Contents"), doc.context.register(doc.context.flateStream(binaryToBytes(cleaned))));
  return { pdf: await doc.save(), removed };
}
