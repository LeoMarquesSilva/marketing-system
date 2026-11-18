"use client";

/* eslint-disable react-hooks/set-state-in-effect -- O tour mede a posição do alvo em efeitos. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_Z_INDEX = 300;

export interface GuidedTourStep {
  id: string;
  /** Seletor do que fica em destaque; null (ou não achado na tela) = cartão no meio. */
  target: string | null;
  title: string;
  body: string;
}

function useTargetRect(selector: string | null, active: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const measure = useCallback(() => {
    const element = selector && active ? document.querySelector(selector) : null;
    const bounds = element?.getBoundingClientRect();
    setRect(bounds && bounds.width > 0 && bounds.height > 0 ? bounds : null);
  }, [active, selector]);

  useLayoutEffect(() => {
    if (!active) return;
    if (!selector) {
      setRect(null);
      return;
    }
    document.querySelector(selector)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const timer = window.setTimeout(measure, 320);
    return () => window.clearTimeout(timer);
  }, [active, measure, selector]);

  useEffect(() => {
    if (!active || !selector) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, measure, selector]);

  return rect;
}

function Spotlight({ rect, maskId }: { rect: DOMRect | null; maskId: string }) {
  if (!rect) {
    return <div className="fixed inset-0 bg-[#02080d]/72 backdrop-blur-[1px]" style={{ zIndex: TOUR_Z_INDEX }} aria-hidden />;
  }
  const padding = 8;
  const x = Math.max(0, rect.left - padding);
  const y = Math.max(0, rect.top - padding);
  const width = Math.min(window.innerWidth - x, rect.width + padding * 2);
  const height = Math.min(window.innerHeight - y, rect.height + padding * 2);
  return (
    <svg className="fixed inset-0 h-full w-full" style={{ zIndex: TOUR_Z_INDEX }} aria-hidden>
      <defs>
        <mask id={maskId}>
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={width} height={height} rx={8} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(2, 8, 13, 0.72)" mask={`url(#${maskId})`} />
      <rect x={x} y={y} width={width} height={height} rx={8} fill="none" stroke="rgba(71,205,208,0.95)" strokeWidth={2} />
    </svg>
  );
}

/**
 * Tour guiado genérico: destaca um elemento por passo e mostra o cartão ao lado.
 * Esc ou "Pular" encerra; o foco fica preso no cartão enquanto ele está aberto.
 */
export function GuidedTour({
  steps,
  open,
  label,
  finishLabel = "Entendi",
  onFinish,
}: {
  steps: GuidedTourStep[];
  open: boolean;
  /** Sobretítulo do cartão (ex.: "Novidades"). */
  label: string;
  finishLabel?: string;
  /** Chamado ao concluir ou pular (marque como visto aqui). */
  onFinish: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const step = open ? steps[stepIndex] ?? null : null;
  const rect = useTargetRect(step?.target ?? null, Boolean(step));

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!step) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onFinish();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    cardRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onFinish, step, stepIndex]);

  if (!step) return null;

  const isLast = stepIndex === steps.length - 1;
  const position = (() => {
    if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    const width = Math.min(400, window.innerWidth - 32);
    const estimatedHeight = 300;
    const gap = 16;
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - width / 2;
    if (top + estimatedHeight > window.innerHeight - 16) top = rect.top - estimatedHeight - gap;
    top = Math.max(16, Math.min(top, window.innerHeight - estimatedHeight - 16));
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
    return { top: `${top}px`, left: `${left}px`, transform: "none" };
  })();

  return (
    <>
      <Spotlight rect={rect} maskId={`guided-tour-mask-${step.id}`} />
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
        className="fixed w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/10 bg-[#062432] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] outline-none"
        style={{ zIndex: TOUR_Z_INDEX + 1, ...position }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-[#47cdd0]/15 ring-1 ring-[#47cdd0]/25">
                <Sparkles className="size-4 text-[#65dce0]" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold text-[#65dce0]">{label}</p>
                <p className="text-xs text-white/55">
                  Passo {stepIndex + 1} de {steps.length}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onFinish}
              className="rounded-md p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
              aria-label="Fechar o tour"
            >
              <X className="size-4" />
            </button>
          </div>

          <h2 id="guided-tour-title" className="mt-4 text-lg font-semibold">
            {step.title}
          </h2>
          <p id="guided-tour-description" className="mt-2 text-sm leading-6 text-white/75">
            {step.body}
          </p>

          <div className="mt-4 flex gap-1.5" aria-hidden>
            {steps.map((tourStep, index) => (
              <span key={tourStep.id} className={index === stepIndex ? "h-1.5 w-6 rounded-full bg-[#47cdd0]" : "size-1.5 rounded-full bg-white/20"} />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onFinish} className="text-white/65 hover:bg-white/10 hover:text-white">
              Pular
            </Button>
            <div className="flex gap-2">
              {stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="size-4" />
                  Voltar
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={() => (isLast ? onFinish() : setStepIndex((index) => index + 1))}
                className="border-transparent bg-[#47cdd0] text-[#05212e] hover:bg-[#65dce0] hover:text-[#05212e]"
              >
                {isLast ? <Check className="size-4" /> : null}
                {isLast ? finishLabel : "Próximo"}
                {!isLast ? <ArrowRight className="size-4" /> : null}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
