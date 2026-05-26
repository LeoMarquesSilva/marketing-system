"use client";

import { getAreaIcon } from "@/lib/area-icons";
import type { BarChartItem } from "@/lib/instagram-analytics";
import { FormerEmployeeBadge } from "@/components/usuarios/former-employee-badge";
import { cn } from "@/lib/utils";

interface InstagramBarChartProps {
  title: string;
  data: BarChartItem[];
  useAreaIcons?: boolean;
  emptyMessage?: string;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

export function InstagramBarChart({
  title,
  data,
  useAreaIcons = false,
  emptyMessage = "Sem dados para exibir.",
}: InstagramBarChartProps) {
  const maxValue = data.length ? Math.max(...data.map((d) => d.total), 1) : 1;

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-sm p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)]">
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-sm p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)] h-full">
      <h3 className="text-base font-semibold mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item) => {
          const Icon = useAreaIcons ? getAreaIcon(item.label) : null;
          const pct = (item.total / maxValue) * 100;
          return (
            <div key={`${item.label}-${item.sublabel ?? ""}`} className="flex items-center gap-3">
              <div className="flex w-40 lg:w-48 shrink-0 flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {Icon && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium truncate",
                      item.isFormerEmployee && "text-muted-foreground"
                    )}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                  {item.isFormerEmployee && <FormerEmployeeBadge />}
                </div>
                {item.sublabel && !item.isFormerEmployee && (
                  <span className="text-[11px] text-muted-foreground truncate pl-9">
                    {item.sublabel}
                  </span>
                )}
              </div>
              <div className="flex-1 h-6 bg-muted/30 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md bg-primary/85 relative flex items-center min-w-[28px]"
                  style={{ width: `${Math.max(pct, 4)}%` }}
                >
                  <span className="absolute left-2 text-xs font-semibold text-primary-foreground">
                    {formatNumber(item.total)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
