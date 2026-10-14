"use client";

import { useEffect, useRef, useState } from "react";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

/**
 * Desenha a primeira página de um PDF num canvas. Usado no lugar do leitor de
 * PDF do navegador, que muda de um navegador para outro e não abre no celular.
 */
export function PdfPagePreview({
  bytes,
  label,
  onError,
}: {
  bytes: Uint8Array | null;
  label: string;
  onError?: (error: unknown) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!bytes || width === 0) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;
    let cancelRender: (() => void) | null = null;

    (async () => {
      const pdfjs = await loadPdfJs();
      // O pdf.js transfere o buffer para o worker; manda uma cópia.
      const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
      destroy = () => void loadingTask.destroy();
      const doc = await loadingTask.promise;
      const page = await doc.getPage(1);
      if (cancelled) return;
      const scale = (width / page.getViewport({ scale: 1 }).width) * (window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale });
      // Desenha fora da tela e troca de uma vez, sem piscar durante a digitação.
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.ceil(viewport.width);
      offscreen.height = Math.ceil(viewport.height);
      const task = page.render({ canvasContext: offscreen.getContext("2d")!, viewport });
      cancelRender = () => task.cancel();
      await task.promise;
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      canvas.getContext("2d")!.drawImage(offscreen, 0, 0);
    })().catch((error: unknown) => {
      if (!cancelled && (error as { name?: string })?.name !== "RenderingCancelledException") {
        onErrorRef.current?.(error);
      }
    });

    return () => {
      cancelled = true;
      cancelRender?.();
      destroy?.();
    };
  }, [bytes, width]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} role="img" aria-label={label} className="block h-full w-full" />
    </div>
  );
}
