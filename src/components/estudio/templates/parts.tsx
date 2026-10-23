"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import type { FieldValues, ListItem } from "@/lib/estudio/fields";
import type { PieceKind, SlideAdjust } from "@/lib/estudio/types";

export interface SlideRenderProps {
  valores: FieldValues;
  indice: number;
  total: number;
  tipo: PieceKind;
  ajustes?: SlideAdjust;
}

/** Ajustes com os valores neutros preenchidos. */
export function adjust(a: SlideAdjust | undefined) {
  return {
    texto: a?.texto ?? 1,
    titulo: a?.titulo ?? 1,
    y: a?.y ?? 0,
    fotoZoom: a?.fotoZoom ?? 1,
    fotoX: a?.fotoX ?? 0,
    fotoY: a?.fotoY ?? 0,
  };
}

export const text = (values: FieldValues, key: string): string => {
  const v = values[key];
  return typeof v === "string" ? v.trim() : "";
};

export const flag = (values: FieldValues, key: string): boolean => values[key] === true;

export const items = (values: FieldValues, key: string): ListItem[] => {
  const v = values[key];
  return Array.isArray(v) ? v : [];
};

/** Recalcula quando as fontes terminam de carregar (as medidas mudam com a fonte real). */
function useFontsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let alive = true;
    const bump = () => alive && setVersion((v) => v + 1);
    void document.fonts.ready.then(bump);
    document.fonts.addEventListener?.("loadingdone", bump);
    return () => {
      alive = false;
      document.fonts.removeEventListener?.("loadingdone", bump);
    };
  }, []);
  return version;
}

/**
 * Texto que diminui a fonte até caber em `maxLines` linhas (sem passar de `min`).
 * Mede no tamanho real da prancheta, antes de pintar.
 */
export function FitText({
  as: Tag = "p",
  children,
  size,
  min,
  maxLines,
  lineHeight = 1.2,
  className,
  style,
}: {
  as?: ElementType;
  children: string;
  size: number;
  min: number;
  maxLines: number;
  lineHeight?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const fontsVersion = useFontsVersion();

  // O tamanho fica só no DOM (fora do style do React), para o React não desfazer o ajuste.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let current = size;
    el.style.fontSize = `${current}px`;
    while (current > min && el.offsetHeight > maxLines * current * lineHeight + 2) {
      current -= 1;
      el.style.fontSize = `${current}px`;
    }
  }, [children, size, min, maxLines, lineHeight, fontsVersion]);

  return (
    <Tag ref={ref} className={className} style={{ ...style, lineHeight }}>
      {children}
    </Tag>
  );
}

/**
 * Coluna que reduz a fonte-base (e tudo o que está em em) até o conteúdo caber na
 * altura dela, sem passar de `minScale`.
 */
export function FitColumn({
  children,
  base,
  minScale = 0.72,
  className,
  style,
  deps,
}: {
  children: ReactNode;
  base: number;
  minScale?: number;
  className?: string;
  style?: CSSProperties;
  deps: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fontsVersion = useFontsVersion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let scale = 1;
    el.style.fontSize = `${base}px`;
    while (scale > minScale && el.scrollHeight > el.clientHeight + 1) {
      scale = Math.round((scale - 0.02) * 100) / 100;
      el.style.fontSize = `${base * scale}px`;
    }
  }, [deps, base, minScale, fontsVersion]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

/** Texto com **negrito**. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.+?\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part
      )}
    </>
  );
}

// ---------- ícones (traço branco, como nas pranchetas) ----------

type IconProps = { size: number; className?: string };

export function CalendarIcon({ size, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <rect x="4" y="6" width="24" height="22" rx="4" />
      <path d="M4 12.5h24M10.5 3.5v5M21.5 3.5v5" strokeLinecap="round" />
      {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => <circle key={`${c}-${r}`} cx={9.5 + c * 4.3} cy={16.8 + r * 3.8} r={1.1} fill="currentColor" stroke="none" />))}
    </svg>
  );
}

export function ClockIcon({ size, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <circle cx="16" cy="16" r="12.5" />
      <path d="M16 9v7.5l-3 4" strokeLinecap="round" strokeLinejoin="round" />
      {[0, 90, 180, 270].map((a) => (
        <circle key={a} cx={16 + 9 * Math.sin((a * Math.PI) / 180)} cy={16 - 9 * Math.cos((a * Math.PI) / 180)} r={1} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

export function PinIcon({ size, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M16 2.5c-5.8 0-10.5 4.6-10.5 10.3 0 7.4 8.6 15.3 9.6 16.2.5.4 1.3.4 1.8 0 1-.9 9.6-8.8 9.6-16.2C26.5 7.1 21.8 2.5 16 2.5Zm0 6.2a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Z"
      />
    </svg>
  );
}

export function InfoIcon({ size, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <circle cx="16" cy="16" r="12.5" />
      <path d="M16 14.5v8" strokeLinecap="round" />
      <circle cx="16" cy="10" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CertificateIcon({ size, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <rect x="4" y="5" width="24" height="17" rx="3" />
      <path d="M9 10.5h14M9 15h8" strokeLinecap="round" />
      <circle cx="21.5" cy="21" r="4" />
      <path d="M19.5 24.5 18.5 29l3-1.6 3 1.6-1-4.5" strokeLinejoin="round" />
    </svg>
  );
}

export function TicketIcon({ size, className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path d="M4 10a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v3.2a2.8 2.8 0 0 0 0 5.6V22a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3.2a2.8 2.8 0 0 0 0-5.6Z" strokeLinejoin="round" />
      <path d="M19 9v14" strokeDasharray="2 2.6" />
    </svg>
  );
}

export const ICON_BY_NAME: Record<string, (props: IconProps) => React.JSX.Element> = {
  calendario: CalendarIcon,
  relogio: ClockIcon,
  local: PinIcon,
  informacao: InfoIcon,
  certificado: CertificateIcon,
  inscricao: TicketIcon,
};
