"use client";

import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import type { ContentScheduleAssignmentNotification } from "@/lib/content-schedule/types";
import { Button } from "@/components/ui/button";

function notificationDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`)).replaceAll(".", "");
}

/** Trocas do calendário editorial para refletir no VIOS (seção do sino de avisos). */
export function ContentScheduleNotificationsList({
  notifications,
  loading,
  resolvingId,
  error,
  onResolve,
  onNavigate,
}: {
  notifications: ContentScheduleAssignmentNotification[];
  loading: boolean;
  resolvingId: string | null;
  error: string | null;
  onResolve: (notification: ContentScheduleAssignmentNotification) => void;
  onNavigate?: () => void;
}) {
  return (
    <div>
      {error && <p role="alert" className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center gap-2 px-1 py-6 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />Carregando…
        </div>
      ) : notifications.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-slate-500">Nenhum ajuste pendente no VIOS.</p>
      ) : notifications.map((notification) => (
        <article key={notification.id} className="space-y-3 border-b border-slate-200 px-1 py-3 last:border-b-0">
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
              <Link href="/conteudo/cronograma" onClick={onNavigate}>Abrir calendário editorial</Link>
            </Button>
            <Button
              size="sm"
              disabled={resolvingId === notification.id}
              onClick={() => onResolve(notification)}
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
  );
}
