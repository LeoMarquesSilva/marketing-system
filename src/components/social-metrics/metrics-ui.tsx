"use client";

/**
 * Peças comuns das telas de Métricas (Resumo, Instagram, LinkedIn, Site):
 * seção, indicador com variação, selo de atualização e estado vazio.
 */
import * as React from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleCheck, CircleX, Clock3, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deltaPercent, formatDateTime, formatDelta } from "@/lib/social-metrics/format";
import { formatFullDate } from "@/lib/social-metrics/period";
import { freshnessLabel, freshnessTone, type SourceFreshness } from "@/lib/social-metrics/freshness";
import { Sparkline } from "@/components/social-metrics/metrics-charts";

/* ----------------------------------------------------------------- seção */

export function MetricsSection({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)]", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[#eef6f8] text-[#285f7a]">
              <Icon className="size-4" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#10232d]">{title}</h3>
            {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={cn("px-5 pb-5 pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------ indicador */

export interface KpiTileProps {
  label: string;
  icon: LucideIcon;
  value: string;
  current: number | null;
  previous: number | null;
  /** Texto do valor anterior ("72 mil"). */
  previousText?: string;
  compareLabel: string;
  /** Queda é boa (ex.: deixaram de seguir). */
  inverse?: boolean;
  sub?: React.ReactNode;
  note?: string;
  spark?: (number | null)[];
  selected?: boolean;
  onSelect?: () => void;
  hint?: string;
  /** Meta do período: barra de progresso com o % atingido. */
  goal?: { label: string; pct: number | null };
}

export function KpiTile({
  label,
  icon: Icon,
  value,
  current,
  previous,
  previousText,
  compareLabel,
  inverse,
  sub,
  note,
  spark,
  selected,
  onSelect,
  hint,
  goal,
}: KpiTileProps) {
  const delta = deltaPercent(current, previous);
  const good = delta === null || Math.abs(delta) < 0.5 ? null : inverse ? delta < 0 : delta > 0;
  const DeltaIcon = delta === null || Math.abs(delta) < 0.5 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const Wrapper = onSelect ? "button" : "div";

  return (
    <Wrapper
      type={onSelect ? "button" : undefined}
      onClick={onSelect}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        "group flex min-w-0 flex-col gap-3 rounded-lg border bg-white p-4 text-left transition-colors",
        onSelect && "cursor-pointer hover:border-[#9fcbd6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
        selected ? "border-[#347796] shadow-[0_0_0_1px_#347796]" : "border-[#dce9eb]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#4a6470]">
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", selected ? "bg-[#347796] text-white" : "bg-[#eef6f8] text-[#285f7a]")}>
            <Icon className="size-3.5" aria-hidden />
          </span>
          <span className="truncate">{label}</span>
        </span>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-xs text-muted-foreground underline decoration-dotted underline-offset-2">?</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[26px] font-semibold leading-none tracking-normal text-[#10232d]">{value}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
                  good === null ? "bg-[#f1f5f7] text-[#4a6470]" : good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                )}
              >
                <DeltaIcon className="size-3" aria-hidden />
                {formatDelta(delta)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {delta === null ? `Sem base para comparar em ${compareLabel}.` : `${compareLabel}: ${previousText ?? "—"}`}
            </TooltipContent>
          </Tooltip>
        </div>
        {spark && spark.some((v) => v !== null) && (
          <div className="h-10 w-24 shrink-0" aria-hidden>
            <Sparkline values={spark} />
          </div>
        )}
      </div>

      {goal && <GoalBar label={goal.label} pct={goal.pct} />}

      {(sub || note) && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {sub && <div>{sub}</div>}
          {note && (
            <p className="flex items-start gap-1 text-[#8a5a12]">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              {note}
            </p>
          )}
        </div>
      )}
    </Wrapper>
  );
}

/** Barra de meta: verde quando atingida, âmbar a partir de 80%, rosa abaixo. */
export function GoalBar({ label, pct }: { label: string; pct: number | null }) {
  const value = pct === null || !Number.isFinite(pct) ? null : pct;
  const tone = value === null ? "none" : value >= 100 ? "good" : value >= 80 ? "near" : "low";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-[#4a6470]">{label}</span>
        <span
          className={cn(
            "font-mono font-semibold",
            tone === "good" ? "text-emerald-700" : tone === "near" ? "text-amber-700" : tone === "low" ? "text-rose-700" : "text-muted-foreground"
          )}
        >
          {value === null ? "—" : `${Math.round(value)}%`}
          {tone === "good" && <span className="ml-1 font-sans font-medium">· meta batida</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#eef3f5]" role="progressbar" aria-valuenow={value === null ? undefined : Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div
          className={cn("h-1.5 rounded-full", tone === "good" ? "bg-emerald-500" : tone === "near" ? "bg-amber-500" : "bg-rose-500")}
          style={{ width: `${Math.min(100, Math.max(value ?? 0, value ? 2 : 0))}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- frescor */

const TONE_STYLE = {
  ok: { dot: "bg-emerald-500", pill: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CircleCheck },
  warning: { dot: "bg-amber-500", pill: "border-amber-200 bg-amber-50 text-amber-900", icon: Clock3 },
  danger: { dot: "bg-rose-500", pill: "border-rose-200 bg-rose-50 text-rose-800", icon: CircleX },
} as const;

export function FreshnessBadge({ freshness, className, compact }: { freshness: SourceFreshness; className?: string; compact?: boolean }) {
  const [now] = React.useState(() => Date.now());
  const tone = freshnessTone(freshness, now);
  const style = TONE_STYLE[tone];
  const Icon = style.icon;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
            style.pill,
            className
          )}
        >
          <span className={cn("size-2 rounded-full", style.dot)} aria-hidden />
          {freshnessLabel(freshness, now)}
          {freshness.dataUntil && !compact && <span className="hidden font-normal opacity-80 sm:inline">· dados até {formatFullDate(freshness.dataUntil)}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b border-[#dce9eb] px-4 py-3">
          <Icon className={cn("size-4", tone === "ok" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-rose-600")} aria-hidden />
          <p className="text-sm font-semibold text-[#10232d]">{freshness.label}</p>
        </div>
        <dl className="space-y-2 px-4 py-3 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Última atualização</dt>
            <dd className="font-medium text-[#10232d]">{formatDateTime(freshness.lastSuccessAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Dados até</dt>
            <dd className="font-medium text-[#10232d]">{freshness.dataUntil ? formatFullDate(freshness.dataUntil) : "—"}</dd>
          </div>
          <p className="pt-1 leading-relaxed text-muted-foreground">{freshness.howItArrives}</p>
          {freshness.lastError && (
            <p className="rounded-md bg-rose-50 px-2.5 py-2 leading-relaxed text-rose-800">
              Última tentativa falhou ({formatDateTime(freshness.lastAttemptAt)}): {freshness.lastError.slice(0, 220)}
            </p>
          )}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------- vazio */

export function MetricsEmpty({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#dce9eb] bg-[#fbfdfd] px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-[#eef6f8] text-[#3e84a8]">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-[#10232d]">{title}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Chip de filtro/ordenação (nada de select nativo). */
export function FilterChip({
  selected,
  onClick,
  children,
  icon: Icon,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: LucideIcon;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
        selected
          ? "border-[#347796] bg-[#347796] text-white"
          : "border-[#dce9eb] bg-white text-[#36505c] hover:border-[#9fcbd6] hover:bg-[#f4fafb]"
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
      {count !== undefined && count > 0 && (
        <span className={cn("rounded-full px-1.5 text-xs leading-4", selected ? "bg-white/20" : "bg-[#eaf2f5] text-[#285f7a]")}>{count}</span>
      )}
    </button>
  );
}
