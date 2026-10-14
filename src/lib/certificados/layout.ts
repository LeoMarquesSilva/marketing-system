// Medidas do modelo "Certificados.ai" (A4 deitado, em pontos, origem no canto
// superior esquerdo como no Illustrator). O gerador converte para o PDF.

import type { CertificateWeight, PartnerId, TextRun } from "./model";

export const PAGE = { width: 841.89, height: 595.276 };

export const TEXT_COLOR = { r: 0x1d / 255, g: 0x24 / 255, b: 0x2f / 255 };
export const LINE_COLOR = { r: 0.859, g: 0.714, b: 0.42 };

export const PARAGRAPH = {
  fontSize: 16,
  /** Até aqui a fonte diminui para manter as linhas do texto; abaixo disso, quebra. */
  minFontSize: 14.5,
  /** Distância entre as linhas de base do parágrafo no modelo. */
  leading: 23.5,
  centerX: PAGE.width / 2,
  /** Linha de base do meio do bloco de três linhas do modelo. */
  centerBaseline: 322.93,
  maxWidth: 680,
};

export const SIGNATURE_ROW = {
  lineY: 513,
  lineThickness: 1,
  lineWidth: 170.5,
  nameBaseline: 533.88,
  nameSize: 16,
  roleBaseline: 556.25,
  roleSize: 12,
  /** Espaço entre centros com três assinaturas, como no modelo. */
  maxSpacing: 256.4,
  rowWidth: 770,
  /** Assinatura enviada pela tela: caixa acima da linha. */
  imageMaxHeight: 72,
  imageOverlap: 6,
};

/** Posição das assinaturas vetoriais dos sócios em relação ao centro da linha. */
export const PARTNER_SIGNATURE_BOXES: Record<PartnerId, { dx: number; dy: number; width: number; height: number }> = {
  ricardo: { dx: -64.74, dy: -106.81, width: 175.68, height: 155.68 },
  gustavo: { dx: -79.43, dy: -83.48, width: 171.37, height: 87.06 },
};

export interface SignatureSlot {
  centerX: number;
  lineWidth: number;
  /** Largura máxima de nome e cargo antes de reduzir a fonte. */
  maxTextWidth: number;
  /** Escala das assinaturas quando a linha fica apertada. */
  signatureMaxWidth: number;
}

/** Distribui as assinaturas na linha de baixo, centralizadas na página. */
export function signatureSlots(count: number): SignatureSlot[] {
  if (count <= 0) return [];
  const spacing = Math.min(SIGNATURE_ROW.maxSpacing, SIGNATURE_ROW.rowWidth / count);
  const lineWidth = Math.min(SIGNATURE_ROW.lineWidth, spacing - 20);
  return Array.from({ length: count }, (_, index) => ({
    centerX: PAGE.width / 2 + (index - (count - 1) / 2) * spacing,
    lineWidth,
    maxTextWidth: spacing - 14,
    signatureMaxWidth: spacing - 8,
  }));
}

/** Maior tamanho de fonte (até `size`) em que o texto cabe em `maxWidth`. */
export function fitFontSize(widthAtSize: number, size: number, maxWidth: number, minSize: number): number {
  if (widthAtSize <= maxWidth || widthAtSize <= 0) return size;
  return Math.max(minSize, Math.floor(((size * maxWidth) / widthAtSize) * 10) / 10);
}

export type MeasureText = (text: string, weight: CertificateWeight) => number;

type Word = TextRun[];

function wordWidth(word: Word, measure: MeasureText): number {
  return word.reduce((sum, piece) => sum + measure(piece.text, piece.weight), 0);
}

/**
 * Separa a linha em palavras. Trechos em destaque que cabem numa linha (nome
 * da pessoa, data) não são quebrados no meio.
 */
