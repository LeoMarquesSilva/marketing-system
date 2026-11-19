"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { MY_DELIVERIES_PATH } from "@/lib/request-files/domain";
import { cn } from "@/lib/utils";

/** Recarrega de vez em quando e ao voltar para a aba, sem pesar no servidor. */
const REFRESH_MS = 10 * 60 * 1000;

/**
 * Sino da barra lateral: algo que a pessoa pediu ao Marketing foi concluído.
 * Só aparece quando há entrega nova; leva para Minhas entregas (com a arte).
 */
/** Número de entregas novas; null quando não deu para consultar (mantém o anterior). */
async function fetchUnseenDeliveries(): Promise<number | null> {
  try {
    const res = await fetch("/api/minhas-entregas?contagem=1", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { unseen?: number };
    return data.unseen ?? 0;
  } catch {
    return null;
  }
}

/** Entregas novas do Marketing da pessoa logada (usado também no sino único da sidebar). */
export function useUnseenDeliveries(): number {
  const { profile } = useAuth();
  const [unseen, setUnseen] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    const refresh = async () => {
      const count = await fetchUnseenDeliveries();
      if (active && count !== null) setUnseen(count);
    };
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    // Minhas entregas marca os avisos como vistos e avisa por este evento.
    const onSeen = () => setUnseen(0);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("entregas:vistas", onSeen);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("entregas:vistas", onSeen);
    };
  }, [profile?.id]);

  return unseen;
}

export function DeliveryNoticesBell({ className }: { className?: string }) {
  const unseen = useUnseenDeliveries();
  if (unseen === 0) return null;

  return (
    <Link
      href={MY_DELIVERIES_PATH}
      aria-label={`${unseen} ${unseen === 1 ? "entrega nova" : "entregas novas"} do Marketing`}
      title="O Marketing concluiu algo que você pediu"
      className={cn(
        "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
        className,
      )}
    >
      <PackageCheck className="h-4.5 w-4.5 text-white/70 transition-colors group-hover:text-white" />
      <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#03070c] bg-emerald-400 px-0.5 text-[10px] font-semibold leading-none text-[#04202f]">
        {unseen > 9 ? "9+" : unseen}
      </span>
    </Link>
  );
}
