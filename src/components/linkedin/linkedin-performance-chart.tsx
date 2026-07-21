"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LinkedinTrendPoint } from "@/lib/linkedin-analytics";

interface LinkedinPerformanceChartProps {
  data: LinkedinTrendPoint[];
}

function compactNumber(value: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function LinkedinChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: LinkedinTrendPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-3 shadow-xl backdrop-blur">
      <p className="text-xs font-semibold capitalize text-slate-900">{point.label}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-[11px]">
        <span className="text-slate-500">Impressões</span>
        <span className="text-right font-semibold tabular-nums">{point.impressions.toLocaleString("pt-BR")}</span>
        <span className="text-slate-500">Cliques</span>
        <span className="text-right font-semibold tabular-nums">{point.clicks.toLocaleString("pt-BR")}</span>
        <span className="text-slate-500">Engajamento</span>
        <span className="text-right font-semibold tabular-nums">{point.engagementRate.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function LinkedinPerformanceChart({ data }: LinkedinPerformanceChartProps) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Sem dados no período selecionado.</p>;
  }

  return (
    <div className="h-[330px] min-h-[330px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={330}>
        <ComposedChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="linkedinImpressions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A66C2" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#0A66C2" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.07)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            yAxisId="volume"
            tickFormatter={compactNumber}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip content={<LinkedinChartTooltip />} cursor={{ stroke: "rgba(10,102,194,0.18)" }} />
          <Area
            yAxisId="volume"
            type="monotone"
            dataKey="impressions"
            stroke="#0A66C2"
            strokeWidth={2.4}
            fill="url(#linkedinImpressions)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#0A66C2" }}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="engagementRate"
            stroke="#47cdd0"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0, fill: "#04202f" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