function toWords(runs: TextRun[], measure: MeasureText, maxWidth: number): Word[] {
  const words: Word[] = [];
  let current: Word = [];
  const push = (char: string, weight: CertificateWeight) => {
    const last = current[current.length - 1];
    if (last && last.weight === weight) last.text += char;
    else current.push({ text: char, weight });
  };
  for (const run of runs) {
    const trimmed = run.text.trim();
    const keepTogether = run.weight !== "regular" && measure(trimmed, run.weight) <= maxWidth;
    const start = run.text.indexOf(trimmed);
    const end = start + trimmed.length;
    for (let i = 0; i < run.text.length; i++) {
      const char = run.text[i];
      const breakable = char === " " && !(keepTogether && i > start && i < end);
      if (breakable) {
        if (current.length) words.push(current);
        current = [];
      } else {
        push(char, run.weight);
      }
    }
  }
  if (current.length) words.push(current);
  return words;
}

function greedyLines(widths: number[], space: number, maxWidth: number): number[][] {
  const lines: number[][] = [];
  let line: number[] = [];
  let lineWidth = 0;
  widths.forEach((width, index) => {
    const next = line.length ? lineWidth + space + width : width;
    if (line.length && next > maxWidth) {
      lines.push(line);
      line = [index];
      lineWidth = width;
    } else {
      line.push(index);
      lineWidth = next;
    }
  });
  if (line.length) lines.push(line);
  return lines;
}

/**
 * Quebra uma linha do texto para caber em `maxWidth`. Quando precisa de mais
 * de uma linha, equilibra o tamanho delas em vez de deixar uma sobra curta.
 */
export function wrapRuns(runs: TextRun[], measure: MeasureText, maxWidth: number): TextRun[][] {
  const words = toWords(runs, measure, maxWidth);
  if (words.length === 0) return [];
  const widths = words.map((word) => wordWidth(word, measure));
  const space = measure(" ", "regular");
  let lines = greedyLines(widths, space, maxWidth);
  if (lines.length > 1) {
    const total = widths.reduce((a, b) => a + b, 0) + space * (widths.length - 1);
    let lo = Math.max(Math.max(...widths), total / lines.length);
    let hi = maxWidth;
    for (let i = 0; i < 24 && hi - lo > 0.5; i++) {
      const mid = (lo + hi) / 2;
      if (greedyLines(widths, space, mid).length <= lines.length) hi = mid;
      else lo = mid;
    }
    lines = greedyLines(widths, space, hi);
  }
  return lines.map((indexes) => {
    const out: TextRun[] = [];
    indexes.forEach((wordIndex, position) => {
      const pieces = position > 0 ? [{ text: " ", weight: "regular" as const }, ...words[wordIndex]] : words[wordIndex];
      for (const piece of pieces) {
        const last = out[out.length - 1];
        if (last && last.weight === piece.weight) last.text += piece.text;
        else out.push({ ...piece });
      }
    });
    return out;
  });
}

const lineWidth = (runs: TextRun[], measure: MeasureText) =>
  runs.reduce((sum, run) => sum + measure(run.text, run.weight), 0);

/**
 * Mantém as linhas do texto como foram escritas: a linha que passa um pouco
 * da largura faz a fonte diminuir (até `minFontSize`); a que nem assim cabe
 * (curso muito longo) é quebrada, sem mexer nas outras.
 * `measure` mede no tamanho padrão do parágrafo.
 */
export function layoutParagraph(lines: TextRun[][], measure: MeasureText): { size: number; lines: TextRun[][] } {
  const { fontSize, maxWidth, minFontSize } = PARAGRAPH;
  const fitSizes = lines
    .map((runs) => lineWidth(runs, measure))
    .filter((width) => width > maxWidth)
    .map((width) => Math.floor(((fontSize * maxWidth) / width) * 10) / 10)
    .filter((size) => size >= minFontSize);
  const size = Math.min(fontSize, ...fitSizes);
  const scale = size / fontSize;
  const measureAtSize: MeasureText = (text, weight) => measure(text, weight) * scale;
  return {
    size,
    lines: lines.flatMap((runs) =>
      lineWidth(runs, measureAtSize) > maxWidth ? wrapRuns(runs, measureAtSize, maxWidth) : [runs]
    ),
  };
}
