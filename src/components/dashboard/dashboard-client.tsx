"use client";

import { useMemo, useState } from "react";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { ChartByArea } from "@/components/dashboard/chart-by-area";
import { ChartByStatus } from "@/components/dashboard/chart-by-status";
import { ChartByType } from "@/components/dashboard/chart-by-type";
import { ChartTimesheet } from "@/components/dashboard/chart-timesheet";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { computeDashboardMetrics } from "@/lib/marketing-requests";
import { useAuth } from "@/contexts/auth-context";
import { fetchTimesheetForDashboard, type TimesheetRawEntry } from "@/lib/time-entries";
import { CalendarRange, Download, X } from "lucide-react";
import * as XLSX from "xlsx";

interface DashboardClientProps {
  requests: MarketingRequest[];
  assigneeAvatarUrl?: string | null;
}

type PeriodPreset =
  | "all"
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "semester"
  | "year"
  | "custom";

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}


function getEntryDurationMs(entry: TimesheetRawEntry) {
  const start = new Date(entry.started_at).getTime();
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : Date.now();
  return Math.max(0, end - start);
}

function formatDurationFromMs(ms: number) {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function getPresetRange(preset: PeriodPreset, customFrom: string, customTo: string) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  if (preset === "all") return { from: null, to: null };
  if (preset === "today") return { from: startOfToday, to: endOfToday };
  if (preset === "month") {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: endOfToday,
    };
  }
  if (preset === "semester") {
    const semesterStartMonth = today.getMonth() < 6 ? 0 : 6;
    return {
      from: new Date(today.getFullYear(), semesterStartMonth, 1),
      to: endOfToday,
    };
  }
  if (preset === "year") {
    return {
      from: new Date(today.getFullYear(), 0, 1),
      to: endOfToday,
    };
  }
  if (preset === "custom") {
    const from = parseInputDate(customFrom);
    const to = parseInputDate(customTo, true);
    return { from, to };
  }

  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const from = new Date(startOfToday);
  from.setDate(from.getDate() - (days - 1));
  return { from, to: endOfToday };
}

