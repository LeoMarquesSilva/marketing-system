"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { EngagementTrendPoint } from "@/lib/instagram-analytics";

interface InstagramTrendChartProps {
  title: string;
  data: EngagementTrendPoint[];
  valueKey?: "engagementActions" | "engagementRate";
  valueFormatter?: (value: number) => string;
  referenceValue?: number;
  referenceLabel?: string;
  loading?: boolean;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: EngagementTrendPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2.5 shadow-md backdrop-blur-sm">
      <p className="text-xs font-semibold text-foreground">{point.bucketLabel}</p>
      <div className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
        <p>{formatPercent(point.engagementRate)} taxa de engajamento</p>
        <p>
          {point.postsCount} posts · {formatNumber(point.reach)} alcance · {formatNumber(point.views)} visualizações
        </p>
      </div>
    </div>
  );
}

export function InstagramTrendChart({
  title,
  data,
  valueKey = "engagementRate",
  valueFormatter,
  referenceValue,
  referenceLabel = "Média",
  loading = false,
}: InstagramTrendChartProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border/50 bg-background/50 p-5">
        <div className="h-4 w-40 rounded bg-muted/50 mb-4 animate-pulse" />
        <div className="h-[280px] rounded-xl bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-background/50 p-5">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">
          Sem volume suficiente no período selecionado para exibir tendência.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          {data.length} períodos
        </span>
      </div>

      <div className="h-[280px] min-h-[280px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="engagementTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#04202f" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#04202f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis
              dataKey="bucketLabel"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              dataKey={valueKey}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={valueFormatter ?? (valueKey === "engagementRate" ? formatPercent : formatNumber)}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: "rgba(16,31,46,0.18)" }} />
            {referenceValue != null && referenceValue > 0 && (
              <ReferenceLine
                y={referenceValue}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: `${referenceLabel} ${valueKey === "engagementRate" ? formatPercent(referenceValue) : formatNumber(referenceValue)}`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "#64748b",
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={valueKey}
              stroke="#04202f"
              strokeWidth={2}
              fill="url(#engagementTrendGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#04202f", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
