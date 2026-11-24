"use client";

import * as React from "react";
import { CalendarRange, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricsSection } from "@/components/social-metrics/metrics-ui";
import { formatPercent } from "@/lib/social-metrics/format";
import { monthlyPostVolume } from "@/lib/social-metrics/instagram";
import type { InstagramPost } from "@/lib/instagram-posts";

/**
 * Ritmo de publicação: posts por mês nos últimos 12 meses contra a meta mensal
 * (editável aqui, como na tela antiga) e o acumulado do ano contra a meta anual.
 */
export function PublishingPace({
  posts,
  until,
  monthlyGoal,
  onGoalChange,
}: {
  posts: InstagramPost[];
  until: string;
  monthlyGoal: number;
  onGoalChange: (goal: number) => void;
}) {
  const months = React.useMemo(() => monthlyPostVolume(posts, until, 12), [posts, until]);
  // Folga de 15% no topo para o número acima da barra mais alta.
  const max = Math.max(monthlyGoal, ...months.map((month) => month.posts), 1) * 1.15;
  const judged = months.filter((month) => !month.current);
  const hits = judged.filter((month) => month.posts >= monthlyGoal).length;
  const year = until.slice(0, 4);
  const yearToDate = months.filter((month) => month.month.startsWith(year)).reduce((sum, month) => sum + month.posts, 0);
  const annualGoal = monthlyGoal * 12;

  return (
    <MetricsSection
      title="Ritmo de publicação"
      icon={CalendarRange}
      description={`Posts por mês nos últimos 12 meses contra a meta. ${hits} de ${judged.length} meses fechados bateram a meta.`}
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Meta por mês</span>
          <div className="inline-flex items-center rounded-md border border-[#dce9eb] bg-white">
            <button
              type="button"
              aria-label="Diminuir a meta mensal"
              onClick={() => onGoalChange(Math.max(1, monthlyGoal - 1))}
              className="flex size-8 items-center justify-center text-[#285f7a] hover:bg-[#47cdd0]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
            >
              <Minus className="size-3.5" aria-hidden />
            </button>
            <span className="min-w-8 text-center font-mono text-sm font-semibold text-[#10232d]" aria-live="polite">
              {monthlyGoal}
            </span>
            <button
              type="button"
              aria-label="Aumentar a meta mensal"
              onClick={() => onGoalChange(monthlyGoal + 1)}
              className="flex size-8 items-center justify-center text-[#285f7a] hover:bg-[#47cdd0]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      }
    >
      <div className="relative h-40">
        <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2.5">
          {months.map((month) => {
            const height = (month.posts / max) * 100;
            const tone = month.current ? "current" : month.posts >= monthlyGoal ? "good" : month.posts >= monthlyGoal * 0.8 ? "near" : "low";
            return (
              <div key={month.month} className="relative flex h-full min-w-0 flex-1 items-end justify-center">
                <div
                  className={cn(
                    "relative w-full max-w-10 rounded-t-[4px]",
                    tone === "current" && "bg-[#2e7cb0]/45",
                    tone === "good" && "bg-emerald-500",
                    tone === "near" && "bg-amber-500",
                    tone === "low" && "bg-rose-400"
                  )}
                  style={{ height: `${Math.max(height, month.posts ? 3 : 0)}%` }}
                  title={`${month.label}: ${month.posts} post(s)${month.current ? " (mês em andamento)" : month.posts >= monthlyGoal ? " · meta batida" : ""}`}
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-xs font-semibold text-[#10232d]">{month.posts}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-[#10232d]/40"
          style={{ bottom: `${(monthlyGoal / max) * 100}%` }}
          aria-hidden
        >
          <span className="absolute -top-5 right-0 rounded bg-white px-1 text-xs font-medium text-[#10232d]">meta {monthlyGoal}</span>
        </div>
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {months.map((month) => (
          <span key={month.month} className={cn("min-w-0 flex-1 truncate text-center text-xs", month.current ? "font-semibold text-[#10232d]" : "text-[#6b8591]")}>
            {month.label}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#edf3f5] pt-3 text-xs text-[#4a6470]">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden /> Na meta</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-500" aria-hidden /> Perto (80% ou mais)</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-400" aria-hidden /> Abaixo</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#2e7cb0]/45" aria-hidden /> Mês em andamento</span>
        <span className="ml-auto font-medium text-[#10232d]">
          {year}: {yearToDate} de {annualGoal} posts ({formatPercent((yearToDate / annualGoal) * 100, 0)} da meta anual)
        </span>
      </div>
    </MetricsSection>
  );
}
