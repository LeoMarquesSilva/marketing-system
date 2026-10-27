"use client";

import { ArrowRight, Check, Pencil, RotateCw, Send, Undo2, XCircle, type LucideIcon } from "lucide-react";
import {
  fieldLabel,
  flaggedItems,
  formatAnswerValue,
  REGISTRATION_EVENT_LABEL,
  type RegistrationEvent,
  type RegistrationEventType,
  untouchedFields,
} from "@/lib/rh/registration/history";
import type { RegistrationField } from "@/lib/rh/registration/types";
import { cn } from "@/lib/utils";

const EVENT_STYLE: Record<RegistrationEventType, { icon: LucideIcon; tone: string }> = {
  enviada: { icon: Send, tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  reenviada: { icon: RotateCw, tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  devolvida: { icon: Undo2, tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  corrigida: { icon: Pencil, tone: "bg-[#e8f8f8] text-[#285f7a] ring-[#bfeaec]" },
  aprovada: { icon: Check, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  cancelada: { icon: XCircle, tone: "bg-muted text-muted-foreground ring-border" },
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

/**
 * Vaivém da ficha: quem enviou, o que a RH pediu para ajustar e o que a pessoa
 * mudou ao reenviar (para ver se errou de novo no mesmo campo).
 */
export function RegistrationTimeline({ events, personName }: { events: RegistrationEvent[]; personName: string }) {
  if (events.length === 0) return null;
  const firstName = personName.trim().split(/\s+/)[0] ?? personName;

  // Reenvio que não mexeu num campo pedido na devolução anterior.
  const untouched = new Map<string, RegistrationField[]>();
  let lastFlagged: RegistrationField[] = [];
  for (const event of events) {
    if (event.type === "devolvida") lastFlagged = event.fields;
    if (event.type === "reenviada" && lastFlagged.length) {
      const missed = untouchedFields(lastFlagged, event.changes.map((change) => change.field));
      if (missed.length) untouched.set(event.id, missed);
      lastFlagged = [];
    }
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card">
      <h3 className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold text-muted-foreground">Histórico</h3>
      <ol className="space-y-4 px-4 py-4">
        {[...events].reverse().map((event) => {
          const style = EVENT_STYLE[event.type];
          const Icon = style.icon;
          const who = event.actor === "pessoa" ? firstName : event.actorName ?? "Pessoas e Cultura";
          return (
            <li key={event.id} className="flex gap-3">
              <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1", style.tone)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{who}</span> {REGISTRATION_EVENT_LABEL[event.type].toLowerCase()}
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{formatDateTime(event.createdAt)}</span>
                </p>
                {event.note && (
                  <p className="whitespace-pre-line rounded-md bg-muted/50 px-2.5 py-1.5 text-sm text-foreground">
                    “{event.note}”
                  </p>
                )}
                {event.fields.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {flaggedItems(event.fields).map((item) => (
                      <span
                        key={item.field}
                        className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200"
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                )}
                {event.changes.length > 0 && (
                  <dl className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/70">
                    {event.changes.map((change) => (
                      <div key={change.field} className="grid gap-0.5 px-2.5 py-1.5 sm:grid-cols-[150px_1fr] sm:gap-3">
                        <dt className="text-xs text-muted-foreground sm:pt-0.5">{fieldLabel(change.field)}</dt>
                        <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                          {change.before ? (
                            <span className="break-words text-muted-foreground line-through">
                              {formatAnswerValue(change.field, change.before)}
                            </span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">vazio</span>
                          )}
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="passou a ser" />
                          {change.after ? (
                            <span className="break-words font-medium text-foreground">
                              {formatAnswerValue(change.field, change.after)}
                            </span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">vazio</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {event.type === "reenviada" && event.changes.length === 0 && (
                  <p className="text-xs text-muted-foreground">Reenviou sem mudar nenhum campo.</p>
                )}
                {untouched.has(event.id) && (
                  <p className="text-xs font-medium text-amber-800">
                    Não mexeu em:{" "}
                    {flaggedItems(untouched.get(event.id) ?? [])
                      .map((item) => item.label)
                      .join(", ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
