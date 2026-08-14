"use client";

/* eslint-disable react-hooks/set-state-in-effect -- O tour sincroniza geometria e estado com o DOM visível. */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  MINHAS_FOTOS_TOUR_STEPS,
  MINHAS_FOTOS_TUTORIAL_SESSION_KEY,
  resolveMinhasFotosTourSteps,
  shouldShowMinhasFotosTutorial,
  type MinhasFotosTourStep,
} from "@/lib/minhas-fotos-tour";

/** Acima da sidebar (z-40) e da nav mobile (z-50); o overlay sai do stacking context do conteúdo via portal. */
const TOUR_Z = 1000;

export interface MinhasFotosTourProps {
  dataReady: boolean;
  photoCount: number;
  onComplete?: () => void;
  onSkip?: () => void;
}

function useTargetRect(selector: string | null, active: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const measure = useCallback(
    (shouldScroll = false) => {
      if (!selector || !active) {
        setRect(null);
        return;
      }

      const target = document.querySelector(selector);
      if (!target) {
        setRect(null);
        return;
      }

      if (shouldScroll) {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({
          block: "center",
          behavior: reducedMotion ? "auto" : "smooth",
        });
      }

      const bounds = target.getBoundingClientRect();
      setRect(bounds.width > 0 && bounds.height > 0 ? bounds : null);
    },
    [active, selector]
  );

  useLayoutEffect(() => {
    measure(true);
  }, [measure]);

  useEffect(() => {
    if (!active || !selector) return;

    const update = () => measure();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const settledScroll = window.setTimeout(update, 350);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearTimeout(settledScroll);
    };
  }, [active, measure, selector]);

  return rect;
}

function Spotlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) {
    return <div className="fixed inset-0 bg-black/65" style={{ zIndex: TOUR_Z }} aria-hidden />;
  }

  const padding = 8;
  const x = Math.max(0, rect.left - padding);
  const y = Math.max(0, rect.top - padding);
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;

  return (
    <svg className="fixed inset-0 h-full w-full" style={{ zIndex: TOUR_Z }} aria-hidden>
      <defs>
        <mask id="minhas-fotos-tour-spotlight">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={width} height={height} rx={12} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.68)"
        mask="url(#minhas-fotos-tour-spotlight)"
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={12}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={2}
      />
    </svg>
  );
}

function TourCard({
  step,
  stepIndex,
  total,
  rect,
  onBack,
  onNext,
  onSkip,
}: {
  step: MinhasFotosTourStep;
  stepIndex: number;
  total: number;
  rect: DOMRect | null;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  });

  useLayoutEffect(() => {
    if (!rect) {
      setPosition({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const margin = 16;
    const gap = 16;
    // Em desktop a sidebar fixa cobre a borda esquerda; evita o card ficar visualmente sob ela.
    const leftSafe =
      typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
        ? 88
        : margin;
    const cardWidth = Math.min(380, window.innerWidth - leftSafe - margin);
    const cardHeight = cardRef.current?.offsetHeight ?? 250;
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - cardWidth / 2;

    if (top + cardHeight > window.innerHeight - margin) {
      top = rect.top - cardHeight - gap;
    }

    top = Math.max(margin, Math.min(top, window.innerHeight - cardHeight - margin));
    left = Math.max(leftSafe, Math.min(left, window.innerWidth - cardWidth - margin));
    setPosition({ top, left, transform: "none" });
  }, [rect, step.title]);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  const isLast = stepIndex === total - 1;

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className="fixed w-[min(380px,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[#04202f] p-5 text-white shadow-2xl outline-none"
      style={{ zIndex: TOUR_Z + 1, ...position }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="minhas-fotos-tour-title"
      aria-describedby="minhas-fotos-tour-description"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#47cdd0]/20">
            <Sparkles className="h-4 w-4 text-[#47cdd0]" />
          </span>
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">
            Passo {stepIndex + 1} de {total}
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Pular tutorial"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <h2 id="minhas-fotos-tour-title" className="text-base font-semibold leading-snug">
        {step.title}
      </h2>
      <p
        id="minhas-fotos-tour-description"
        className="mt-2 text-sm leading-relaxed text-white/75"
      >
        {step.body}
      </p>

      <div className="mt-5 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="text-white/60 hover:bg-white/10 hover:text-white"
        >
          Pular
        </Button>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Voltar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={onNext}
            className="bg-[#47cdd0] text-[#04202f] hover:bg-[#47cdd0]/90"
          >
            {isLast ? "Concluir" : "Próximo"}
            {!isLast && <ArrowRight className="ml-1 h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MinhasFotosTour({
  dataReady,
  photoCount,
  onComplete,
  onSkip,
}: MinhasFotosTourProps) {
  const { profile } = useAuth();
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<MinhasFotosTourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const evaluatedRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(
    (reason: "complete" | "skip") => {
      setActive(false);
      sessionStorage.removeItem(MINHAS_FOTOS_TUTORIAL_SESSION_KEY);

      window.requestAnimationFrame(() => {
        returnFocusRef.current?.focus();
        returnFocusRef.current = null;
      });

      if (reason === "complete") onComplete?.();
      else onSkip?.();
    },
    [onComplete, onSkip]
  );

  useEffect(() => {
    if (!dataReady || !profile || evaluatedRef.current) return;

    const pending = sessionStorage.getItem(MINHAS_FOTOS_TUTORIAL_SESSION_KEY) === "1";
    if (!shouldShowMinhasFotosTutorial(profile, { forced: pending, photoCount })) return;

    const openDelay = window.setTimeout(() => {
      const resolvedSteps = resolveMinhasFotosTourSteps(MINHAS_FOTOS_TOUR_STEPS, (selector) => {
        const target = document.querySelector(selector);
        if (!target) return false;
        const bounds = target.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      });

      if (resolvedSteps.length === 0) return;
      evaluatedRef.current = true;
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSteps(resolvedSteps);
      setStepIndex(0);
      setActive(true);
    }, 350);

    return () => window.clearTimeout(openDelay);
  }, [dataReady, photoCount, profile]);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close("skip");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, close]);

  const step = steps[stepIndex] ?? null;
  const rect = useTargetRect(step?.target ?? null, active && !!step);

  if (!active || !step || typeof document === "undefined") return null;

  const isLast = stepIndex === steps.length - 1;

  return createPortal(
    <>
      <Spotlight rect={step.target ? rect : null} />
      <TourCard
        step={step}
        stepIndex={stepIndex}
        total={steps.length}
        rect={step.target ? rect : null}
        onBack={() => setStepIndex((current) => Math.max(0, current - 1))}
        onNext={() => {
          if (isLast) {
            close("complete");
            return;
          }
          setStepIndex((current) => Math.min(steps.length - 1, current + 1));
        }}
        onSkip={() => close("skip")}
      />
    </>,
    document.body
  );
}

/** Dispara o guia na sessão atual pelo botão "Ver guia". */
export function startMinhasFotosTour() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(MINHAS_FOTOS_TUTORIAL_SESSION_KEY, "1");
  }
}
