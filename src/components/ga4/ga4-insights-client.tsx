"use client";

/**
 * Métricas do Site (Google Analytics 4) no padrão das telas de Métricas:
 * período da URL compartilhado entre as abas, comparação, indicadores com
 * variação e blocos de aquisição, conteúdo e público. Só lê o banco; a coleta
 * no GA4 é do cron diário ou do botão "Atualizar agora".
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Percent,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FreshnessBadge, KpiTile, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { CHART_COLORS, TrendChart } from "@/components/social-metrics/metrics-charts";
import { MetricsPeriodBar, useMetricsPeriod } from "@/components/social-metrics/metrics-period-bar";
import {
  Ga4ChannelsSection,
  Ga4CitiesSection,
  Ga4DevicesSection,
  Ga4FunnelSection,
  Ga4LandingSection,
  Ga4SocialSection,
  Ga4TopPagesSection,
} from "@/components/ga4/ga4-sections";
import { Ga4PageDialog } from "@/components/ga4/ga4-page-dialog";
import { formatCompact, formatInt, formatPercent } from "@/lib/social-metrics/format";
import { formatFullDate } from "@/lib/social-metrics/period";
import type { SourceFreshness } from "@/lib/social-metrics/freshness";
import {
  formatGa4Duration,
  ga4DailySeries,
  ga4PageTitles,
  ga4SuspectTraffic,
  summarizeGa4Period,
  type Ga4DailyMetricKey,
} from "@/lib/ga4-analytics";
import type { Ga4DashboardData } from "@/lib/ga4-server";

/** Linhas do GA4 já recortadas pelo período (e o de comparação) no servidor. */
export type Ga4ScreenData = Omit<Ga4DashboardData, "lastImport" | "unavailableReason">;

interface MetricConfig {
  label: string;
  /** Nome da linha no gráfico (com a unidade do eixo quando não é contagem). */
  chartLabel: string;
  icon: LucideIcon;
  color: string;
  format: (value: number | null) => string;
}

const METRICS: Record<Ga4DailyMetricKey, MetricConfig> = {
  sessions: { label: "Sessões", chartLabel: "Sessões", icon: MousePointerClick, color: CHART_COLORS.blue, format: formatCompact },
  activeUsers: { label: "Usuários", chartLabel: "Usuários", icon: Users, color: CHART_COLORS.purple, format: formatCompact },
  conversions: { label: "Leads", chartLabel: "Leads", icon: Target, color: CHART_COLORS.teal, format: formatInt },
  whatsappClicks: { label: "Cliques no WhatsApp", chartLabel: "Cliques no WhatsApp", icon: MessageCircle, color: CHART_COLORS.ochre, format: formatInt },
  engagementRate: {
    label: "Taxa de engajamento",
    chartLabel: "Taxa de engajamento, em %",
    icon: Percent,
    color: CHART_COLORS.blue,
    format: (value) => formatPercent(value, 1),
  },
  engagementSecondsPerUser: {
    label: "Tempo médio por usuário",
    chartLabel: "Tempo médio por usuário, em segundos",
    icon: Clock,
    color: CHART_COLORS.purple,
    format: formatGa4Duration,
  },
};

const METRIC_ORDER: Ga4DailyMetricKey[] = ["sessions", "activeUsers", "conversions", "whatsappClicks", "engagementRate", "engagementSecondsPerUser"];

