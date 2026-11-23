"use client";

/**
 * Gráficos das telas de Métricas. Paleta categórica validada (ordem fixa, passa
 * no teste de daltonismo e contraste): azul, ocre, roxo, verde-água. Período
 * anterior em cinza tracejado (referência, não série). Um eixo só, linhas de
 * 2 px, barras com ponta arredondada e dica (tooltip) ao passar o mouse.
 */
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCompact, formatInt, formatPercent } from "@/lib/social-metrics/format";
import { formatDayMonth, formatFullDate } from "@/lib/social-metrics/period";

export const CHART_COLORS = {
  blue: "#2e7cb0",
  ochre: "#c47f2a",
  purple: "#7466b4",
  teal: "#1f9fa2",
  rose: "#c2557a",
  previous: "#9aa9b3",
  grid: "#e7eff1",
  axis: "#6b8591",
} as const;

/** Cor fixa por formato (a cor segue o formato, nunca a posição no ranking). */
export const FORMAT_COLORS = {
  reels: CHART_COLORS.blue,
  stories: CHART_COLORS.ochre,
  carrossel: CHART_COLORS.purple,
  imagem: CHART_COLORS.teal,
} as const;

/** Cor fixa por canal na tela Resumo. */
export const CHANNEL_COLORS = {
  instagram: CHART_COLORS.purple,
  linkedin: CHART_COLORS.blue,
  site: CHART_COLORS.teal,
} as const;

const axisTick = { fontSize: 12, fill: CHART_COLORS.axis };

/* -------------------------------------------------------------- tooltip */

