"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink, History, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AreaTag } from "@/components/conteudo/escolhas-visuals";
import { canCreateRoteiroFromLink } from "@/lib/content-areas";
import type { FollowupAlert } from "@/lib/content-generator/server";
import { cn } from "@/lib/utils";

/** Recarrega de vez em quando (e ao voltar para a aba) sem pesar no servidor. */
const REFRESH_MS = 10 * 60 * 1000;

function shortDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }) : "antes";
}

export function postHref(roteiroId: string): string {
  return `/conteudo/roteiros?contentId=${encodeURIComponent(roteiroId)}`;
}

/**
 * Evento para abrir um post quando a tela de Posts já está aberta (o link só troca
 * a query, e a tela não remonta). Fora de Posts, o próprio link abre a matéria.
 */
export const OPEN_POST_EVENT = "conteudo:abrir-post";

export function requestOpenPost(roteiroId: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_POST_EVENT, { detail: roteiroId }));
}

/** Avisos de desdobramento da pessoa logada (só para quem participa do conteúdo). */
export function useFollowupAlerts() {
  const { profile } = useAuth();
  const enabled = canCreateRoteiroFromLink(profile);
  const [alerts, setAlerts] = useState<FollowupAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/content-roteiros/acompanhamentos", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { alerts?: FollowupAlert[] };
      setAlerts(data.alerts ?? []);
    } catch {
      // Falha passageira: mantém a última lista.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, load]);

  const dismiss = useCallback(async (id: string) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
    await fetch("/api/content-roteiros/acompanhamentos", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  }, []);

  return { alerts, loading, reload: load, dismiss, enabled };
}

/** Um aviso: o post que a pessoa fez, o que há de novo e a matéria nova. */
export function FollowupAlertCard({
  alert,
  onDismiss,
  onOpen,
  compact = false,
}: {
  alert: FollowupAlert;
  onDismiss: () => void;
  onOpen?: () => void;
  compact?: boolean;
}) {
  const origin = alert.ref.source === "instagram" ? "Seu post no Instagram" : "Matéria que você escolheu";
  return (
    <article className={cn("space-y-2.5", compact ? "px-4 py-3" : "")}>
      <div className="flex items-start gap-3">
        <span className="relative block size-14 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-[#1a2f44] to-[#04202f]">
          {alert.roteiro.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={alert.roteiro.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <History className="absolute inset-0 m-auto size-5 text-white/40" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <AreaTag area={alert.roteiro.area} />
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{alert.roteiro.title}</p>
        </div>
      </div>
      <a
        href={alert.ref.source === "instagram" ? alert.ref.url ?? undefined : postHref(alert.ref.id)}
        target={alert.ref.source === "instagram" ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="block rounded-md bg-[#f7fbfc] px-3 py-2 text-xs text-slate-600 transition-colors hover:bg-[#eef6f8]"
      >
        <span className="flex items-center gap-1.5 font-medium text-slate-500">
          {origin} · {shortDate(alert.ref.date)}
          {alert.ref.source === "instagram" ? <ExternalLink className="size-3" aria-hidden /> : null}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-slate-800">{alert.ref.title}</span>
      </a>
      {alert.note ? (
        <p className="text-sm text-slate-700">
          <span className="font-medium text-[#48466e]">O que há de novo: </span>
          {alert.note}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Agora não
        </Button>
        <Button size="sm" asChild>
          <Link href={postHref(alert.roteiroId)} onClick={onOpen}>
            <ArrowUpRight className="size-4" aria-hidden />
            Fazer a continuação
          </Link>
        </Button>
      </div>
    </article>
  );
}

/** Sino da barra lateral: só aparece quando há aviso. */
export function ContentFollowupBell({ className }: { className?: string }) {
  const { alerts, loading, reload, dismiss } = useFollowupAlerts();
  const [open, setOpen] = useState(false);
  if (alerts.length === 0) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void reload();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${alerts.length} ${alerts.length === 1 ? "assunto seu teve novidade" : "assuntos seus tiveram novidade"}`}
          title="Novidades nos seus assuntos"
          className={cn(
            "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
            className,
          )}
        >
          <History className="h-4.5 w-4.5 text-white/70 transition-colors group-hover:text-white" />
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#03070c] bg-[#47cdd0] px-0.5 text-[10px] font-semibold leading-none text-[#04202f]">
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Novidades nos seus assuntos</p>
          <p className="mt-0.5 text-xs text-slate-600">Um assunto que você postou teve fato novo. Que tal a continuação?</p>
        </div>
        <div className="max-h-[min(32rem,70vh)] divide-y divide-slate-200 overflow-y-auto">
          {loading && alerts.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Carregando…
            </div>
          ) : (
            alerts.map((alert) => (
              <FollowupAlertCard
                key={alert.id}
                alert={alert}
                compact
                onDismiss={() => void dismiss(alert.id)}
                onOpen={() => {
                  setOpen(false);
                  requestOpenPost(alert.roteiroId);
                }}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Bloco no topo de Posts para quem tem aviso. */
export function FollowupAlertsSection({ onOpen }: { onOpen: (roteiroId: string) => void }) {
  const { alerts, dismiss } = useFollowupAlerts();
  if (alerts.length === 0) return null;
  return (
    <section className="rounded-lg border border-[#cfe4ea] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)]" aria-label="Novidades nos seus assuntos">
      <header className="flex items-center gap-2 border-b border-[#eef4f5] px-4 py-3">
        <History className="size-4 text-[#48466e]" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-900">Novidades nos seus assuntos</h2>
        <span className="rounded-full bg-[#48466e]/10 px-2 py-0.5 text-xs font-semibold text-[#48466e]">{alerts.length}</span>
        <p className="ml-auto hidden text-xs text-slate-500 sm:block">Fato novo em assunto que você já postou: vale a continuação.</p>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {alerts.slice(0, 4).map((alert) => (
          <FollowupAlertCard
            key={alert.id}
            alert={alert}
            onDismiss={() => void dismiss(alert.id)}
            onOpen={() => onOpen(alert.roteiroId)}
          />
        ))}
      </div>
    </section>
  );
}
