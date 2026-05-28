"use client";

import { getAreaIcon } from "@/lib/area-icons";
import type { BarChartItem } from "@/lib/instagram-analytics";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FormerEmployeeBadge } from "@/components/usuarios/former-employee-badge";
import { cn } from "@/lib/utils";

interface InstagramBarChartProps {
  title: string;
  data: BarChartItem[];
  useAreaIcons?: boolean;
  useAvatars?: boolean;
  emptyMessage?: string;
  maxVisibleRows?: number;
  valueFormatter?: (value: number) => string;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function InstagramBarChart({
  title,
  data,
  useAreaIcons = false,
  useAvatars = false,
  emptyMessage = "Sem dados para exibir.",
  maxVisibleRows = 10,
  valueFormatter = formatNumber,
}: InstagramBarChartProps) {
  const maxValue = data.length ? Math.max(...data.map((d) => d.total), 1) : 1;
  const showAvatars = useAvatars || data.some((d) => d.avatarUrl != null);
  const scrollable = data.length > maxVisibleRows;
  const rowHeight = 40;
  const maxScrollHeight = maxVisibleRows * rowHeight + (maxVisibleRows - 1) * 12;

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-background/50 p-5 self-start w-full">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-background/50 p-5 self-start w-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {data.length} {data.length === 1 ? "item" : "itens"}
        </span>
      </div>

      <div
        className={cn(
          "space-y-3 pr-1",
          scrollable && "overflow-y-auto overscroll-contain"
        )}
        style={scrollable ? { maxHeight: maxScrollHeight } : undefined}
      >
        {data.map((item) => {
          const Icon = useAreaIcons ? getAreaIcon(item.label) : null;
          const pct = (item.total / maxValue) * 100;

          return (
            <div
              key={`${item.label}-${item.sublabel ?? ""}`}
              className="flex items-center gap-3 min-h-[40px]"
            >
              <div className="flex w-44 lg:w-52 shrink-0 items-center gap-2 min-w-0">
                {showAvatars && (
                  <Avatar
                    className={cn(
                      "h-8 w-8 shrink-0",
                      item.isFormerEmployee && "opacity-75"
                    )}
                  >
                    <AvatarImage src={item.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="text-[10px] font-medium">
                      {getInitials(item.label)}
                    </AvatarFallback>
                  </Avatar>
                )}
                {!showAvatars && Icon && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className={cn(
                        "text-sm font-medium truncate",
                        item.isFormerEmployee && "text-muted-foreground"
                      )}
                      title={item.label}
                    >
                      {item.label}
                    </span>
                    {item.isFormerEmployee && (
                      <FormerEmployeeBadge className="shrink-0" />
                    )}
                  </div>
                  {item.sublabel && !item.isFormerEmployee && (
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {item.sublabel}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 h-7 bg-muted/40 rounded-md overflow-hidden min-w-0">
                <div
                  className="h-full rounded-md bg-[#101f2e]/85 relative flex items-center min-w-[32px]"
                  style={{ width: `${Math.max(pct, 6)}%` }}
                >
                  <span className="absolute left-2 text-[11px] font-semibold text-white tabular-nums">
                    {valueFormatter(item.total)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {scrollable && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Role para ver todos os {data.length} itens
        </p>
      )}
    </div>
  );
}
