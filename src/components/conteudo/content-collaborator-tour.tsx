"use client";

/* eslint-disable react-hooks/set-state-in-effect -- O tour sincroniza geometria do DOM, rota e etapa visível em efeitos. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useContentTour } from "@/contexts/content-tour-context";
import {
  CONTENT_TOUR_STEPS,
  CONTENT_TUTORIAL_SESSION_KEY,
  shouldShowContentTutorial,
} from "@/lib/content-tour";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";

const TOUR_Z = 120;

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
        const b = node.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
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
        <mask id="content-tour-spotlight">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#content-tour-spotlight)" />
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

function TooltipCard({
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
  const [pos, setPos] = useState({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });

  useLayoutEffect(() => {
    if (!rect) {
      setPos({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      return;
    }
    const cardW = 360;
    const cardH = 220;
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
      className="fixed w-[min(360px,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[#04202f] p-5 text-white shadow-2xl"
      style={{ zIndex: TOUR_Z + 1, ...pos }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="content-tour-title"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <Sparkles className="h-4 w-4 text-amber-300" />
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
      <h2 id="content-tour-title" className="text-base font-semibold leading-snug">
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
          <Button type="button" size="sm" onClick={onNext} className="gap-1">
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
              i === stepIndex ? "w-5 bg-white" : "w-1.5 bg-white/25"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function ContentCollaboratorTour() {
  const { profile, refreshProfile } = useAuth();
  const { setTourState } = useContentTour();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [navigating, setNavigating] = useState(false);

  const step = CONTENT_TOUR_STEPS[stepIndex];
  const rect = useTargetRect(step?.target ?? null, active && !navigating);

  useEffect(() => {
    setTourState({
      active,
      stepIndex,
      stepId: step?.id ?? null,
    });
  }, [active, stepIndex, step?.id, setTourState]);

  // Evita reabrir o tour após finish enquanto ?tutorial=1 ainda está na URL
  // (mesmo padrão de MeusClientesTour).
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    if (dismissedRef.current) return;
    // Defesa extra: nunca iniciar na tela de troca de senha.
    if (pathname === "/alterar-senha" || profile.must_change_password) {
      setActive(false);
      return;
    }
    const fromQuery = searchParams.get("tutorial") === "1";
    const fromSession =
      typeof window !== "undefined" &&
      sessionStorage.getItem(CONTENT_TUTORIAL_SESSION_KEY) === "1";
    const forced = fromQuery || fromSession;
    if (!shouldShowContentTutorial(profile, { forced })) return;
    if (forced) sessionStorage.setItem(CONTENT_TUTORIAL_SESSION_KEY, "1");
    setActive(true);
  }, [profile, searchParams, pathname]);

  useEffect(() => {
    if (!active || !step) return;
    if (pathname !== step.route && !pathname.startsWith(step.route + "/")) {
      setNavigating(true);
      router.push(step.route);
      const t = window.setTimeout(() => setNavigating(false), 500);
      return () => window.clearTimeout(t);
    }
    setNavigating(false);
  }, [active, step, pathname, router]);

  const finish = useCallback(async () => {
    dismissedRef.current = true;
    sessionStorage.removeItem(CONTENT_TUTORIAL_SESSION_KEY);
    setActive(false);
    if (searchParams.get("tutorial") === "1") {
      router.replace("/conteudo/inicio");
    }
    try {
      await fetch("/api/account/content-tutorial-completed", {
        method: "POST",
        credentials: "include",
      });
      await refreshProfile();
    } catch {
      // Tour já foi exibido; falha ao persistir não bloqueia o uso.
    }
  }, [refreshProfile, router, searchParams]);

  const goNext = useCallback(() => {
    if (stepIndex >= CONTENT_TOUR_STEPS.length - 1) {
      void finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, finish]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  if (!active || !step || navigating) return null;

  return (
    <>
      <Spotlight rect={rect} />
      <TooltipCard
        stepIndex={stepIndex}
        total={CONTENT_TOUR_STEPS.length}
        title={step.title}
        body={step.body}
        rect={rect}
        onBack={goBack}
        onNext={goNext}
        onSkip={() => void finish()}
        isLast={stepIndex === CONTENT_TOUR_STEPS.length - 1}
      />
    </>
  );
}
