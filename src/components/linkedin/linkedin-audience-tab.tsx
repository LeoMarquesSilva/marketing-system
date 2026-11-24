"use client";

import * as React from "react";
import {
  BriefcaseBusiness,
  Building2,
  Eye,
  Factory,
  GraduationCap,
  MapPin,
  MonitorSmartphone,
  Repeat,
  UserPlus,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { FilterChip, KpiTile, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { BarList, CHART_COLORS, ShareBar, TrendChart } from "@/components/social-metrics/metrics-charts";
import { coverageNote, useLinkedinSeries } from "@/components/linkedin/linkedin-overview-tab";
import type { LinkedinPeriodTotals } from "@/lib/linkedin-analytics";
import { formatCompact, formatInt, formatPercent } from "@/lib/social-metrics/format";
import { formatFullDate, type ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import type { LinkedinDashboardData, LinkedinDemographicDimension } from "@/lib/linkedin-types";

type AudienceSource = "followers" | "visitors";

const DIMENSIONS: { key: LinkedinDemographicDimension; label: string; icon: LucideIcon; color: string }[] = [
  { key: "industry", label: "Setor", icon: Factory, color: CHART_COLORS.blue },
  { key: "function", label: "Função", icon: BriefcaseBusiness, color: CHART_COLORS.teal },
  { key: "seniority", label: "Senioridade", icon: GraduationCap, color: CHART_COLORS.purple },
  { key: "company_size", label: "Porte da empresa", icon: Building2, color: CHART_COLORS.ochre },
  { key: "location", label: "Localidade", icon: MapPin, color: CHART_COLORS.blue },
];

const TOP = 8;

function formatRatio(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function LinkedinAudienceTab({
  period,
  data,
  current,
  previous,
}: {
  period: ResolvedMetricsPeriod;
  data: LinkedinDashboardData;
  current: LinkedinPeriodTotals;
  previous: LinkedinPeriodTotals;
}) {
  const [source, setSource] = React.useState<AudienceSource>("followers");
  const series = useLinkedinSeries(data, period);
  const compareLabel = period.compareLabel;
  const shortLabel = period.label.split("·").pop()?.trim();

  const trendOf = (metric: "newFollowers" | "pageViews") => {
    const now = series(metric);
    const before = series(metric, "anterior");
    return now.map((point, index) => ({ date: point.date, value: point.value, previous: before[index]?.value ?? null, previousDate: before[index]?.date }));
  };
  const followersTrend = trendOf("newFollowers");
  const viewsTrend = trendOf("pageViews");
  const uniqueSeries = React.useMemo(() => {
    const byDate = new Map(data.visitorDailyMetrics.map((row) => [row.metric_date.slice(0, 10), row.total_unique_total]));
    return series("pageViews").map((point) => byDate.get(point.date) ?? null);
  }, [data.visitorDailyMetrics, series]);

  const demographics = data.demographics.filter((row) => row.report_type === source);
  const capturedAt = demographics[0]?.captured_at ?? null;
  const followersNote = coverageNote(current.followerDays, period.days, "seguidores");
  const visitorsNote = coverageNote(current.visitorDays, period.days, "visitantes");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Novos seguidores"
          icon={UserPlus}
          value={formatInt(current.newFollowers)}
          current={current.newFollowers}
          previous={previous.newFollowers}
          previousText={formatInt(previous.newFollowers)}
          compareLabel={compareLabel}
          spark={followersTrend.map((point) => point.value)}
          note={followersNote}
          hint="Quem começou a seguir a página no período. O LinkedIn não informa quem deixou de seguir."
        />
        <KpiTile
          label="Visitas à página"
          icon={Eye}
          value={formatCompact(current.pageViews)}
          current={current.pageViews}
          previous={previous.pageViews}
          previousText={formatCompact(previous.pageViews)}
          compareLabel={compareLabel}
          spark={viewsTrend.map((point) => point.value)}
          note={visitorsNote}
          hint="Visualizações da página da empresa no período."
        />
        <KpiTile
          label="Visitantes únicos"
          icon={UsersRound}
          value={formatCompact(current.uniqueVisitors)}
          current={current.uniqueVisitors}
          previous={previous.uniqueVisitors}
          previousText={formatCompact(previous.uniqueVisitors)}
          compareLabel={compareLabel}
          spark={uniqueSeries}
          note={visitorsNote}
          hint="Soma dos visitantes únicos de cada dia: quem volta em dias diferentes conta de novo."
        />
        <KpiTile
          label="Visitas por visitante"
          icon={Repeat}
          value={formatRatio(current.viewsPerVisitor)}
          current={current.viewsPerVisitor}
          previous={previous.viewsPerVisitor}
          previousText={formatRatio(previous.viewsPerVisitor)}
          compareLabel={compareLabel}
          note={visitorsNote}
          hint="Visualizações ÷ visitantes únicos: quantas telas da página cada visitante abre."
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <MetricsSection title="Novos seguidores dia a dia" icon={UserPlus} description="Tracejado: período de comparação.">
          {followersTrend.some((point) => point.value !== null) ? (
            <TrendChart data={followersTrend} label={`Novos seguidores (${shortLabel})`} previousLabel={compareLabel} color={CHART_COLORS.purple} height={220} />
          ) : (
            <MetricsEmpty icon={UserPlus} title="Sem a planilha de seguidores neste período" />
          )}
        </MetricsSection>
        <MetricsSection title="Visitas à página dia a dia" icon={Eye} description="Tracejado: período de comparação.">
          {viewsTrend.some((point) => point.value !== null) ? (
            <TrendChart data={viewsTrend} label={`Visitas (${shortLabel})`} previousLabel={compareLabel} color={CHART_COLORS.ochre} height={220} />
          ) : (
            <MetricsEmpty icon={Eye} title="Sem a planilha de visitantes neste período" />
          )}
        </MetricsSection>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <MetricsSection title="Como chegam os seguidores" icon={UserPlus} description="Origem dos novos seguidores do período.">
          {(current.newFollowers ?? 0) > 0 ? (
            <ShareBar
              segments={[
                { key: "organico", label: "Orgânico", value: current.organicFollowers ?? 0, color: CHART_COLORS.blue },
                { key: "patrocinado", label: "Patrocinado", value: current.sponsoredFollowers ?? 0, color: CHART_COLORS.ochre },
                { key: "convite", label: "Convite da página", value: current.autoInvitedFollowers ?? 0, color: CHART_COLORS.purple },
              ]}
            />
          ) : (
            <MetricsEmpty icon={UserPlus} title="Nenhum novo seguidor registrado no período" />
          )}
        </MetricsSection>

        <MetricsSection title="Como visitam a página" icon={MonitorSmartphone} description="Aparelho e parte da página nas visitas do período.">
          {(current.pageViews ?? 0) > 0 ? (
            <div className="space-y-5">
              <ShareBar
                segments={[
                  { key: "celular", label: "Celular", value: current.mobileViews ?? 0, color: CHART_COLORS.blue },
                  { key: "computador", label: "Computador", value: current.desktopViews ?? 0, color: CHART_COLORS.teal },
                ]}
                format={formatCompact}
              />
              <div className="border-t border-[#edf3f5] pt-4">
                <p className="mb-3 text-xs font-semibold text-[#4a6470]">Parte da página</p>
                <ShareBar
                  segments={[
                    { key: "visao", label: "Página inicial", value: current.overviewViews ?? 0, color: CHART_COLORS.blue },
                    { key: "vida", label: "Vida na empresa", value: current.lifeViews ?? 0, color: CHART_COLORS.ochre },
                    { key: "vagas", label: "Vagas", value: current.jobsViews ?? 0, color: CHART_COLORS.purple },
                  ]}
                  format={formatCompact}
                />
              </div>
            </div>
          ) : (
            <MetricsEmpty icon={MonitorSmartphone} title="Sem visitas registradas no período" />
          )}
        </MetricsSection>
      </div>

      <MetricsSection
        title="Perfil do público"
        icon={UserRound}
        description={
          capturedAt
            ? `Retrato da planilha importada em ${formatFullDate(capturedAt)}; não depende do período escolhido. ${source === "followers" ? "Números = seguidores em cada grupo." : "Números = visualizações da página por grupo."}`
            : "Retrato da última planilha de seguidores e de visitantes; não depende do período escolhido."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <FilterChip selected={source === "followers"} onClick={() => setSource("followers")} icon={UserPlus}>
              Seguidores
            </FilterChip>
            <FilterChip selected={source === "visitors"} onClick={() => setSource("visitors")} icon={Eye}>
              Visitantes
            </FilterChip>
          </div>
        }
      >
        {demographics.length === 0 ? (
          <MetricsEmpty
            icon={UserRound}
            title={`Sem perfil de ${source === "followers" ? "seguidores" : "visitantes"}`}
            description={`Importe a planilha de ${source === "followers" ? "Seguidores" : "Visitantes"} exportada da página.`}
          />
        ) : (
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
            {DIMENSIONS.map((dimension) => {
              const rows = demographics.filter((row) => row.dimension === dimension.key).sort((a, b) => b.metric_value - a.metric_value);
              const total = rows.reduce((sum, row) => sum + row.metric_value, 0);
              const Icon = dimension.icon;
              return (
                <div key={dimension.key} className="min-w-0">
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#4a6470]">
                    <span className="flex size-6 items-center justify-center rounded-md bg-[#eef6f8] text-[#285f7a]">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    {dimension.label}
                    {rows.length > TOP && <span className="font-normal text-muted-foreground">· {TOP} maiores de {rows.length}</span>}
                  </p>
                  {rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem esse recorte na planilha.</p>
                  ) : (
                    <BarList
                      items={rows.slice(0, TOP).map((row) => ({
                        key: row.label,
                        label: (
                          <span title={row.label}>
                            {row.label}
                            {total > 0 && <span className="text-muted-foreground"> · {formatPercent((row.metric_value / total) * 100, 0)}</span>}
                          </span>
                        ),
                        value: row.metric_value,
                      }))}
                      color={dimension.color}
                      format={formatInt}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </MetricsSection>
    </div>
  );
}
