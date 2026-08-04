"use client";

/* eslint-disable react-hooks/set-state-in-effect -- O tour sincroniza geometria do DOM e a etapa visível em efeitos. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  NEWSLETTER_EDITOR_TOUR_STEPS,
  NEWSLETTER_LIST_TOUR_STEPS,
  NEWSLETTER_TUTORIAL_SESSION_KEY,
  shouldShowNewsletterTutorial,
  type NewsletterTourStep,
} from "@/lib/newsletter-tour";
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
        <mask id="newsletter-tour-spotlight">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.68)"
        mask="url(#newsletter-tour-spotlight)"
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
  rect: DOMRect | null;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
}) {
  const [pos, setPos] = useState({
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  });

  useLayoutEffect(() => {
    if (!rect) {
      setPos({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      return;
    }
    const cardW = 380;
    const cardH = 240;
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
      aria-labelledby="newsletter-tour-title"
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
      <h2 id="newsletter-tour-title" className="text-base font-semibold leading-snug">
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

export function NewsletterTour({ editionOpen }: { editionOpen: boolean }) {
  const { profile, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const forced = searchParams.get("tour") === "newsletter";

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps: NewsletterTourStep[] = useMemo(
    () => (editionOpen ? NEWSLETTER_EDITOR_TOUR_STEPS : NEWSLETTER_LIST_TOUR_STEPS),
    [editionOpen]
  );

  useEffect(() => {
    if (!profile) return;
    if (profile.must_change_password) {
      setActive(false);
      return;
    }
    const pending =
      typeof window !== "undefined" &&
      sessionStorage.getItem(NEWSLETTER_TUTORIAL_SESSION_KEY) === "1";
    if (!shouldShowNewsletterTutorial(profile, { forced: forced || pending })) {
      return;
    }
    if (forced || pending) {
      sessionStorage.setItem(NEWSLETTER_TUTORIAL_SESSION_KEY, "1");
    }
    const t = window.setTimeout(() => {
      setActive(true);
      setStepIndex(0);
    }, 350);
    return () => window.clearTimeout(t);
  }, [profile, forced, editionOpen]);

  const step = steps[stepIndex] ?? null;
  const rect = useTargetRect(step?.target ?? null, active && !!step);

  const persistCompleted = useCallback(async () => {
    setActive(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(NEWSLETTER_TUTORIAL_SESSION_KEY);
    }
    try {
      await fetch("/api/account/newsletter-tutorial-completed", {
        method: "POST",
        credentials: "include",
      });
      await refreshProfile();
    } catch {
      // Tour já foi exibido; falha ao persistir não bloqueia o uso.
    }
  }, [refreshProfile]);

  const pauseForEdition = useCallback(() => {
    // Terminou o tour da lista: mantém pendente para continuar ao abrir uma edição.
    setActive(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(NEWSLETTER_TUTORIAL_SESSION_KEY, "1");
    }
  }, []);

  if (!active || !step) return null;

  const isLast = stepIndex >= steps.length - 1;

  return (
    <>
      <Spotlight rect={step.target ? rect : null} />
      <TourCard
        stepIndex={stepIndex}
        total={steps.length}
        title={step.title}
        body={step.body}
        rect={step.target ? rect : null}
        onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
        onNext={() => {
          if (!isLast) {
            setStepIndex((i) => Math.min(steps.length - 1, i + 1));
            return;
          }
          if (editionOpen) {
            void persistCompleted();
          } else {
            pauseForEdition();
          }
        }}
        onSkip={() => void persistCompleted()}
        isLast={isLast}
      />
    </>
  );
}

/** Dispara o guia na sessão atual (botão "Ver guia"). */
export function startNewsletterTour() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(NEWSLETTER_TUTORIAL_SESSION_KEY, "1");
  }
}
