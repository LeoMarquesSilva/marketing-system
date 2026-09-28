"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { LEONARDO_USER_ID } from "@/lib/planner-visibility";
import type { ContentScheduleAssignmentNotification } from "@/lib/content-schedule/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function notificationDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`)).replaceAll(".", "");
}

export function ContentScheduleNotificationsBell({ className }: { className?: string }) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<ContentScheduleAssignmentNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canReceive = profile?.id === LEONARDO_USER_ID;

  const load = useCallback(async () => {
    if (!canReceive) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/content-schedule/notifications", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json() as {
        notifications?: ContentScheduleAssignmentNotification[];
      };
      setNotifications(payload.notifications ?? []);
      setError(null);
    } catch {
      // Mantém a última lista conhecida durante falhas transitórias.
    } finally {
      setLoading(false);
    }
  }, [canReceive]);

  useEffect(() => {
    if (!canReceive) return;
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canReceive, load]);

  async function resolve(notification: ContentScheduleAssignmentNotification) {
    setResolvingId(notification.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/content-schedule/notifications/${encodeURIComponent(notification.id)}/resolve`,
        { method: "POST", credentials: "include" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Não foi possível concluir a notificação.");
      }
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a notificação.");
    } finally {
      setResolvingId(null);
    }
  }

  if (!canReceive) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={notifications.length
            ? `${notifications.length} ${notifications.length === 1 ? "ajuste pendente" : "ajustes pendentes"} no VIOS`
            : "Ajustes do cronograma no VIOS"}
          className={cn(
            "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
            className
          )}
        >
          <CalendarClock className="h-4.5 w-4.5 text-white/70 transition-colors group-hover:text-white" />
          {notifications.length > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#03070c] bg-amber-500 px-0.5 text-[9px] font-semibold leading-none text-white">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cronograma → VIOS</p>
          <p className="mt-1 text-sm text-slate-700">Trocas feitas pelos gestores que precisam ser refletidas no VIOS.</p>
        </div>
        {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
        <div className="max-h-[min(32rem,70vh)] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />Carregando…
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhum ajuste pendente no VIOS.</div>
          ) : notifications.map((notification) => (
            <article key={notification.id} className="space-y-3 border-b border-slate-200 px-4 py-3 last:border-b-0">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {notification.previous_collaborator_name} → {notification.new_collaborator_name}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Alterado por {notification.changed_by_name} · {notification.area} · {notificationDate(notification.due_date)} · {notification.format === "reel" ? "Reel" : "Post"}
                </p>
              </div>
              {(notification.source_name || notification.source_status) && (
                <p className="rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                  {notification.source_name || "Tarefa do cronograma"}
                  {notification.source_status ? ` · ${notification.source_status}` : ""}
                </p>
              )}
              <p className="text-xs font-medium text-amber-800">
                {notification.vios_ci
                  ? `Ajustar no VIOS: CI ${notification.vios_ci}${notification.vios_title ? ` · ${notification.vios_title}` : ""}`
                  : "Ajustar o responsável da tarefa correspondente no VIOS."}
              </p>
              <div className="flex items-center justify-between gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/conteudo/cronograma">Abrir cronograma</Link>
                </Button>
                <Button
                  size="sm"
                  disabled={resolvingId === notification.id}
                  onClick={() => void resolve(notification)}
                >
                  {resolvingId === notification.id
                    ? <Loader2 className="animate-spin" />
                    : <Check />}
                  VIOS ajustado
                </Button>
              </div>
            </article>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