export function Ga4InsightsClient({ data, freshness }: { data: Ga4ScreenData; freshness: SourceFreshness | null }) {
  const router = useRouter();
  const { state, period, setState } = useMetricsPeriod();
  const [chartMetric, setChartMetric] = React.useState<Ga4DailyMetricKey>("sessions");
  const [openPath, setOpenPath] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const { from, to, compareFrom, compareTo, compareLabel } = period;
  const daily = data.dailyMetrics;

  const totals = React.useMemo(() => summarizeGa4Period(daily, from, to), [daily, from, to]);
  const previousTotals = React.useMemo(() => summarizeGa4Period(daily, compareFrom, compareTo), [daily, compareFrom, compareTo]);
  const suspect = React.useMemo(() => ga4SuspectTraffic(data.locationMetrics, daily, from, to), [data.locationMetrics, daily, from, to]);
  const titles = React.useMemo(() => ga4PageTitles(data.pageMetrics), [data.pageMetrics]);

  const sparks = React.useMemo(() => {
    const out = {} as Record<Ga4DailyMetricKey, (number | null)[]>;
    for (const key of METRIC_ORDER) out[key] = ga4DailySeries(daily, key, from, to).map((point) => point.value);
    return out;
  }, [daily, from, to]);

  const trend = React.useMemo(() => {
    const now = ga4DailySeries(daily, chartMetric, from, to);
    const before = ga4DailySeries(daily, chartMetric, compareFrom, compareTo);
    return now.map((point, index) => ({
      date: point.date,
      value: point.value,
      previous: before[index]?.value ?? null,
      previousDate: before[index]?.date,
    }));
  }, [daily, chartMetric, from, to, compareFrom, compareTo]);

  const handleSync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/ga4-insights/sync", { method: "POST", credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { error?: string; dateFrom?: string; dateTo?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível atualizar os dados do site.");
      setNotice({
        tone: "ok",
        text:
          json.dateFrom && json.dateTo
            ? `Site atualizado: ${formatFullDate(json.dateFrom)} a ${formatFullDate(json.dateTo)} recarregados do Google Analytics.`
            : "Site atualizado com o Google Analytics.",
      });
      router.refresh();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Não foi possível atualizar os dados do site." });
    } finally {
      setSyncing(false);
    }
  };

  const sessionsNote =
    suspect.share !== null && suspect.share >= 10
      ? `Ao menos ${formatPercent(suspect.share, 0)} das sessões vêm de locais típicos de robô (veja “Onde está o público”).`
      : undefined;
  const leadRate = totals.sessions && totals.conversions !== null ? (totals.conversions / totals.sessions) * 100 : null;

  const tiles: { key: Ga4DailyMetricKey; current: number | null; previous: number | null; sub?: React.ReactNode; note?: string; hint: string }[] = [
    {
      key: "sessions",
      current: totals.sessions,
      previous: previousTotals.sessions,
      sub: totals.screenPageViews !== null ? `${formatCompact(totals.screenPageViews)} páginas vistas` : undefined,
      note: sessionsNote,
      hint: "Visitas ao site. A visita termina depois de 30 min sem atividade.",
    },
    {
      key: "activeUsers",
      current: totals.activeUsers,
      previous: previousTotals.activeUsers,
      sub: totals.newUsers !== null ? `${formatCompact(totals.newUsers)} visitaram pela primeira vez` : undefined,
      hint: "Soma dos usuários ativos de cada dia: quem volta em outro dia conta de novo, por isso passa do total de pessoas únicas do GA4.",
    },
    {
      key: "conversions",
      current: totals.conversions,
      previous: previousTotals.conversions,
      sub: leadRate !== null ? `${formatPercent(leadRate, 1)} das sessões` : undefined,
      hint: "Eventos-chave do GA4: formulário enviado no site e conversão do anúncio (Google Ads).",
    },
    {
      key: "whatsappClicks",
      current: totals.whatsappClicks,
      previous: previousTotals.whatsappClicks,
      hint: "Cliques em links para o WhatsApp (wa.me) dentro do site.",
    },
    {
      key: "engagementRate",
      current: totals.engagementRate,
      previous: previousTotals.engagementRate,
      sub: totals.engagedSessions !== null ? `${formatCompact(totals.engagedSessions)} sessões engajadas` : undefined,
      hint: "Sessões engajadas ÷ sessões. Engajada é a visita que passou de 10 s, viu 2 páginas ou mais, ou gerou um evento-chave.",
    },
    {
      key: "engagementSecondsPerUser",
      current: totals.engagementSecondsPerUser,
      previous: previousTotals.engagementSecondsPerUser,
      hint: "Tempo médio de engajamento: tempo com o site aberto em primeiro plano ÷ usuários ativos (soma dos dias).",
    },
  ];

  const metric = METRICS[chartMetric];

  return (
    <div className="flex min-h-0 w-full flex-col gap-5">
      <MetricsPeriodBar
        state={state}
        period={period}
        onChange={setState}
        right={
          <>
            {freshness && <FreshnessBadge freshness={freshness} />}
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              {syncing ? "Atualizando…" : "Atualizar agora"}
            </Button>
          </>
        }
      />

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
            notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-medium underline-offset-2 hover:underline">
            Fechar
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => {
          const config = METRICS[tile.key];
          return (
            <KpiTile
              key={tile.key}
              label={config.label}
              icon={config.icon}
              value={config.format(tile.current)}
              current={tile.current}
              previous={tile.previous}
              previousText={config.format(tile.previous)}
              compareLabel={compareLabel}
              spark={sparks[tile.key]}
              selected={chartMetric === tile.key}
              onSelect={() => setChartMetric(tile.key)}
              sub={tile.sub}
              note={tile.note}
              hint={tile.hint}
            />
          );
        })}
      </div>

      <MetricsSection
        title={`${metric.label} dia a dia`}
        description="Clique em um indicador acima para trocar a linha. Tracejado: período de comparação."
        icon={Sparkles}
      >
        {trend.some((point) => point.value !== null) ? (
          <TrendChart
            data={trend}
            label={`${metric.chartLabel} (${period.label.split("·").pop()?.trim()})`}
            previousLabel={compareLabel}
            color={metric.color}
            format={(value) => metric.format(value)}
          />
        ) : (
          <MetricsEmpty
            icon={MousePointerClick}
            title="Sem dados do site neste período"
            description={
              freshness?.dataUntil
                ? `O banco tem dados do Google Analytics até ${formatFullDate(freshness.dataUntil)}.`
                : "O Google Analytics ainda não mandou dados para as datas escolhidas."
            }
          />
        )}
      </MetricsSection>

      <div className="grid gap-5 lg:grid-cols-5">
        <Ga4ChannelsSection className="lg:col-span-3" period={period} channelRows={data.channelMetrics} />
        <Ga4SocialSection className="lg:col-span-2" period={period} channelRows={data.channelMetrics} dailyRows={daily} />
      </div>

      <Ga4FunnelSection period={period} totals={totals} previousTotals={previousTotals} keyEventRows={data.keyEventMetrics} />

      <div className="grid gap-5 xl:grid-cols-2">
        <Ga4LandingSection period={period} landingRows={data.landingPageMetrics} titles={titles} onOpenPage={setOpenPath} />
        <Ga4TopPagesSection period={period} pageRows={data.pageMetrics} titles={titles} onOpenPage={setOpenPath} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Ga4CitiesSection className="lg:col-span-3" period={period} locationRows={data.locationMetrics} dailyRows={daily} />
        <Ga4DevicesSection className="lg:col-span-2 lg:self-start" period={period} deviceRows={data.deviceMetrics} />
      </div>

      <Ga4PageDialog
        path={openPath}
        title={openPath ? titles.get(openPath) ?? null : null}
        onOpenChange={(open) => !open && setOpenPath(null)}
        period={period}
        pageRows={data.pageMetrics}
        landingRows={data.landingPageMetrics}
        dailyRows={daily}
      />
    </div>
  );
}