function TooltipShell({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="min-w-44 rounded-md border border-[#dce9eb] bg-white px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-[#10232d]">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[#4a6470]">
              {row.color && (
                <span
                  className={cn("inline-block h-0.5 w-3", row.dashed && "border-t-2 border-dashed bg-transparent")}
                  style={row.dashed ? { borderColor: row.color } : { background: row.color, height: 3 }}
                  aria-hidden
                />
              )}
              {row.label}
            </span>
            <span className="font-mono font-medium text-[#10232d]">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- sparkline */

export function Sparkline({ values, color = CHART_COLORS.blue }: { values: (number | null)[]; color?: string }) {
  const data = values.map((value, index) => ({ index, value }));
  const id = React.useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#spark-${id})`} connectNulls isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------- tendência com período anterior */

export interface TrendPoint {
  date: string;
  value: number | null;
  previous?: number | null;
  previousDate?: string;
}

export function TrendChart({
  data,
  label,
  previousLabel,
  color = CHART_COLORS.blue,
  height = 260,
  format = formatInt,
}: {
  data: TrendPoint[];
  label: string;
  previousLabel?: string;
  color?: string;
  height?: number;
  format?: (value: number) => string;
}) {
  const id = React.useId().replace(/:/g, "");
  const hasPrevious = Boolean(previousLabel) && data.some((point) => point.previous !== null && point.previous !== undefined);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-[#4a6470]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: color }} aria-hidden />
          {label}
        </span>
        {hasPrevious && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: CHART_COLORS.previous }} aria-hidden />
            {previousLabel}
          </span>
        )}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`trend-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayMonth}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={axisTick} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ stroke: "#9fb4bd", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as TrendPoint;
                const rows = [{ label, value: point.value === null ? "sem dado" : format(point.value), color }];
                if (hasPrevious && point.previousDate) {
                  rows.push({
                    label: `${formatFullDate(point.previousDate)}`,
                    value: point.previous === null || point.previous === undefined ? "sem dado" : format(point.previous),
                    color: CHART_COLORS.previous,
                  });
                }
                return <TooltipShell title={formatFullDate(point.date)} rows={rows} />;
              }}
            />
            {hasPrevious && (
              <Line type="monotone" dataKey="previous" stroke={CHART_COLORS.previous} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
            )}
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#trend-${id})`} connectNulls={false} isAnimationActive={false} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* --------------------------------------------- ganhos × perdas (divergente) */

export interface GainLossPoint {
  date: string;
  gains: number | null;
  losses: number | null;
}

export function GainLossChart({ data, height = 220 }: { data: GainLossPoint[]; height?: number }) {
  const rows = data.map((point) => ({
    date: point.date,
    gains: point.gains,
    losses: point.losses === null ? null : -point.losses,
  }));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-[#4a6470]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: CHART_COLORS.blue }} aria-hidden />
          Começaram a seguir
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: CHART_COLORS.rose }} aria-hidden />
          Deixaram de seguir
        </span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={formatDayMonth} tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={(v: number) => formatInt(Math.abs(v))} tick={axisTick} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
            <ReferenceLine y={0} stroke="#9fb4bd" />
            <Tooltip
              cursor={{ fill: "rgba(46,124,176,0.06)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as { date: string; gains: number | null; losses: number | null };
                const net = point.gains === null || point.losses === null ? null : point.gains + point.losses;
                return (
                  <TooltipShell
                    title={formatFullDate(point.date)}
                    rows={[
                      { label: "Começaram a seguir", value: point.gains === null ? "sem dado" : formatInt(point.gains), color: CHART_COLORS.blue },
                      { label: "Deixaram de seguir", value: point.losses === null ? "sem dado" : formatInt(Math.abs(point.losses)), color: CHART_COLORS.rose },
                      { label: "Saldo", value: net === null ? "—" : `${net > 0 ? "+" : ""}${formatInt(net)}` },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="gains" stackId="s" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="losses" stackId="s" fill={CHART_COLORS.rose} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* --------------------------------------- linha simples (seguidores no tempo) */

export function LineSeriesChart({
  data,
  series,
  height = 220,
  format = formatInt,
  domainFromData = true,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; label: string; color: string }[];
  height?: number;
  format?: (value: number) => string;
  domainFromData?: boolean;
}) {
  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-[#4a6470]">
          {series.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: item.color }} aria-hidden />
              {item.label}
            </span>
          ))}
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={(v: string) => formatDayMonth(v)} tick={axisTick} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis
              tickFormatter={(v: number) => formatCompact(v)}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={domainFromData ? ["dataMin - 20", "dataMax + 20"] : [0, "auto"]}
            />
            <Tooltip
              cursor={{ stroke: "#9fb4bd", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as Record<string, string | number | null>;
                return (
                  <TooltipShell
                    title={formatFullDate(String(point.date))}
                    rows={series.map((item) => ({
                      label: item.label,
                      value: point[item.key] === null || point[item.key] === undefined ? "sem dado" : format(Number(point[item.key])),
                      color: item.color,
                    }))}
                  />
                );
              }}
            />
            {series.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                stroke={item.color}
                strokeWidth={2}
                fill={item.color}
                fillOpacity={series.length > 1 ? 0 : 0.08}
                connectNulls
                isAnimationActive={false}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* --------------------------------------------- barra de participação 100% */

export interface ShareSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function ShareBar({ segments, format = formatInt }: { segments: ShareSegment[]; format?: (value: number) => string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-[#eef3f5]" role="img" aria-label="Participação por categoria">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }}
              title={`${segment.label}: ${format(segment.value)}`}
            />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {segments.map((segment) => (
          <li key={segment.key} className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs text-[#4a6470]">
              <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: segment.color }} aria-hidden />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="mt-0.5 block font-mono text-sm font-semibold text-[#10232d]">
              {formatPercent((segment.value / total) * 100, 0)}
              <span className="ml-1.5 font-sans text-xs font-normal text-muted-foreground">{format(segment.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------- lista de barras horizontais */

export function BarList({
  items,
  color = CHART_COLORS.blue,
  format = formatInt,
  max,
}: {
  items: { key: string; label: React.ReactNode; value: number; hint?: string }[];
  color?: string;
  format?: (value: number) => string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.key} className="space-y-1" title={item.hint}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-[#36505c]">{item.label}</span>
            <span className="shrink-0 font-mono font-medium text-[#10232d]">{format(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-[#eef3f5]">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (item.value / top) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------- mapa de calor dia × hora */

export interface HeatCell {
  day: number;
  block: number;
  value: number;
  posts: number;
}

export function DayHourHeatmap({
  cells,
  dayLabels,
  blockLabels,
  format = (v: number) => formatPercent(v, 1),
  minPosts = 2,
}: {
  cells: HeatCell[];
  dayLabels: string[];
  blockLabels: string[];
  format?: (value: number) => string;
  minPosts?: number;
}) {
  const reliable = cells.filter((cell) => cell.posts >= minPosts);
  const max = Math.max(0, ...reliable.map((cell) => cell.value));
  const byKey = new Map(cells.map((cell) => [`${cell.day}-${cell.block}`, cell]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-10" />
            {blockLabels.map((label) => (
              <th key={label} className="font-normal text-[#6b8591]">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dayLabels.map((dayLabel, day) => (
            <tr key={dayLabel}>
              <th className="pr-1 text-left font-medium text-[#4a6470]">{dayLabel}</th>
              {blockLabels.map((blockLabel, block) => {
                const cell = byKey.get(`${day}-${block}`);
                const ok = cell && cell.posts >= minPosts && max > 0;
                const intensity = ok ? 0.15 + 0.85 * (cell.value / max) : 0;
                return (
                  <td key={blockLabel} className="p-0">
                    <div
                      className={cn(
                        "flex h-9 items-center justify-center rounded-[4px] font-mono",
                        ok ? (intensity > 0.6 ? "text-white" : "text-[#10232d]") : "text-[#a7b6bd]"
                      )}
                      style={{ background: ok ? `rgba(46,124,176,${intensity})` : "#f3f7f8" }}
                      title={
                        cell
                          ? `${dayLabel} ${blockLabel}: ${format(cell.value)} em ${cell.posts} post(s)${cell.posts < minPosts ? " (amostra pequena)" : ""}`
                          : `${dayLabel} ${blockLabel}: nenhum post`
                      }
                    >
                      {cell ? (ok ? format(cell.value) : "·") : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs text-[#6b8591]">
        <span>menor</span>
        <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg, rgba(46,124,176,0.15), rgba(46,124,176,1))" }} aria-hidden />
        <span>maior</span>
      </div>
    </div>
  );
}