export function DashboardClient({ requests }: DashboardClientProps) {
  const { profile } = useAuth();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const isDesigner = useMemo(() => {
    const r = (profile?.role ?? "").toLowerCase();
    return r === "designer" || profile?.department === "Marketing";
  }, [profile]);

  const requestsFiltered = useMemo(() => {
    if (isDesigner && profile?.id) {
      return requests.filter((req) => req.assignee_id === profile.id);
    }
    return requests;
  }, [requests, isDesigner, profile?.id]);

  const periodRange = useMemo(
    () => getPresetRange(periodPreset, customFrom, customTo),
    [periodPreset, customFrom, customTo]
  );


  const normalizedRequests = useMemo(() => {
    const { from, to } = periodRange;
    if (!from && !to) return requestsFiltered;

    return requestsFiltered.filter((request) => {
      const requestedAt = new Date(request.requested_at);
      if (Number.isNaN(requestedAt.getTime())) return false;
      if (from && requestedAt < from) return false;
      if (to && requestedAt > to) return false;
      return true;
    });
  }, [requestsFiltered, periodRange]);

  const periodLabel = useMemo(() => {
    if (periodPreset === "all") return "Todo o histórico";
    if (periodPreset === "today") return "Hoje";
    if (periodPreset === "7d") return "Últimos 7 dias";
    if (periodPreset === "30d") return "Últimos 30 dias";
    if (periodPreset === "90d") return "Últimos 90 dias";
    if (periodPreset === "month") return "Mês atual";
    if (periodPreset === "semester") return "Semestre atual";
    if (periodPreset === "year") return "Ano atual";
    const from = customFrom ? customFrom.split("-").reverse().join("/") : "início";
    const to = customTo ? customTo.split("-").reverse().join("/") : "hoje";
    return `${from} até ${to}`;
  }, [periodPreset, customFrom, customTo]);

  const timesheetDateRange = useMemo(() => {
    if (periodPreset === "all") return undefined;
    return {
      from: periodRange.from,
      to: periodRange.to,
      label: periodLabel,
    };
  }, [periodPreset, periodRange, periodLabel]);

  const handlePresetChange = (value: string) => {
    const preset = value as PeriodPreset;
    setPeriodPreset(preset);
    if (preset === "custom" && !customFrom && !customTo) {
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setCustomFrom(formatInputDate(from));
      setCustomTo(formatInputDate(today));
    }
  };

  const clearPeriod = () => {
    setPeriodPreset("all");
    setCustomFrom("");
    setCustomTo("");
  };

  const dashboardMetrics = useMemo(
    () => computeDashboardMetrics(normalizedRequests),
    [normalizedRequests]
  );

  const exportMonthData = useMemo(() => {
    const counts = normalizedRequests.reduce<Record<string, number>>((acc, r) => {
      const d = new Date(r.requested_at);
      if (Number.isNaN(d.getTime())) return acc;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const sorted = Object.keys(counts).sort();
    const topKey = sorted.reduce(
      (best, key) => (counts[key] > (counts[best] ?? 0) ? key : best),
      sorted[0] ?? ""
    );
    return { counts, sorted, topKey };
  }, [normalizedRequests]);

  const handleExportToExcel = async () => {
    if (normalizedRequests.length === 0) return;

    setIsExporting(true);
    try {
      const fetchRange = periodRange.from && periodRange.to
        ? { from: periodRange.from, to: periodRange.to }
        : undefined;
      const timesheetEntries = await fetchTimesheetForDashboard(3650, fetchRange);
      const visibleTimesheetEntries = isDesigner && profile?.id
        ? timesheetEntries.filter((entry) => entry.user_id === profile.id)
        : timesheetEntries;

      const requestIdsSet = new Set(normalizedRequests.map((r) => r.id));
      const linkedEntries = visibleTimesheetEntries.filter((entry) => requestIdsSet.has(entry.request_id));

      const timeByRequest = linkedEntries.reduce<Record<string, { ms: number; entries: number }>>(
        (acc, entry) => {
          const prev = acc[entry.request_id] ?? { ms: 0, entries: 0 };
          prev.ms += getEntryDurationMs(entry);
          prev.entries += 1;
          acc[entry.request_id] = prev;
          return acc;
        },
        {}
      );

      const { completedCount, dataByArea, dataByType } = dashboardMetrics;
      const { counts: monthCounts, sorted: monthsSorted, topKey: topMonthKey } = exportMonthData;

      const totalTimesheetMs = linkedEntries.reduce((acc, e) => acc + getEntryDurationMs(e), 0);
      const reviewCount = normalizedRequests.filter(
        (r) => r.workflow_stage === "revisao" || r.workflow_stage === "revisao_autor"
      ).length;
      const uniqueAreas = new Set(normalizedRequests.map((r) => r.requesting_area).filter(Boolean)).size;
      const avgPerMonth = monthsSorted.length > 0
        ? Number((normalizedRequests.length / monthsSorted.length).toFixed(1))
        : 0;

      const topAreaEntry = dataByArea[0];
      const top3Areas = dataByArea.slice(0, 3).map((a) => `${a.area} (${a.total})`).join(", ");
      const topTypeEntry = dataByType[0];
      const topMonthLabel = topMonthKey
        ? new Date(`${topMonthKey}-01`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        : "";
      const topMonthPct = topMonthKey && normalizedRequests.length > 0
        ? Number(((monthCounts[topMonthKey] / normalizedRequests.length) * 100).toFixed(1))
        : 0;

      const dashboardRows = [
        { Secao: "Cards superiores", Indicador: "Demandas Recebidas", Valor: normalizedRequests.length },
        { Secao: "Cards superiores", Indicador: "Demandas Concluídas", Valor: completedCount },
        { Secao: "Cards superiores", Indicador: "Demandas em Revisão", Valor: reviewCount },
        { Secao: "Cards superiores", Indicador: "Tempo Aplicado em Atividades (horas)", Valor: Number((totalTimesheetMs / 3_600_000).toFixed(2)) },
        { Secao: "Cards superiores", Indicador: "Demandas Médias por Mês", Valor: avgPerMonth },
        { Secao: "Cards superiores", Indicador: "Áreas Atendidas", Valor: uniqueAreas },
        { Secao: "", Indicador: "", Valor: "" },
        { Secao: "Insights automáticos", Indicador: "Área com maior volume", Valor: topAreaEntry ? `${topAreaEntry.area} (${topAreaEntry.total})` : "" },
        { Secao: "Insights automáticos", Indicador: "Top 3 áreas", Valor: top3Areas },
        { Secao: "Insights automáticos", Indicador: "Tipo de entrega mais solicitado", Valor: topTypeEntry ? `${topTypeEntry.name} (${topTypeEntry.value})` : "" },
        { Secao: "Insights automáticos", Indicador: "Quantidade de tipos diferentes", Valor: dataByType.length },
        { Secao: "Insights automáticos", Indicador: "Mês com maior volume", Valor: topMonthLabel },
        { Secao: "Insights automáticos", Indicador: "Percentual do mês sobre o período total", Valor: topMonthPct > 0 ? `${topMonthPct}%` : "" },
        { Secao: "", Indicador: "", Valor: "" },
        { Secao: "Dados auxiliares", Indicador: "Total do período analisado", Valor: normalizedRequests.length },
        { Secao: "Dados auxiliares", Indicador: "Data inicial do filtro", Valor: periodRange.from ? periodRange.from.toLocaleDateString("pt-BR") : "Início do histórico" },
        { Secao: "Dados auxiliares", Indicador: "Data final do filtro", Valor: periodRange.to ? periodRange.to.toLocaleDateString("pt-BR") : "Hoje" },
        { Secao: "Dados auxiliares", Indicador: "Quantidade de meses considerados", Valor: monthsSorted.length },
      ];

      const areaRows = dataByArea.map((a) => ({
        Área: a.area,
        "Quantidade de Demandas": a.total,
        "Percentual (%)": normalizedRequests.length > 0
          ? Number(((a.total / normalizedRequests.length) * 100).toFixed(1))
          : 0,
      }));

      const tipoRows = dataByType.map((t) => ({
        "Tipo de Entrega": t.name,
        "Quantidade": t.value,
      }));

      const evolucaoRows = monthsSorted.map((key) => ({
        Mês: new Date(`${key}-01`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        "Quantidade de Demandas": monthCounts[key],
      }));

      const solicitacoesRows = normalizedRequests.map((request) => {
        const totals = timeByRequest[request.id] ?? { ms: 0, entries: 0 };
        return {
          ID: request.id,
          Titulo: request.title,
          Área: request.requesting_area,
          Status: request.status,
          Etapa: request.workflow_stage ?? "",
          Tipo: request.request_type ?? "",
          Prioridade: request.priority,
          Solicitante: request.solicitante ?? "",
          Responsável: request.assignee ?? "",
          "Solicitado em": request.requested_at
            ? new Date(request.requested_at).toLocaleDateString("pt-BR")
            : "",
          Prazo: request.deadline ? new Date(request.deadline).toLocaleDateString("pt-BR") : "",
          "Entregue em": request.delivered_at
            ? new Date(request.delivered_at).toLocaleDateString("pt-BR")
            : "",
          "Tipo de conclusão": request.completion_type ?? "",
          "Tempo total (h)": Number((totals.ms / 3_600_000).toFixed(2)),
          "Tempo total (formatado)": formatDurationFromMs(totals.ms),
          "Registros de timesheet": totals.entries,
          Link: request.link ?? "",
          "Link da arte": request.art_link ?? "",
        };
      });

      const timesheetRows = linkedEntries.map((entry) => {
        const durationMs = getEntryDurationMs(entry);
        return {
          "Solicitação ID": entry.request_id,
          Solicitação: entry.request_title ?? "",
          Designer: entry.user_name ?? "Desconhecido",
          Início: new Date(entry.started_at).toLocaleString("pt-BR"),
          Fim: entry.ended_at ? new Date(entry.ended_at).toLocaleString("pt-BR") : "Em andamento",
          "Duração (h)": Number((durationMs / 3_600_000).toFixed(2)),
          "Duração (formatada)": formatDurationFromMs(durationMs),
        };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dashboardRows), "Dashboard");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaRows), "Por Area");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tipoRows), "Por Tipo");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evolucaoRows), "Evolucao Mensal");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(solicitacoesRows), "Solicitacoes");
      if (timesheetRows.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(timesheetRows), "Timesheet");
      }

      const fromLabel = periodRange.from
        ? periodRange.from.toLocaleDateString("pt-BR").replace(/\//g, "-")
        : "inicio";
      const toLabel = periodRange.to
        ? periodRange.to.toLocaleDateString("pt-BR").replace(/\//g, "-")
        : "hoje";
      XLSX.writeFile(wb, `dashboard-${fromLabel}-a-${toLabel}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const {
    total,
    totalThisMonth,
    avgDeliveryDays,
    completedCount,
    overdueCount,
    unassignedCount,
    dataByArea,
    dataByStatus,
    dataByType,
  } = dashboardMetrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das solicitações e eficiência da equipe
          </p>
        </div>

        <div className="rounded-lg border border-[#dce9eb] bg-white p-3 shadow-[0_1px_2px_rgba(3,32,47,0.04),0_10px_30px_-26px_rgba(62,132,168,0.5)] dark:border-border/50 dark:bg-card/80">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                Período
              </span>
              <Select value={periodPreset} onValueChange={handlePresetChange}>
                <SelectTrigger className="h-9 w-full min-w-[180px] bg-white/80 dark:bg-input/30">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">Todo o histórico</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="semester">Semestre atual</SelectItem>
                  <SelectItem value="year">Ano atual</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodPreset === "custom" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    De
                  </span>
                  <DatePickerField
                    value={customFrom}
                    onChange={setCustomFrom}
                    placeholder="Data inicial"
                    className="w-full sm:w-[140px] bg-white/80 dark:bg-input/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Até
                  </span>
                  <DatePickerField
                    value={customTo}
                    onChange={setCustomTo}
                    placeholder="Data final"
                    className="w-full sm:w-[140px] bg-white/80 dark:bg-input/30"
                  />
                </div>
              </div>
            )}

            {periodPreset !== "all" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearPeriod}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Limpar
              </Button>
            )}

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Exportar período
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 whitespace-nowrap"
                onClick={handleExportToExcel}
                disabled={normalizedRequests.length === 0 || isExporting}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {isExporting ? "Gerando..." : "Baixar Excel"}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Exibindo {normalizedRequests.length} de {requestsFiltered.length} solicitações: {periodLabel}
          </p>
        </div>
      </div>

      <KpiCards
        total={total}
        totalThisMonth={totalThisMonth}
        avgDeliveryDays={avgDeliveryDays}
        completedCount={completedCount}
        overdueCount={overdueCount}
        unassignedCount={unassignedCount}
        isPeriodFiltered={periodPreset !== "all"}
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <ChartByArea data={dataByArea} />
        </div>
        <div className="min-w-0">
          <ChartByStatus data={dataByStatus} />
        </div>
      </div>

      <div className="min-w-0">
        <ChartByType data={dataByType} />
      </div>

      <div className="min-w-0">
        <ChartTimesheet dateRange={timesheetDateRange} />
      </div>
    </div>
  );
}
