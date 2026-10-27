"use client";

import { useEffect, useState } from "react";

export const REELS_APPROVAL_HREF = "/conteudo/aprovacao-reels";
const REFRESH_MS = 10 * 60 * 1000;
const STALE_CHECK_MS = 60 * 1000;

/** Reels que esperam o usuário (aprovar) ou o Marketing (capa e legenda). */
export function useReelDeliveriesPendingCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let loadedAt = 0;
    const refresh = async () => {
      loadedAt = Date.now();
      try {
        const response = await fetch("/api/reel-deliveries/pending", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { count?: number };
        if (!cancelled) setCount(Math.max(0, Number(body.count) || 0));
      } catch {
        // contador é auxiliar; falha de rede não deve atrapalhar a navegação
      }
    };
    // Aba escondida não consulta (cada consulta é uma função na Vercel); ao voltar, atualiza se ficou velho.
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - loadedAt >= REFRESH_MS) void refresh();
    };
    void refresh();
    const timer = window.setInterval(refreshIfStale, STALE_CHECK_MS);
    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("reel-deliveries:changed", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("reel-deliveries:changed", refresh);
    };
  }, [enabled]);

  return enabled ? count : 0;
}
