"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";

export interface AccountTrendPoint {
  date: string;
  label: string;
  reach: number;
  views: number;
  accountsEngaged: number;
  interactions: number;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function AccountTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: AccountTrendPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2.5 shadow-md backdrop-blur-sm">
      <p className="text-xs font-semibold text-foreground">{point.label}</p>
      <div className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
        {point.reach > 0 && <p>{formatNumber(point.reach)} alcance</p>}
        {point.views > 0 && <p>{formatNumber(point.views)} visualizações</p>}
        {point.accountsEngaged > 0 && (
          <p>{formatNumber(point.accountsEngaged)} contas engajadas</p>
        )}
        {point.interactions > 0 && <p>{formatNumber(point.interactions)} interações</p>}
      </div>
    </div>
  );
}

export function InstagramAccountTrendChart({ data }: { data: AccountTrendPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        Sem histórico ainda. Clique em &quot;Atualizar da API&quot; para puxar as métricas diárias
        que o Meta ainda expõe (janela de ~90 dias). Com sincronizações regulares, o histórico
        acumula no banco mês a mês.
      </p>
    );
  }

  const hasReach = data.some((d) => d.reach > 0);
  const hasViews = data.some((d) => d.views > 0);
  const hasEngaged = data.some((d) => d.accountsEngaged > 0);
  const hasInteractions = data.some((d) => d.interactions > 0);
  const showEngagement = !hasReach && !hasViews && (hasEngaged || hasInteractions);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3 mb-2 text-[11px] text-muted-foreground">
        {hasReach && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#101f2e]" /> Alcance
          </span>
        )}
        {hasViews && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> Visualizações
          </span>
        )}
        {(showEngagement || hasEngaged) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-500" /> Contas engajadas
          </span>
        )}
        {(showEngagement || hasInteractions) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Interações
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          {data.length} dias
        </span>
      </div>
      <div className="h-[260px] min-h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="acctReachGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#101f2e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#101f2e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="acctViewsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="acctEngagedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="acctInteractionsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<AccountTooltip />} cursor={{ stroke: "rgba(16,31,46,0.18)" }} />
            {hasReach && (
              <Area
                type="monotone"
                dataKey="reach"
                stroke="#101f2e"
                strokeWidth={2}
                fill="url(#acctReachGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#101f2e", strokeWidth: 0 }}
              />
            )}
            {hasViews && (
              <Area
                type="monotone"
                dataKey="views"
                stroke="#38bdf8"
                strokeWidth={2}
                fill="url(#acctViewsGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#38bdf8", strokeWidth: 0 }}
              />
            )}
            {(showEngagement || hasEngaged) && (
              <Area
                type="monotone"
                dataKey="accountsEngaged"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#acctEngagedGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
              />
            )}
            {(showEngagement || hasInteractions) && (
              <Area
                type="monotone"
                dataKey="interactions"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#acctInteractionsGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
