"use client";

import { CalendarDays, CheckCircle2, CircleAlert, Wallet } from "lucide-react";
import { formatBrl, type EventsOverview } from "@/lib/eventos";

export function EventosOverviewPanel({ overview, year, loading }: { overview: EventsOverview; year: number; loading?: boolean }) {
  return <section aria-label={`Panorama de ${year}`} aria-busy={loading} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[{ label: "Eventos no ano", value: String(overview.totalEvents), detail: `${overview.inProgress} em andamento`, icon: CalendarDays },
      { label: "Verba aprovada", value: overview.budgetApprovedTotal ? formatBrl(overview.budgetApprovedTotal) : "A definir", detail: `${formatBrl(overview.budgetPlannedTotal)} previsto`, icon: Wallet },
      { label: "Eventos concluídos", value: String(overview.completed), detail: `${formatBrl(overview.budgetActualTotal)} realizado`, icon: CheckCircle2 },
      { label: "Tarefas atrasadas", value: String(overview.overdueTasks), detail: overview.overdueTasks ? "Confira os prazos no Planner do evento" : "Nenhuma tarefa em atraso", icon: CircleAlert }].map(item => <div key={item.label} className="rounded-xl border border-border/70 bg-card p-4"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">{item.label}<item.icon className="size-4 text-primary" /></div><p className="mt-3 text-xl font-semibold tracking-tight tabular-nums">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div>)}
    {(overview.noApprovedSupplier + overview.noBudget + overview.budgetExceeded + overview.pendingPayments + overview.missingPostEvent > 0) && <details className="col-span-full rounded-lg border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Pontos de atenção do ano</summary><p className="mt-2 leading-6">{overview.noApprovedSupplier} sem fornecedor aprovado · {overview.noBudget} sem orçamento · {overview.budgetExceeded} com orçamento excedido · {overview.pendingPayments} com pagamentos pendentes · {overview.missingPostEvent} sem pós-evento</p></details>}
  </section>;
}
