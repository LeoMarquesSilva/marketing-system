"use client";

import { FileText, Clock, CheckCircle2, AlertTriangle, UserX, CalendarDays } from "lucide-react";

interface KpiCardsProps {
  total: number;
  totalThisMonth: number;
  avgDeliveryDays: number | null;
  completedCount: number;
  overdueCount?: number;
  unassignedCount?: number;
  isPeriodFiltered?: boolean;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: "default" | "red" | "amber" | "emerald";
}

function KpiCard({ label, value, sub, icon, accent = "default" }: KpiCardProps) {
  const accentMap = {
    default: "bg-[#101f2e]/8 text-[#101f2e]/60 dark:bg-white/10 dark:text-white/50",
    red: "bg-red-100/80 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    amber: "bg-amber-100/80 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    emerald: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  };
  const valueMap = {
    default: "text-foreground",
    red: "text-red-700 dark:text-red-400",
    amber: "text-amber-700 dark:text-amber-400",
    emerald: "text-emerald-700 dark:text-emerald-400",
  };

  return (
    <div className="rounded-2xl border border-white/40 dark:border-border/50 bg-white/70 dark:bg-card/80 backdrop-blur-sm p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${accentMap[accent]}`}>
          {icon}
        </span>
      </div>
      <div>
        <p className={`text-3xl font-bold tabular-nums leading-none ${valueMap[accent]}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

export function KpiCards({
  total,
  totalThisMonth,
  avgDeliveryDays,
  completedCount,
  overdueCount = 0,
  unassignedCount = 0,
  isPeriodFiltered = false,
}: KpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="Total"
        value={total}
        sub={isPeriodFiltered ? "solicitações no período" : "solicitações registradas"}
        icon={<FileText className="h-4 w-4" />}
      />
      <KpiCard
        label="Este Mês"
        value={totalThisMonth}
        sub="novas solicitações"
        icon={<CalendarDays className="h-4 w-4" />}
      />
      <KpiCard
        label="Concluídas"
        value={completedCount}
        sub={total > 0 ? `${((completedCount / total) * 100).toFixed(0)}% do total` : "—"}
        icon={<CheckCircle2 className="h-4 w-4" />}
        accent="emerald"
      />
      <KpiCard
        label="Tempo Médio"
        value={avgDeliveryDays !== null ? `${avgDeliveryDays.toFixed(1)}d` : "—"}
        sub="dias até entrega"
        icon={<Clock className="h-4 w-4" />}
      />
      <KpiCard
        label="Com Prazo Vencido"
        value={overdueCount}
        sub={overdueCount > 0 ? "requerem atenção" : "tudo em dia"}
        icon={<AlertTriangle className="h-4 w-4" />}
        accent={overdueCount > 0 ? "red" : "default"}
      />
      <KpiCard
        label="Sem Designer"
        value={unassignedCount}
        sub={unassignedCount > 0 ? "aguardam atribuição" : "todos atribuídos"}
        icon={<UserX className="h-4 w-4" />}
        accent={unassignedCount > 0 ? "amber" : "default"}
      />
    </div>
  );
}
