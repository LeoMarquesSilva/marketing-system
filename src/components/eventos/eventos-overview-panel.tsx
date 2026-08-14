"use client";

import { CalendarClock, CheckCircle2, Loader2, TrendingUp, Wallet2 } from "lucide-react";
import { formatBrl, type EventsOverview } from "@/lib/eventos";

interface EventosOverviewPanelProps {
  overview: EventsOverview;
  year: number;
  loading?: boolean;
}

export function EventosOverviewPanel({ overview, year, loading }: EventosOverviewPanelProps) {
  const {
    totalEvents,
    inProgress,
    completed,
    budgetApprovedTotal,
    budgetPlannedTotal,
    budgetActualTotal,
    overdueTasks,
    noApprovedSupplier,
    noBudget,
    budgetExceeded,
    pendingPayments,
    missingPostEvent,
  } = overview;

  return (
    <section
      aria-label="Visão geral de eventos"
      className="rounded-lg border border-border/60 bg-gradient-to-br from-muted/40 to-muted/10 p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-violet-500" />
          Visão geral — {year}
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Eventos no ano"
          value={String(totalEvents)}
          sub={`${inProgress} em andamento · ${completed} concluídos`}
        />
        <MetricCard
          icon={<Wallet2 className="h-4 w-4" />}
          label="Verba aprovada"
          value={budgetApprovedTotal > 0 ? formatBrl(budgetApprovedTotal) : "—"}
          sub={
            budgetPlannedTotal > 0 || budgetActualTotal > 0
              ? `Previsto: ${formatBrl(budgetPlannedTotal)} · Realizado: ${formatBrl(budgetActualTotal)}`
              : "Informe a verba no cadastro do evento"
          }
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Tarefas atrasadas"
          value={String(overdueTasks)}
          sub={overdueTasks === 0 ? "Tudo em dia" : "Revisar prazos no detalhe"}
          accent={overdueTasks > 0}
        />
        <MetricCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Em andamento"
          value={String(inProgress)}
          sub="Eventos ativos neste ano"
        />
        <MetricCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Sem fornecedor aprovado"
          value={String(noApprovedSupplier)}
          sub="Eventos críticos para contratação"
          accent={noApprovedSupplier > 0}
        />
        <MetricCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Alertas financeiros"
          value={String(noBudget + budgetExceeded + pendingPayments)}
          sub={`Sem orçamento: ${noBudget} · Estourado: ${budgetExceeded} · Pendente: ${pendingPayments}`}
          accent={noBudget + budgetExceeded + pendingPayments > 0}
        />
        <MetricCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Sem pós-evento"
          value={String(missingPostEvent)}
          sub="Eventos realizados sem fechamento"
          accent={missingPostEvent > 0}
        />
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? "border-red-200 bg-red-50/50" : "border-border/50 bg-background/60"
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
