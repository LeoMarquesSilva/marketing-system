"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useContentTour } from "@/contexts/content-tour-context";
import { GuidedTour } from "@/components/tour/guided-tour";
import { isContentManager } from "@/lib/content-areas";
import { shouldShowContentTutorial } from "@/lib/content-tour";
import {
  NOVIDADES_TOUR_ID,
  novidadesTourSteps,
  shouldShowNovidadesTour,
} from "@/lib/content-generator/novidades-tour";

/**
 * Tour de novidades da tela de Posts. Abre sozinho uma vez por pessoa (guardado em
 * user_tour_views); `runId` maior que o anterior reabre pelo botão "Novidades".
 */
export function GeradorNovidadesTour({ runId }: { runId: number }) {
  const { profile } = useAuth();
  const onboarding = useContentTour();
  const [seen, setSeen] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const handledRunRef = useRef(0);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetch(`/api/account/tours?tour=${NOVIDADES_TOUR_ID}`, { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { seen?: boolean } | null) => {
        // Sem resposta, não abre sozinho (melhor não mostrar do que mostrar toda vez).
        if (!cancelled) setSeen(data ? Boolean(data.seen) : null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    const forced = runId > handledRunRef.current;
    if (forced) handledRunRef.current = runId;
    const show = shouldShowNovidadesTour({
      forced,
      seen,
      mustChangePassword: profile?.must_change_password,
      onboardingActive: onboarding.active,
      onboardingPending: shouldShowContentTutorial(profile),
    });
    if (!show) return;
    // Dá tempo da lista e das etapas aparecerem antes de destacar.
    const timer = window.setTimeout(() => setOpen(true), forced ? 150 : 1200);
    return () => window.clearTimeout(timer);
  }, [onboarding.active, profile, runId, seen]);

  const finish = useCallback(() => {
    setOpen(false);
    setSeen(true);
    void fetch("/api/account/tours", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tourId: NOVIDADES_TOUR_ID }),
    }).catch(() => undefined);
  }, []);

  return (
    <GuidedTour
      steps={novidadesTourSteps(isContentManager(profile))}
      open={open}
      label="Novidades do Gerador de conteúdo"
      finishLabel="Começar"
      onFinish={finish}
    />
  );
}
