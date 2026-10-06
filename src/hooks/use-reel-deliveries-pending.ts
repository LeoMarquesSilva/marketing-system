"use client";

import { useEffect, useState } from "react";

export const REELS_APPROVAL_HREF = "/conteudo/aprovacao-reels";
const REFRESH_MS = 5 * 60 * 1000;

/** Reels que esperam o usuário (aprovar) ou o Marketing (capa e legenda). */
export function useReelDeliveriesPendingCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/reel-deliveries/pending", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { count?: number };
        if (!cancelled) setCount(Math.max(0, Number(body.count) || 0));
      } catch {
        // contador é auxiliar; falha de rede não deve atrapalhar a navegação
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    window.addEventListener("reel-deliveries:changed", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("reel-deliveries:changed", refresh);
    };
  }, [enabled]);

  return enabled ? count : 0;
}
