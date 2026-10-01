"use client";

import { History } from "lucide-react";
import type { EventHistoryItem } from "@/lib/eventos";

export function EventoHistoricoTab({ items }: { items: EventHistoryItem[] }) {
  return <section className="space-y-5"><div><h2 className="text-lg font-semibold tracking-tight">Histórico do evento</h2><p className="mt-1 text-xs text-muted-foreground">Decisões e atualizações, em ordem de registro.</p></div><ol className="rounded-xl border border-border/70 bg-card p-5">{items.map(item => <li key={item.id} className="relative ml-2 border-l border-border pb-6 pl-6 last:border-transparent last:pb-0"><span className="absolute -left-[13px] top-0 flex size-6 items-center justify-center rounded-full border bg-card"><History className="size-3 text-primary" /></span><p className="text-sm font-medium leading-6">{item.actionLabel}</p><p className="mt-1 text-xs text-muted-foreground">{item.actorUserName || "Sistema"} · {new Date(item.createdAt).toLocaleString("pt-BR")}</p></li>)}{!items.length && <li className="py-6 text-center text-sm text-muted-foreground">As atualizações deste evento aparecerão aqui.</li>}</ol></section>;
}
