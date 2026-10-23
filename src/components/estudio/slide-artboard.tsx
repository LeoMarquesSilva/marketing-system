"use client";

import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { getTemplate } from "@/lib/estudio/templates";
import { ARTBOARD_SIZE, type PieceKind, type StudioSlide } from "@/lib/estudio/types";
import { TEMPLATE_COMPONENTS } from "./templates";

interface SlideProps {
  slide: StudioSlide;
  indice: number;
  total: number;
  tipo: PieceKind;
}

export function slideSize(slide: StudioSlide) {
  const template = getTemplate(slide.modelo);
  return ARTBOARD_SIZE[template?.formato ?? "feed"];
}

/** A arte em tamanho real (1080 px). É este nó que vira PNG. */
export const SlideArtboard = forwardRef<HTMLDivElement, SlideProps>(function SlideArtboard({ slide, indice, total, tipo }, ref) {
  const Component = TEMPLATE_COMPONENTS[slide.modelo];
  const { width, height } = slideSize(slide);
  return (
    // estilos herdados zerados: as miniaturas ficam dentro de <button> (que centraliza texto)
    <div
      ref={ref}
      style={{ width, height, position: "relative", background: "#050e16", textAlign: "left", lineHeight: "normal", letterSpacing: "normal", whiteSpace: "normal", fontStyle: "normal", fontWeight: 400, textTransform: "none" }}
    >
      {Component ? (
        <Component valores={slide.valores} indice={indice} total={total} tipo={tipo} />
      ) : (
        <div style={{ color: "#fff", padding: 80, fontSize: 32 }}>Modelo não encontrado: {slide.modelo}</div>
      )}
    </div>
  );
});

/** Mostra a prancheta escalada para caber na largura disponível (ou em `width` fixa). */
export function ScaledBox({ width: fixedWidth, artWidth, artHeight, children }: { width?: number; artWidth: number; artHeight: number; children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(fixedWidth ?? 0);

  useEffect(() => {
    if (fixedWidth || !boxRef.current) return;
    const el = boxRef.current;
    const observer = new ResizeObserver(([entry]) => setMeasured(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [fixedWidth]);

  const width = fixedWidth ?? measured;
  const scale = width > 0 ? width / artWidth : 0;
  return (
    <div ref={boxRef} style={{ width: fixedWidth ?? "100%", height: artHeight * scale, position: "relative", overflow: "hidden" }}>
      <div style={{ width: artWidth, height: artHeight, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
        {children}
      </div>
    </div>
  );
}
