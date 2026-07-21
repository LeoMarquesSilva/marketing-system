"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LinkedinAudienceTrendPoint } from "@/lib/linkedin-analytics";

function compactNumber(value: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function AudienceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: LinkedinAudienceTrendPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-3 shadow-xl backdrop-blur">
      <p className="text-xs font-semibold capitalize text-slate-900">{point.label}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-[11px]">
        <span className="text-slate-500">Novos seguidores</span>
        <span className="text-right font-semibold tabular-nums">{point.newFollowers.toLocaleString("pt-BR")}</span>
        <span className="text-slate-500">Visualizações</span>
        <span className="text-right font-semibold tabular-nums">{point.pageViews.toLocaleString("pt-BR")}</span>
        <span className="text-slate-500">Visitantes únicos</span>
        <span className="text-right font-semibold tabular-nums">{point.uniqueVisitors.toLocaleString("pt-BR")}</span>
      </div>
    </div>
  );
}

export function LinkedinAudienceChart({ data }: { data: LinkedinAudienceTrendPoint[] }) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Sem dados de público no período.</p>;
  }

  return (
    <div className="h-[330px] min-h-[330px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={330}>
        <ComposedChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="linkedinPageViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A66C2" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#0A66C2" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.07)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} minTickGap={22} />
          <YAxis yAxisId="traffic" tickFormatter={compactNumber} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={42} />
          <YAxis yAxisId="followers" orientation="right" tickFormatter={compactNumber} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={38} />
          <Tooltip content={<AudienceTooltip />} cursor={{ stroke: "rgba(10,102,194,0.18)" }} />
          <Area yAxisId="traffic" type="monotone" dataKey="pageViews" stroke="#0A66C2" strokeWidth={2.4} fill="url(#linkedinPageViews)" dot={false} />
          <Line yAxisId="traffic" type="monotone" dataKey="uniqueVisitors" stroke="#47cdd0" strokeWidth={2} dot={false} />
          <Bar yAxisId="followers" dataKey="newFollowers" fill="#07141f" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
