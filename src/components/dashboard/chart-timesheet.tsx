"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { Clock, TrendingUp, Award, Timer, Download } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchTimesheetForDashboard, type TimesheetRawEntry } from "@/lib/time-entries";
import { useAuth } from "@/contexts/auth-context";

function entryDurationMs(e: TimesheetRawEntry): number {
  const start = new Date(e.started_at).getTime();
  const end = e.ended_at ? new Date(e.ended_at).getTime() : Date.now();
  return Math.max(0, end - start);
}

function msToHours(ms: number): number {
  return Math.round((ms / 3_600_000) * 10) / 10;
}

function formatHours(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

interface KpiMiniCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function KpiMiniCard({ icon, label, value, sub, accent = "#101f2e" }: KpiMiniCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/50 dark:border-border/50 bg-white/70 dark:bg-card/80 backdrop-blur-sm p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${accent}14` }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground leading-none mb-1">
          {label}
        </p>
        <p className="text-xl font-bold tabular-nums text-foreground leading-none">
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "1px solid rgba(16,31,46,0.08)",
  background: "rgba(255,255,255,0.97)",
  backdropFilter: "blur(12px)",
  boxShadow: "0 8px 24px -4px rgba(0,0,0,0.12)",
  padding: "10px 14px",
  fontSize: "12px",
  color: "#101f2e",
};

function HoursTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-semibold mb-0.5">{label}</p>
      <p>{payload[0].value}h registradas</p>
    </div>
  );
}

function exportToCSV(entries: TimesheetRawEntry[]) {
  const rows = [
    ["Designer", "Solicitação", "Início", "Fim", "Duração (min)"],
    ...entries.map((e) => {
      const durationMs = e.ended_at
        ? new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()
        : Date.now() - new Date(e.started_at).getTime();
      const mins = Math.round(durationMs / 60_000);
      return [
        e.user_name ?? "Desconhecido",
        e.request_title ?? e.request_id,
        format(new Date(e.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        e.ended_at ? format(new Date(e.ended_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Em andamento",
        String(mins),
      ];
    }),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timesheet-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ChartTimesheet() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<TimesheetRawEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDesigner, setSelectedDesigner] = useState<string | null>(null);

  useEffect(() => {
    fetchTimesheetForDashboard(30).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  // For designers, only show their own data
  const filtered = useMemo(() => {
    const role = (profile?.role ?? "").toLowerCase();
    const isDesigner = role === "designer" || profile?.department === "Marketing";
    if (isDesigner && profile?.id) {
      return entries.filter((e) => e.user_id === profile.id);
    }
    return entries;
  }, [entries, profile]);

  // Aggregate by user
  const byUser = useMemo(() => {
    const map = new Map<string, { name: string; ms: number }>();
    for (const e of filtered) {
      const key = e.user_id;
      const existing = map.get(key);
      const ms = entryDurationMs(e);
      if (existing) {
        existing.ms += ms;
      } else {
        map.set(key, { name: e.user_name ?? "Desconhecido", ms });
      }
    }
    return [...map.values()]
      .sort((a, b) => b.ms - a.ms)
      .map((u) => ({ name: u.name.split(" ")[0], fullName: u.name, hours: msToHours(u.ms), ms: u.ms }));
  }, [filtered]);

  // Daily trend — last 14 days
  const dailyTrend = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = startOfDay(subDays(new Date(), 13 - i));
      return { date: d, label: format(d, "dd/MM/yyyy", { locale: ptBR }), ms: 0 };
    });
    for (const e of filtered) {
      const entryDay = startOfDay(new Date(e.started_at)).getTime();
      const bucket = days.find((d) => d.date.getTime() === entryDay);
      if (bucket) bucket.ms += entryDurationMs(e);
    }
    return days.map((d) => ({ label: d.label, hours: msToHours(d.ms) }));
  }, [filtered]);

  // When a designer is selected in the chart, show only their data in KPIs
  const activeFiltered = useMemo(() => {
    if (!selectedDesigner) return filtered;
    return filtered.filter((e) => (e.user_name ?? "Desconhecido").split(" ")[0] === selectedDesigner);
  }, [filtered, selectedDesigner]);

  // KPIs
  const totalMs = activeFiltered.reduce((sum, e) => sum + entryDurationMs(e), 0);
  const uniqueRequests = new Set(activeFiltered.map((e) => e.request_id)).size;
  const avgMs = uniqueRequests > 0 ? totalMs / uniqueRequests : 0;
  const topDesigner = byUser[0];

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/50 dark:border-border/50 bg-white/70 dark:bg-card/80 backdrop-blur-sm p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] animate-pulse">
        <div className="h-4 w-40 bg-muted/60 rounded mb-6" />
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-muted/40 rounded-2xl" />)}
        </div>
        <div className="h-48 bg-muted/30 rounded-xl" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-white/50 dark:border-border/50 bg-white/70 dark:bg-card/80 backdrop-blur-sm p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] text-center">
        <Timer className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm font-medium text-muted-foreground">Nenhum registro de tempo nos últimos 30 dias</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Inicie o cronômetro no Planner para registrar horas</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/50 dark:border-border/50 bg-white/70 dark:bg-card/80 backdrop-blur-sm p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-[#101f2e]/60" aria-hidden />
        <h3 className="text-base font-semibold text-foreground">Timesheet — Visão de Gestão</h3>
        <span className="ml-2 text-xs text-muted-foreground bg-muted/60 rounded-full px-2.5 py-0.5">
          últimos 30 dias
        </span>
        <button
          onClick={() => exportToCSV(filtered)}
          className="ml-auto flex items-center gap-1.5 text-xs font-medium text-[#101f2e]/70 hover:text-[#101f2e] bg-[#101f2e]/5 hover:bg-[#101f2e]/10 rounded-full px-3 py-1.5 transition-colors"
          title="Exportar CSV"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </button>
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiMiniCard
          icon={<Clock className="h-5 w-5" />}
          label="Total registrado"
          value={formatHours(totalMs)}
          sub={`em ${uniqueRequests} solicitaç${uniqueRequests !== 1 ? "ões" : "ão"}`}
        />
        <KpiMiniCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Média por solicitação"
          value={formatHours(avgMs)}
          sub="tempo médio investido"
          accent="#059669"
        />
        <KpiMiniCard
          icon={<Award className="h-5 w-5" />}
          label="Designer mais ativo"
          value={topDesigner ? topDesigner.name : "—"}
          sub={topDesigner ? `${topDesigner.hours}h registradas` : undefined}
          accent="#d97706"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hours per designer — horizontal bar */}
        {byUser.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Horas por designer
              </p>
              {selectedDesigner && (
                <button
                  onClick={() => setSelectedDesigner(null)}
                  className="ml-auto text-[10px] font-medium text-[#101f2e]/70 bg-[#101f2e]/8 hover:bg-[#101f2e]/15 rounded-full px-2 py-0.5 transition-colors"
                >
                  {selectedDesigner} ✕
                </button>
              )}
            </div>
            <div className="h-[200px] min-h-[200px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <BarChart
                  data={byUser}
                  layout="vertical"
                  margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
                  onClick={(data) => {
                    const payload = (data as { activePayload?: { payload?: { name?: string } }[] })?.activePayload?.[0]?.payload;
                    const name = payload?.name;
                    if (name) {
                      setSelectedDesigner((prev) => prev === name ? null : name);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid horizontal={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis
                    type="number"
                    unit="h"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip content={<HoursTooltip />} cursor={{ fill: "rgba(16,31,46,0.04)" }} />
                  <Bar
                    dataKey="hours"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                    name="Horas"
                  >
                    {byUser.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={selectedDesigner && selectedDesigner !== entry.name ? "rgba(16,31,46,0.2)" : "#101f2e"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Daily trend — area chart */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tendência diária (14 dias)
          </p>
          <div className="h-[200px] min-h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <AreaChart
                data={dailyTrend}
                margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="timesheetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#101f2e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#101f2e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  unit="h"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<HoursTooltip />} cursor={{ stroke: "rgba(16,31,46,0.15)" }} />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#101f2e"
                  strokeWidth={2}
                  fill="url(#timesheetGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#101f2e", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
