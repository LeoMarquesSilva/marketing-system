"use client";

/* eslint-disable react-hooks/set-state-in-effect -- O tour sincroniza a etapa e a geometria da interface em efeitos. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  CONTENT_SCHEDULE_MANAGER_TOUR_STEPS,
  shouldShowContentScheduleManagerTour,
} from "@/lib/content-schedule/manager-tour";

const TOUR_Z_INDEX = 300;

function useTargetRect(selector: string | null, active: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const measure = useCallback(() => {
    if (!selector || !active) {
      setRect(null);
      return;
    }
    const element = document.querySelector(selector);
    if (!element) {
      setRect(null);
      return;
    }
    const bounds = element.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      setRect(null);
      return;
    }
    setRect(bounds);
  }, [active, selector]);

  useLayoutEffect(() => {
    if (!selector || !active) return;
    const element = document.querySelector(selector);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
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

function TourSpotlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) {
    return (
      <div
        className="fixed inset-0 bg-[#02080d]/72 backdrop-blur-[1px]"
        style={{ zIndex: TOUR_Z_INDEX }}
        aria-hidden
      />
    );
  }
  const padding = 9;
  const x = Math.max(0, rect.left - padding);
  const y = Math.max(0, rect.top - padding);
  const width = Math.min(window.innerWidth - x, rect.width + padding * 2);
  const height = Math.min(window.innerHeight - y, rect.height + padding * 2);

  return (
    <svg className="fixed inset-0 h-full w-full" style={{ zIndex: TOUR_Z_INDEX }} aria-hidden>
      <defs>
        <mask id="content-schedule-manager-tour-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={width} height={height} rx={14} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(2, 8, 13, 0.72)"
        mask="url(#content-schedule-manager-tour-mask)"
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={14}
        fill="none"
        stroke="rgba(71,205,208,0.95)"
        strokeWidth={2}
      />
    </svg>
  );
}

export function ContentScheduleManagerTour({
  managerMode,
  runId,
}: {
  managerMode: boolean;
  runId: number;
}) {
  const { profile, refreshProfile } = useAuth();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const autoStartedRef = useRef(false);
  const handledRunIdRef = useRef(0);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const forced = runId > handledRunIdRef.current;
    if (forced) handledRunIdRef.current = runId;
    if (!forced && autoStartedRef.current) return;
    if (!shouldShowContentScheduleManagerTour(profile, { forced, managerMode })) return;
    autoStartedRef.current = true;
    const timer = window.setTimeout(() => {
      setStepIndex(0);
      setActive(true);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [managerMode, profile, runId]);

  const step = CONTENT_SCHEDULE_MANAGER_TOUR_STEPS[stepIndex] ?? null;
  const rect = useTargetRect(step?.target ?? null, active && Boolean(step));

  const finish = useCallback(async () => {
    setActive(false);
    try {
      await fetch("/api/account/content-schedule-tutorial-completed", {
        method: "POST",
        credentials: "include",
      });
      await refreshProfile();
    } catch {
      // O guia não bloqueia o cronograma caso a persistência falhe.
    }
  }, [refreshProfile]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void finish();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) {
        event.preventDefault();
        cardRef.current.focus();
        return;
      }
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
  }, [active, finish, stepIndex]);

  if (!active || !step) return null;

  const isLast = stepIndex === CONTENT_SCHEDULE_MANAGER_TOUR_STEPS.length - 1;
  const position = (() => {
    if (!rect || typeof window === "undefined") {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const width = Math.min(400, window.innerWidth - 32);
    const estimatedHeight = 290;
    const gap = 18;
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - width / 2;
    if (top + estimatedHeight > window.innerHeight - 16) top = rect.top - estimatedHeight - gap;
    top = Math.max(16, top);
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
    return { top: `${top}px`, left: `${left}px`, transform: "none" };
  })();

  return (
    <>
      <TourSpotlight rect={step.target ? rect : null} />
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-schedule-tour-title"
        aria-describedby="content-schedule-tour-description"
        className="fixed w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#062432] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] outline-none"
        style={{ zIndex: TOUR_Z_INDEX + 1, ...position }}
      >
        <div className="h-1 bg-gradient-to-r from-[#47cdd0] via-[#5ad6b8] to-[#347796]" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#47cdd0]/15 ring-1 ring-[#47cdd0]/25">
                <ShieldCheck className="size-5 text-[#65dce0]" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65dce0]">
                  Guia do gestor
                </p>
                <p className="mt-0.5 text-xs text-white/50">
                  Etapa {stepIndex + 1} de {CONTENT_SCHEDULE_MANAGER_TOUR_STEPS.length}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void finish()}
              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
              aria-label="Pular guia"
            >
              <X className="size-4" />
            </button>
          </div>

          <h2 id="content-schedule-tour-title" className="mt-5 text-xl font-semibold tracking-tight">
            {step.title}
          </h2>
          <p id="content-schedule-tour-description" className="mt-2 text-sm leading-6 text-white/72">
            {step.body}
          </p>

          <div className="mt-5 flex gap-1.5" aria-hidden>
            {CONTENT_SCHEDULE_MANAGER_TOUR_STEPS.map((tourStep, index) => (
              <span
                key={tourStep.id}
                className={index === stepIndex ? "h-1.5 w-6 rounded-full bg-[#47cdd0]" : "size-1.5 rounded-full bg-white/20"}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void finish()}
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
                  onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="size-4" />
                  Voltar
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (isLast) void finish();
                  else setStepIndex((index) => index + 1);
                }}
                className="bg-[#47cdd0] text-[#05212e] hover:bg-[#65dce0]"
              >
                {isLast ? <Check className="size-4" /> : null}
                {isLast ? "Começar" : "Próximo"}
                {!isLast ? <ArrowRight className="size-4" /> : null}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
