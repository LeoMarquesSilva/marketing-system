import type { LinkedinDemographicSnapshot } from "@/lib/linkedin-types";

export function LinkedinDemographicRanking({
  items,
  emptyLabel,
}: {
  items: LinkedinDemographicSnapshot[];
  emptyLabel: string;
}) {
  const ranked = [...items].sort((left, right) => right.metric_value - left.metric_value).slice(0, 10);
  const total = items.reduce((sum, item) => sum + item.metric_value, 0);
  const max = ranked[0]?.metric_value ?? 0;

  if (ranked.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {ranked.map((item, index) => (
        <div key={`${item.dimension}-${item.label}`} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3">
          <span className="font-mono text-[10px] text-slate-400">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs font-medium text-slate-700" title={item.label}>{item.label}</p>
              <span className="shrink-0 text-[10px] text-slate-400">
                {total > 0 ? `${((item.metric_value / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%"}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0A66C2] to-[#47cdd0]" style={{ width: `${max > 0 ? (item.metric_value / max) * 100 : 0}%` }} />
            </div>
          </div>
          <span className="font-mono text-xs font-semibold tabular-nums text-slate-700">{item.metric_value.toLocaleString("pt-BR")}</span>
        </div>
      ))}
    </div>
  );
}
