"use client";

/* eslint-disable react-hooks/set-state-in-effect -- O tour sincroniza geometria do DOM e a etapa visível em efeitos. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { useMeusClientesTour } from "@/contexts/meus-clientes-tour-context";
import {
  buildMeusClientesTourSteps,
  MEUS_CLIENTES_TOUR_EXPAND_STEPS,
  MEUS_CLIENTES_TUTORIAL_SESSION_KEY,
  shouldShowMeusClientesTutorial,
} from "@/lib/meus-clientes-tour";
import { cn } from "@/lib/utils";

const TOUR_Z = 300;

function useTargetRect(selector: string | null, active: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const measure = useCallback(() => {
    if (!selector || !active) {
      setRect(null);
      return;
    }
    const nodes = selector.includes(",")
      ? Array.from(document.querySelectorAll(selector))
      : [document.querySelector(selector)].filter((n): n is Element => n != null);
    const el =
      nodes.find((node) => {
        const bounds = node.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      }) ?? nodes[0];
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const bounds = el.getBoundingClientRect();
    if (bounds.width === 0 && bounds.height === 0) {
      setRect(null);
      return;
    }
    setRect(bounds);
  }, [selector, active]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!active || !selector) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const t = window.setTimeout(measure, 350);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearTimeout(t);
    };
  }, [active, selector, measure]);

  return rect;
}

function Spotlight({ rect }: { rect: DOMRect | null }) {
  const pad = 8;
  const r = 12;

  if (!rect) {
    return <div className="fixed inset-0 bg-black/65" style={{ zIndex: TOUR_Z }} aria-hidden />;
  }

  const x = Math.max(0, rect.left - pad);
  const y = Math.max(0, rect.top - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  return (
    <svg className="fixed inset-0 h-full w-full" style={{ zIndex: TOUR_Z }} aria-hidden>
      <defs>
        <mask id="meus-clientes-tour-spotlight">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.68)"
        mask="url(#meus-clientes-tour-spotlight)"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={2}
      />
    </svg>
  );
}

function TourCard({
  stepIndex,
  total,
  title,
  body,
  roleLabel,
  rect,
  onBack,
  onNext,
  onSkip,
  isLast,
}: {
  stepIndex: number;
  total: number;
  title: string;
  body: string;
  roleLabel?: string;
  rect: DOMRect | null;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
}) {
  const [pos, setPos] = useState({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });

  useLayoutEffect(() => {
    if (!rect) {
      setPos({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      return;
    }
    const cardW = 380;
    const cardH = 260;
    const gap = 16;
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - cardW / 2;

    if (top + cardH > window.innerHeight - 16) {
      top = rect.top - cardH - gap;
    }
    if (top < 16) top = 16;
    if (left < 16) left = 16;
    if (left + cardW > window.innerWidth - 16) {
      left = window.innerWidth - cardW - 16;
    }

    setPos({ top: `${top}px`, left: `${left}px`, transform: "none" });
  }, [rect, title]);

  return (
    <div
      className="fixed w-[min(380px,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[#04202f] p-5 text-white shadow-2xl"
      style={{ zIndex: TOUR_Z + 1, ...pos }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="meus-clientes-tour-title"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20">
            <Sparkles className="h-4 w-4 text-violet-200" />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">
              Passo {stepIndex + 1} de {total}
            </p>
            {roleLabel && (
              <Badge
                variant="outline"
                className="mt-1 border-violet-300/40 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-100"
              >
                {roleLabel}
              </Badge>
            )}
          </div>
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
      <h2 id="meus-clientes-tour-title" className="text-base font-semibold leading-snug">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-white/75">{body}</p>
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
              className="gap-1 border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Button>
          )}
          <Button type="button" size="sm" onClick={onNext} className="gap-1 bg-violet-600 hover:bg-violet-700">
            {isLast ? "Começar" : "Próximo"}
            {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === stepIndex ? "w-5 bg-violet-300" : "w-1.5 bg-white/25"
            )}
          />
        ))}
      </div>
    </div>
  );
}

interface MeusClientesTourProps {
  /** Incrementar para reiniciar o guia (botão Ver guia). */
  restartKey?: number;
}

export function MeusClientesTour({ restartKey = 0 }: MeusClientesTourProps) {
  const { profile, refreshProfile } = useAuth();
  const {
    setTourState,
    dataLoaded,
    hasSampleGroup,
    isAreaManager,
    canShowAreaContactStep,
  } = useMeusClientesTour();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () =>
      buildMeusClientesTourSteps({
        hasSampleGroup,
        isAreaManager,
        canShowAreaContactStep,
      }),
    [hasSampleGroup, isAreaManager, canShowAreaContactStep]
  );

  const step = steps[stepIndex];
  const rect = useTargetRect(step?.target ?? null, active);

  useEffect(() => {
    setTourState({
      active,
      stepIndex,
      stepId: step?.id ?? null,
    });
  }, [active, stepIndex, step?.id, setTourState]);

  const dismissedRef = useRef(false);

  useEffect(() => {
    dismissedRef.current = false;
    setStepIndex(0);
    setActive(false);
  }, [restartKey]);

  useEffect(() => {
    if (!profile || !dataLoaded) return;
    if (dismissedRef.current) return;
    if (profile.must_change_password) {
      setActive(false);
      return;
    }
    const fromQuery = searchParams.get("tutorial") === "1";
    const fromSession =
      typeof window !== "undefined" &&
      sessionStorage.getItem(MEUS_CLIENTES_TUTORIAL_SESSION_KEY) === "1";
    const forced = fromQuery || fromSession || restartKey > 0;
    if (!shouldShowMeusClientesTutorial(profile, { forced })) return;
    if (forced) sessionStorage.setItem(MEUS_CLIENTES_TUTORIAL_SESSION_KEY, "1");
    const t = window.setTimeout(() => setActive(true), 400);
    return () => window.clearTimeout(t);
  }, [profile, searchParams, dataLoaded, restartKey]);

  const finish = useCallback(async () => {
    dismissedRef.current = true;
    sessionStorage.removeItem(MEUS_CLIENTES_TUTORIAL_SESSION_KEY);
    setActive(false);
    if (searchParams.get("tutorial") === "1") {
      router.replace("/meus-clientes");
    }
    try {
      await fetch("/api/account/meus-clientes-tutorial-completed", {
        method: "POST",
        credentials: "include",
      });
      await refreshProfile();
    } catch {
      // Tour já foi exibido; falha ao persistir não bloqueia o uso.
    }
  }, [refreshProfile, router, searchParams]);

  const goNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      void finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, steps.length, finish]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  if (!active || !step) return null;

  return (
    <>
      <Spotlight rect={rect} />
      <TourCard
        stepIndex={stepIndex}
        total={steps.length}
        title={step.title}
        body={step.body}
        roleLabel={step.roleLabel}
        rect={rect}
        onBack={goBack}
        onNext={goNext}
        onSkip={() => void finish()}
        isLast={stepIndex === steps.length - 1}
      />
    </>
  );
}

/** Dispara o guia na sessão atual (botão "Ver guia"). */
export function startMeusClientesTour() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(MEUS_CLIENTES_TUTORIAL_SESSION_KEY, "1");
  }
}
