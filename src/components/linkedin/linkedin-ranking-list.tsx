import { ArrowUpRight } from "lucide-react";
import type { LinkedinGroupPerformance } from "@/lib/linkedin-analytics";

interface LinkedinRankingListProps {
  items: LinkedinGroupPerformance[];
  emptyLabel: string;
}

export function LinkedinRankingList({ items, emptyLabel }: LinkedinRankingListProps) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const maxRate = Math.max(...items.map((item) => item.engagementRate), 1);

  return (
    <div className="divide-y divide-border/40">
      {items.slice(0, 10).map((item, index) => (
        <div key={item.label} className="group grid grid-cols-[30px_1fr_auto] items-center gap-3 py-3.5">
          <span className="font-mono text-xs font-semibold text-slate-400">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
              {index === 0 && <ArrowUpRight className="h-3.5 w-3.5 text-[#0A66C2]" />}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0A66C2] to-[#47cdd0]"
                style={{ width: `${Math.max(5, (item.engagementRate / maxRate) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {item.posts} post{item.posts !== 1 ? "s" : ""} · {item.impressions.toLocaleString("pt-BR")} impressões
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-bold tabular-nums text-[#0A66C2]">
              {item.engagementRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">engaj.</p>
          </div>
        </div>
      ))}
    </div>
  );
}
