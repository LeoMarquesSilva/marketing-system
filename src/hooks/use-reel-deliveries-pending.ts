"use client";

import { useEffect, useSyncExternalStore } from "react";

export const REELS_APPROVAL_HREF = "/conteudo/aprovacao-reels";
const REFRESH_MS = 10 * 60 * 1000;
const STALE_CHECK_MS = 60 * 1000;
const CHAVE_PREFIXO = "reels.pendentes.";
/** Esta aba guardou um número novo (o evento `storage` só chega às outras abas). */
const EVENTO_GUARDADO = "reels-pendentes:guardado";

type Guardado = { count: number; em: number };

/** Sem armazenamento no navegador, o número fica só nesta aba. */
const memoria = new Map<string, string>();

/**
 * O número fica guardado no navegador por usuário: recarregar a página ou abrir outra aba usa o que foi lido há menos
 * de 10 minutos, em vez de pedir de novo (cada pedido é uma função na Vercel; antes saía um a cada carga de página).
 */
function lerBruto(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave) ?? memoria.get(chave) ?? null;
  } catch {
    return memoria.get(chave) ?? null;
  }
}

function interpretar(bruto: string | null): Guardado | null {
  if (!bruto) return null;
  try {
    const valor = JSON.parse(bruto) as Partial<Guardado> | null;
    return valor && typeof valor.count === "number" && typeof valor.em === "number" ? { count: valor.count, em: valor.em } : null;
  } catch {
    return null;
  }
}

function guardar(chave: string, count: number) {
  const bruto = JSON.stringify({ count, em: Date.now() });
  memoria.set(chave, bruto);
  try {
    window.localStorage.setItem(chave, bruto);
  } catch {
    // Sem armazenamento no navegador: vale a memória desta aba.
  }
  window.dispatchEvent(new Event(EVENTO_GUARDADO));
}

function assinar(aoMudar: () => void) {
  window.addEventListener("storage", aoMudar);
  window.addEventListener(EVENTO_GUARDADO, aoMudar);
  return () => {
    window.removeEventListener("storage", aoMudar);
    window.removeEventListener(EVENTO_GUARDADO, aoMudar);
  };
}

/** Reels que esperam o usuário (aprovar) ou o Marketing (capa e legenda). `usuario` é o id do perfil; null desliga. */
export function useReelDeliveriesPendingCount(usuario: string | null): number {
  const chave = usuario ? `${CHAVE_PREFIXO}${usuario}` : null;
  const bruto = useSyncExternalStore(
    assinar,
    () => (chave ? lerBruto(chave) : null),
    () => null
  );

  useEffect(() => {
    if (!chave) return;
    /** Última tentativa desta aba: falha de rede não vira um pedido por minuto. */
    let tentouEm = 0;
    const refresh = async () => {
      tentouEm = Date.now();
      try {
        const response = await fetch("/api/reel-deliveries/pending", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { count?: number };
        guardar(chave, Math.max(0, Number(body.count) || 0));
      } catch {
        // contador é auxiliar; falha de rede não deve atrapalhar a navegação
      }
    };
    // Aba escondida não consulta (cada consulta é uma função na Vercel); ao voltar, atualiza se ficou velho.
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      const lidoEm = Math.max(tentouEm, interpretar(lerBruto(chave))?.em ?? 0);
      if (Date.now() - lidoEm >= REFRESH_MS) void refresh();
    };
    refreshIfStale();
    const timer = window.setInterval(refreshIfStale, STALE_CHECK_MS);
    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("reel-deliveries:changed", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("reel-deliveries:changed", refresh);
    };
  }, [chave]);

  return chave ? interpretar(bruto)?.count ?? 0 : 0;
}
