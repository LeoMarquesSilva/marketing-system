import * as React from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  noPadding,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/50 bg-white/70 dark:bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className={cn(!noPadding && "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#101f2e]/8 text-[#101f2e]/60">
          {icon}
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export function ComparisonStat({
  label,
  value,
  delta,
  deltaSuffix,
  sub,
  goal,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaSuffix: string;
  sub?: string;
  goal?: { targetLabel: string; pct: number | null };
}) {
  const hasDelta = delta != null;
  const positive = hasDelta && delta > 0;
  const negative = hasDelta && delta < 0;
  const goalPct = goal?.pct ?? null;
  const goalGood = goalPct != null && goalPct >= 100;
  const goalNear = goalPct != null && goalPct >= 80 && goalPct < 100;
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums leading-none mt-2">{value}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            positive && "bg-emerald-100 text-emerald-800",
            negative && "bg-rose-100 text-rose-800",
            !positive && !negative && "bg-muted text-muted-foreground"
          )}
        >
          {hasDelta ? (
            <>
              {positive ? "▲" : negative ? "▼" : "•"}
              {`${delta >= 0 ? "+" : ""}${delta.toFixed(deltaSuffix === "%" ? 1 : 2)}${deltaSuffix}`}
            </>
          ) : (
            "sem base anterior"
          )}
        </span>
        <span className="text-[11px] text-muted-foreground">vs. período anterior</span>
      </div>
      {goal && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[11px] tabular-nums">
            <span className="text-muted-foreground">Meta: {goal.targetLabel}</span>
            {goalPct != null && (
              <span
                className={cn(
                  "font-semibold",
                  goalGood ? "text-emerald-700" : goalNear ? "text-amber-600" : "text-rose-600"
                )}
              >
                {goalPct.toFixed(0)}%
              </span>
            )}
          </div>
          {goalPct != null && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  goalGood ? "bg-emerald-500" : goalNear ? "bg-amber-400" : "bg-rose-500"
                )}
                style={{ width: `${Math.min(goalPct, 100)}%` }}
              />
            </div>
          )}
        </div>
      )}
      {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}
