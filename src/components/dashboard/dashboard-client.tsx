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
  | "quarter"
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

function getQuarterFromMonth(month: number) {
  return Math.floor(month / 3) + 1;
}

function getQuarterKey(date: Date) {
  return `${date.getFullYear()}-Q${getQuarterFromMonth(date.getMonth())}`;
}

function getQuarterLabel(quarterKey: string) {
  const [year, quarter] = quarterKey.split("-");
  return `${quarter} ${year}`;
}

function parseQuarterKey(quarterKey: string) {
  const [yearPart, quarterPart] = quarterKey.split("-Q");
  const year = Number(yearPart);
  const quarter = Number(quarterPart);
  if (!year || !quarter || quarter < 1 || quarter > 4) return null;
  return { year, quarter };
}

function getQuarterDateRange(quarterKey: string) {
  const parsed = parseQuarterKey(quarterKey);
  if (!parsed) return null;
  const startMonth = (parsed.quarter - 1) * 3;
  const from = new Date(parsed.year, startMonth, 1, 0, 0, 0, 0);
  const to = new Date(parsed.year, startMonth + 3, 0, 23, 59, 59, 999);
  return { from, to };
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
  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return {
      from: new Date(today.getFullYear(), quarterStartMonth, 1),
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
  const [exportQuarter, setExportQuarter] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const requestsFiltered = useMemo(() => {
    const r = (profile?.role ?? "").toLowerCase();
    const isDesigner = r === "designer" || profile?.department === "Marketing";
    if (isDesigner && profile?.id) {
      return requests.filter((req) => req.assignee_id === profile.id);
    }
    return requests;
  }, [requests, profile]);

  const periodRange = useMemo(
    () => getPresetRange(periodPreset, customFrom, customTo),
    [periodPreset, customFrom, customTo]
  );

  const availableQuarters = useMemo(() => {
    const keys = Array.from(
      new Set(
        requestsFiltered
          .map((request) => new Date(request.requested_at))
          .filter((date) => !Number.isNaN(date.getTime()))
          .map((date) => getQuarterKey(date))
      )
    );

    return keys.sort((a, b) => (a > b ? -1 : 1));
  }, [requestsFiltered]);

  const selectedExportQuarter = useMemo(() => {
    if (exportQuarter && availableQuarters.includes(exportQuarter)) return exportQuarter;
    const currentQuarter = getQuarterKey(new Date());
    if (availableQuarters.includes(currentQuarter)) return currentQuarter;
    return availableQuarters[0] ?? "";
  }, [availableQuarters, exportQuarter]);

  const exportQuarterRequests = useMemo(() => {
    if (!selectedExportQuarter) return [];
    return requestsFiltered.filter((request) => {
      const requestedAt = new Date(request.requested_at);
      if (Number.isNaN(requestedAt.getTime())) return false;
      return getQuarterKey(requestedAt) === selectedExportQuarter;
    });
  }, [requestsFiltered, selectedExportQuarter]);

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
    if (periodPreset === "quarter") return "Trimestre atual";
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

  const handleExportQuarterToExcel = async () => {
    if (!selectedExportQuarter || exportQuarterRequests.length === 0) return;

    const quarterRange = getQuarterDateRange(selectedExportQuarter);
    if (!quarterRange) return;

    setIsExporting(true);
    try {
      const timesheetEntries = await fetchTimesheetForDashboard(120, quarterRange);
      const role = (profile?.role ?? "").toLowerCase();
      const isDesigner = role === "designer" || profile?.department === "Marketing";
      const visibleTimesheetEntries = isDesigner && profile?.id
        ? timesheetEntries.filter((entry) => entry.user_id === profile.id)
        : timesheetEntries;

      const requestIdsSet = new Set(exportQuarterRequests.map((request) => request.id));
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

      const rows = exportQuarterRequests.map((request) => {
        const totals = timeByRequest[request.id] ?? { ms: 0, entries: 0 };
        return {
          ID: request.id,
          Titulo: request.title,
          Area: request.requesting_area,
          Status: request.status,
          Etapa: request.workflow_stage ?? "",
          Tipo: request.request_type ?? "",
          Prioridade: request.priority,
          Solicitante: request.solicitante ?? "",
          Responsavel: request.assignee ?? "",
          "Solicitado em": request.requested_at
            ? new Date(request.requested_at).toLocaleDateString("pt-BR")
            : "",
          Prazo: request.deadline ? new Date(request.deadline).toLocaleDateString("pt-BR") : "",
          "Entregue em": request.delivered_at
            ? new Date(request.delivered_at).toLocaleDateString("pt-BR")
            : "",
          "Tipo de conclusao": request.completion_type ?? "",
          "Tempo total (h)": Number((totals.ms / 3_600_000).toFixed(2)),
          "Tempo total (formatado)": formatDurationFromMs(totals.ms),
          "Registros de timesheet": totals.entries,
          Link: request.link ?? "",
          "Link da arte": request.art_link ?? "",
        };
      });

      const timesheetRows = linkedEntries.map((entry) => ({
        "Solicitacao ID": entry.request_id,
        Solicitacao: entry.request_title ?? "",
        Designer: entry.user_name ?? "Desconhecido",
        "Inicio": new Date(entry.started_at).toLocaleString("pt-BR"),
        "Fim": entry.ended_at ? new Date(entry.ended_at).toLocaleString("pt-BR") : "Em andamento",
        "Duracao (h)": Number((getEntryDurationMs(entry) / 3_600_000).toFixed(2)),
        "Duracao (formatada)": formatDurationFromMs(getEntryDurationMs(entry)),
      }));

      const wb = XLSX.utils.book_new();
      const dashboardWs = XLSX.utils.json_to_sheet(rows);
      const timesheetWs = XLSX.utils.json_to_sheet(timesheetRows);
      XLSX.utils.book_append_sheet(wb, dashboardWs, "Solicitacoes");
      XLSX.utils.book_append_sheet(wb, timesheetWs, "Timesheet");
      const filename = `dashboard-${selectedExportQuarter.toLowerCase()}.xlsx`;
      XLSX.writeFile(wb, filename);
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
  } = computeDashboardMetrics(normalizedRequests);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das solicitações e eficiência da equipe
          </p>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/70 p-3 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)] backdrop-blur-sm dark:border-border/50 dark:bg-card/80">
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
                  <SelectItem value="quarter">Trimestre atual</SelectItem>
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
                Exportar trimestre
              </span>
              <div className="flex gap-2">
                <Select value={selectedExportQuarter} onValueChange={setExportQuarter}>
                  <SelectTrigger className="h-9 w-full min-w-[150px] bg-white/80 dark:bg-input/30">
                    <SelectValue placeholder="Selecione o trimestre" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {availableQuarters.map((quarter) => (
                      <SelectItem key={quarter} value={quarter}>
                        {getQuarterLabel(quarter)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 whitespace-nowrap"
                  onClick={handleExportQuarterToExcel}
                  disabled={!selectedExportQuarter || exportQuarterRequests.length === 0 || isExporting}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  {isExporting ? "Gerando..." : "Excel"}
                </Button>
              </div>
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
