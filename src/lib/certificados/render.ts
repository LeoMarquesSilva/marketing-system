// Monta o PDF dos certificados com pdf-lib. Roda no navegador (prévia e
// download) e pode rodar no servidor (envio por e-mail), desde que receba os
// arquivos do modelo já carregados.

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFEmbeddedPage, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  buildCertificateText,
  buildSignatories,
  type CertificateConfig,
  type CertificateWeight,
  type PartnerId,
  type SignatureImage,
} from "./model";
import {
  fitFontSize,
  LINE_COLOR,
  PAGE,
  PARAGRAPH,
  PARTNER_SIGNATURE_BOXES,
  SIGNATURE_ROW,
  signatureSlots,
  TEXT_COLOR,
  layoutParagraph,
} from "./layout";

export interface CertificateAssets {
  background: Uint8Array;
  partnerSignatures: Record<PartnerId, Uint8Array>;
  fonts: Record<CertificateWeight, Uint8Array>;
}

const textColor = rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b);
const lineColor = rgb(LINE_COLOR.r, LINE_COLOR.g, LINE_COLOR.b);

/** Converte o y do Illustrator (topo) para o do PDF (base). */
const pdfY = (top: number) => PAGE.height - top;

interface DocumentResources {
  background: PDFEmbeddedPage;
  fonts: Record<CertificateWeight, PDFFont>;
  partners: Partial<Record<PartnerId, PDFEmbeddedPage>>;
  images: Map<SignatureImage, PDFImage>;
}

async function embedResources(
  doc: PDFDocument,
  assets: CertificateAssets,
  config: CertificateConfig
): Promise<DocumentResources> {
  doc.registerFontkit(fontkit);
  const [background] = await doc.embedPdf(assets.background);
  const [regular, medium, bold] = await Promise.all([
    doc.embedFont(assets.fonts.regular, { subset: true }),
    doc.embedFont(assets.fonts.medium, { subset: true }),
    doc.embedFont(assets.fonts.bold, { subset: true }),
  ]);
  const partners: DocumentResources["partners"] = {};
  for (const id of config.socios) {
    [partners[id]] = await doc.embedPdf(assets.partnerSignatures[id]);
  }
  const images = new Map<SignatureImage, PDFImage>();
  for (const facilitador of config.facilitadores) {
    const image = facilitador.assinatura;
    if (!image || images.has(image)) continue;
    images.set(image, image.format === "png" ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes));
  }
  return { background, fonts: { regular, medium, bold }, partners, images };
}

function drawParagraph(page: PDFPage, res: DocumentResources, config: CertificateConfig, participante: string) {
  const { size, lines } = layoutParagraph(buildCertificateText(config, participante), (text, weight) =>
    res.fonts[weight].widthOfTextAtSize(text, PARAGRAPH.fontSize)
  );
  const measure = (text: string, weight: CertificateWeight) => res.fonts[weight].widthOfTextAtSize(text, size);
  const firstBaseline = PARAGRAPH.centerBaseline - ((lines.length - 1) * PARAGRAPH.leading) / 2;
  lines.forEach((runs, index) => {
    const width = runs.reduce((sum, run) => sum + measure(run.text, run.weight), 0);
    let x = PARAGRAPH.centerX - width / 2;
    const y = pdfY(firstBaseline + index * PARAGRAPH.leading);
    for (const run of runs) {
      page.drawText(run.text, { x, y, size, font: res.fonts[run.weight], color: textColor });
      x += measure(run.text, run.weight);
    }
  });
}

function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, centerX: number, baseline: number) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y: pdfY(baseline), size, font, color: textColor });
}

function drawSignatures(page: PDFPage, res: DocumentResources, config: CertificateConfig) {
  const signatories = buildSignatories(config);
  const slots = signatureSlots(signatories.length);
  const nameFont = res.fonts.medium;
  const roleFont = res.fonts.regular;
  const roles = signatories.map((s) => s.cargo.toLocaleUpperCase("pt-BR"));
  // Mesmo tamanho para todos os nomes (e cargos) da linha, pelo que mais aperta.
  const nameSize = Math.min(
    SIGNATURE_ROW.nameSize,
    ...signatories.map((s, i) =>
      fitFontSize(nameFont.widthOfTextAtSize(s.nome, SIGNATURE_ROW.nameSize), SIGNATURE_ROW.nameSize, slots[i].maxTextWidth, 9)
    )
  );
  // Cargo nunca maior que o nome: mantém a proporção 12/16 do modelo.
  const roleSize = Math.min(
    (nameSize * SIGNATURE_ROW.roleSize) / SIGNATURE_ROW.nameSize,
    ...roles.map((role, i) =>
      fitFontSize(roleFont.widthOfTextAtSize(role, SIGNATURE_ROW.roleSize), SIGNATURE_ROW.roleSize, slots[i].maxTextWidth, 8)
    )
  );
  signatories.forEach((signatory, index) => {
    const slot = slots[index];
    const { lineY } = SIGNATURE_ROW;

    // Assinatura por baixo da linha e do nome, como no modelo.
    if (signatory.assinatura?.kind === "partner") {
      const embedded = res.partners[signatory.assinatura.id];
      const box = PARTNER_SIGNATURE_BOXES[signatory.assinatura.id];
      if (embedded) {
        const scale = Math.min(1, slot.signatureMaxWidth / box.width);
        page.drawPage(embedded, {
          x: slot.centerX + box.dx * scale,
          y: pdfY(lineY + (box.dy + box.height) * scale),
          width: box.width * scale,
          height: box.height * scale,
        });
      }
    } else if (signatory.assinatura?.kind === "image") {
      const image = res.images.get(signatory.assinatura.image);
      if (image) {
        const scale = Math.min(
          slot.signatureMaxWidth / image.width,
          SIGNATURE_ROW.imageMaxHeight / image.height
        );
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, {
          x: slot.centerX - width / 2,
          y: pdfY(lineY + SIGNATURE_ROW.imageOverlap),
          width,
          height,
        });
      }
    }

    page.drawLine({
      start: { x: slot.centerX - slot.lineWidth / 2, y: pdfY(lineY) },
      end: { x: slot.centerX + slot.lineWidth / 2, y: pdfY(lineY) },
      thickness: SIGNATURE_ROW.lineThickness,
      color: lineColor,
    });

    drawCentered(page, signatory.nome, nameFont, nameSize, slot.centerX, SIGNATURE_ROW.nameBaseline);
    if (roles[index]) {
      drawCentered(page, roles[index], roleFont, roleSize, slot.centerX, SIGNATURE_ROW.roleBaseline);
    }
  });
}

/** Um PDF com uma página por participante (fundo e fontes embutidos uma vez só). */
export async function renderCertificatesPdf(
  assets: CertificateAssets,
  config: CertificateConfig,
  participantes: string[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const res = await embedResources(doc, assets, config);
  for (const participante of participantes) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    page.drawPage(res.background, { x: 0, y: 0, width: PAGE.width, height: PAGE.height });
    drawParagraph(page, res, config, participante);
    drawSignatures(page, res, config);
  }
  const titulo = participantes.length === 1 ? `Certificado - ${participantes[0]}` : `Certificados - ${config.curso}`;
  doc.setTitle(titulo);
  doc.setAuthor("Bismarchi | Pires Sociedade de Advogados");
  doc.setSubject(config.curso);
  doc.setCreator("ORQESTRAI");
  doc.setProducer("ORQESTRAI");
  return doc.save();
}
