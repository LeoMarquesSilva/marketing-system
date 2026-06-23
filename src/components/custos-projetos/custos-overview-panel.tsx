"use client";

import { CalendarClock, Layers, TrendingUp, Wallet2 } from "lucide-react";
import { formatBrl } from "@/lib/usd-brl-ptax";
import { formatUsd } from "@/lib/supabase-billing";
import {
  formatPeriodFilterLabel,
  isCurrentPeriod,
  type CustosPeriodFilter,
} from "@/lib/custos-period-filter";
import type { CustosCategoryId, CustosOverview } from "@/lib/custos-overview";
import { cn } from "@/lib/utils";

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

interface CustosOverviewPanelProps {
  overview: CustosOverview;
  periodFilter: CustosPeriodFilter;
  onSelectCategory?: (id: CustosCategoryId) => void;
}

export function CustosOverviewPanel({
  overview,
  periodFilter,
  onSelectCategory,
}: CustosOverviewPanelProps) {
  const {
    totalMonthlyBrl,
    totalMonthlyUsd,
    categories,
    paidBrl,
    rate,
    rateInferred,
    nextDue,
  } = overview;

  const showMonthly = isCurrentPeriod(periodFilter);
  const periodLabel = formatPeriodFilterLabel(periodFilter);
  const nextDueLabel = formatDueDate(nextDue);
  const activeCategories = categories.filter((c) => c.monthlyBrl > 0);
  const denom = activeCategories.reduce((s, c) => s + c.monthlyBrl, 0) || 1;

  return (
    <section
      aria-label="Visão geral de custos"
      className="rounded-3xl border border-border/60 bg-gradient-to-br from-muted/40 to-muted/10 p-5 sm:p-6 space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="h-4 w-4 text-violet-500" />
          Visão geral
        </div>
        <span
          className="text-[11px] text-muted-foreground"
          title={
            rateInferred
              ? "Cotação inferida do pagamento mais recente com as duas moedas."
              : "Cotação de referência (sem pagamento em duas moedas para inferir)."
          }
        >
          US$ 1 ≈ {formatBrl(rate)}
          {!rateInferred && " (ref.)"}
        </span>
      </div>

      {/* Métricas principais */}
      <div className="grid gap-3 sm:grid-cols-3">
        <HeroCell
          icon={<TrendingUp className="h-4 w-4" />}
          label="Custo mensal total"
          value={showMonthly ? formatBrl(totalMonthlyBrl) : "—"}
          sub={
            showMonthly
              ? `≈ ${formatUsd(totalMonthlyUsd)} em dólar · ${activeCategories.length} serviços`
              : "Disponível no mês atual"
          }
          accent
        />
        <HeroCell
          icon={<Wallet2 className="h-4 w-4" />}
          label={`Pago em ${periodLabel}`}
          value={formatBrl(paidBrl)}
          sub="Faturas registradas no período"
        />
        <HeroCell
          icon={<CalendarClock className="h-4 w-4" />}
          label="Próximo vencimento"
          value={nextDueLabel ?? "—"}
          sub={nextDueLabel ? "Renovação Hostinger" : "Sem renovação prevista"}
        />
      </div>

      {/* Composição do custo mensal */}
      {showMonthly && activeCategories.length > 0 && (
        <div className="space-y-3">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            {activeCategories.map((c) => (
              <div
                key={c.id}
                className={cn("h-full", c.barClass)}
                style={{ width: `${(c.monthlyBrl / denom) * 100}%` }}
                title={`${c.label}: ${formatBrl(c.monthlyBrl)}`}
              />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {activeCategories.map((c) => {
              const pct = Math.round((c.monthlyBrl / denom) * 100);
              const Comp = onSelectCategory ? "button" : "div";
              return (
                <Comp
                  key={c.id}
                  {...(onSelectCategory
                    ? { type: "button" as const, onClick: () => onSelectCategory(c.id) }
                    : {})}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-left",
                    onSelectCategory && "transition-colors hover:bg-background hover:border-border"
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", c.dotClass)} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium truncate">{c.label}</span>
                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                      {formatBrl(c.monthlyBrl)} · {pct}%
                    </span>
                  </span>
                </Comp>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function HeroCell({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3.5",
        accent
          ? "border-violet-300/40 bg-violet-500/5"
          : "border-border/50 bg-background/50"
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className={cn(accent ? "text-violet-500" : "text-muted-foreground/70")}>
          {icon}
        </span>
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-bold tabular-nums",
          accent && "text-violet-700 dark:text-violet-300"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
