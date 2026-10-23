"use client";

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { cleanFontName, type TextRun } from "@/lib/estudio/pdf-text";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

/** Abre o .ai/.pdf (o pdf.js leva uma cópia dos bytes para o worker). */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
}

export async function renderPage(page: PDFPageProxy, width: number, background?: string): Promise<HTMLCanvasElement> {
  const scale = width / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport, background }).promise;
  return canvas;
}

export type ArtboardShape = { formato: "feed" | "story"; width: number; height: number } | { formato: null; ratio: number };

/** 4:5 vira feed (1080×1350) e 9:16 vira story (1080×1920); o resto não serve. */
export function artboardShape(page: PDFPageProxy): ArtboardShape {
  const { width, height } = page.getViewport({ scale: 1 });
  const ratio = height / width;
  if (Math.abs(ratio - 1.25) < 0.02) return { formato: "feed", width: 1080, height: 1350 };
  if (Math.abs(ratio - 16 / 9) < 0.03) return { formato: "story", width: 1080, height: 1920 };
  return { formato: null, ratio };
}

interface PdfFont {
  name?: string;
  ascent?: number;
}

/** Trechos de texto da prancheta na régua de 1080 px, com o nome real da fonte. */
export async function readTextRuns(page: PDFPageProxy): Promise<{ runs: TextRun[]; scale: number }> {
  const scale = 1080 / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  // as fontes só ficam em commonObjs depois da lista de operações
  await page.getOperatorList();
  const content = await page.getTextContent();
  const runs: TextRun[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const [a, b, c, d, e, f] = item.transform as number[];
    // texto girado não vira campo
    if (Math.abs(b) > 0.01 * Math.abs(a) || Math.abs(c) > 0.01 * Math.abs(d)) continue;
    const [x, y] = viewport.convertToViewportPoint(e, f);
    let font: PdfFont | null = null;
    try {
      font = page.commonObjs.get(item.fontName) as PdfFont;
    } catch {
      font = null;
    }
    runs.push({
      str: item.str,
      x,
      y,
      width: item.width * scale,
      size: Math.hypot(c, d) * scale,
      font: cleanFontName(font?.name ?? item.fontName),
      ascent: font?.ascent ?? 0.8,
      anchor: [e, f],
    });
  }
  return { runs, scale };
}

/** Região (espaço do PDF) que cobre o começo de cada trecho do bloco. */
export function zonesFor(runs: TextRun[], scale: number) {
  return runs.map((r) => {
    const size = r.size / scale;
    return { x0: r.anchor[0] - 1, x1: r.anchor[0] + r.width / scale + 1, y0: r.anchor[1] - size * 0.35, y1: r.anchor[1] + size * 0.35 };
  });
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/**
 * Cor do texto: pixels que mudaram entre a prancheta original e o fundo limpo, dentro
 * da caixa; a mediana deles na original.
 */
export function measureTextColor(original: HTMLCanvasElement, cleaned: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }): string | null {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const w = Math.min(original.width - x, Math.ceil(box.w));
  const h = Math.min(original.height - y, Math.ceil(box.h));
  if (w <= 0 || h <= 0) return null;
  const a = original.getContext("2d")!.getImageData(x, y, w, h).data;
  const b = cleaned.getContext("2d")!.getImageData(x, y, w, h).data;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let i = 0; i < a.length; i += 4) {
    const diff = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    if (diff > 150) {
      rs.push(a[i]);
      gs.push(a[i + 1]);
      bs.push(a[i + 2]);
    }
  }
  if (rs.length < 8) return null;
  const mid = (list: number[]) => list.sort((p, q) => p - q)[Math.floor(list.length / 2)];
  return `#${hex(mid(rs))}${hex(mid(gs))}${hex(mid(bs))}`;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem."))), type, quality));
}
