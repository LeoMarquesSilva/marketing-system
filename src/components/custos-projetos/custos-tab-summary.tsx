"use client";

import { formatUsd } from "@/lib/supabase-billing";
import { formatBrl } from "@/lib/usd-brl-ptax";
import { formatPeriodFilterLabel, type CustosPeriodFilter } from "@/lib/custos-period-filter";
import type { CustosTabId } from "@/components/custos-projetos/custos-projetos-tabs";
import { cn } from "@/lib/utils";

interface CustosTabSummaryProps {
  activeTab: CustosTabId;
  periodFilter: CustosPeriodFilter;
  monthlyLabel: string;
  monthlyHint?: string;
  paidBrl: number;
  paidUsd: number;
  nextDue?: string | null;
}

export function CustosTabSummary({
  activeTab,
  periodFilter,
  monthlyLabel,
  monthlyHint,
  paidBrl,
  paidUsd,
  nextDue,
}: CustosTabSummaryProps) {
  const periodLabel = formatPeriodFilterLabel(periodFilter);
  const tabLabel =
    activeTab === "supabase" ? "Supabase" : activeTab === "cursor" ? "Cursor" : "N8N / VPS";

  const paidLabel =
    paidBrl > 0 ? formatBrl(paidBrl) : paidUsd > 0 ? formatUsd(paidUsd) : formatBrl(0);
  const paidSub =
    paidBrl > 0 && paidUsd > 0 ? `≈ ${formatUsd(paidUsd)}` : undefined;

  // Mostra a coluna de vencimento só quando há data — evita célula vazia.
  const cols = nextDue ? "sm:grid-cols-3" : "sm:grid-cols-2";

  return (
    <div className={cn("grid gap-3", cols)}>
      <SummaryCell
        label={`Custo mensal · ${tabLabel}`}
        value={monthlyLabel}
        sub={monthlyHint}
        accent
      />
      <SummaryCell label={`Pago em ${periodLabel}`} value={paidLabel} sub={paidSub} />
      {nextDue && (
        <SummaryCell
          label="Próximo vencimento"
          value={nextDue}
          sub="Renovação prevista"
        />
      )}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3.5",
        accent
          ? "border-emerald-200/50 bg-emerald-50/40 dark:bg-emerald-950/20"
          : "border-border/50 bg-muted/20"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-xl font-bold tabular-nums mt-1",
          accent && "text-emerald-700 dark:text-emerald-400"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
