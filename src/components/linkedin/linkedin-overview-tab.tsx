"use client";

import * as React from "react";
import { Eye, Flame, Layers, MonitorSmartphone, MousePointerClick, Percent, Rocket, Sparkles, ThumbsUp, Trophy, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiTile, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { CHART_COLORS, ShareBar, TrendChart } from "@/components/social-metrics/metrics-charts";
import {
  LINKEDIN_FORMAT_COLORS,
  LINKEDIN_FORMAT_ICONS,
  LINKEDIN_FORMAT_LABELS,
  LinkedinPostRankRow,
  type LinkedinPostFormat,
} from "@/components/linkedin/linkedin-post-pieces";
import {
  computeLinkedinPerformanceByFormat,
  linkedinDailySeries,
  linkedinPostEngagementPercent,
  type LinkedinPeriodTotals,
} from "@/lib/linkedin-analytics";
import { formatCompact, formatInt, formatPercent } from "@/lib/social-metrics/format";
import { formatFullDate, type ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import type { LinkedinDailyMetric, LinkedinDashboardData, LinkedinPost } from "@/lib/linkedin-types";

type ChartMetric = "impressions" | "clicks" | "newFollowers" | "pageViews";

const CHART_METRICS: Record<ChartMetric, { label: string; color: string }> = {
  impressions: { label: "Impressões", color: CHART_COLORS.blue },
  clicks: { label: "Cliques", color: CHART_COLORS.teal },
  newFollowers: { label: "Novos seguidores", color: CHART_COLORS.purple },
  pageViews: { label: "Visitas à página", color: CHART_COLORS.ochre },
};

const FORMAT_KEY: Record<string, LinkedinPostFormat> = { "Vídeo": "video", Carrossel: "carrossel", "Imagem / texto": "imagem" };

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function engagementOf(row: LinkedinDailyMetric): number | null {
  return ratio(row.total_clicks + row.total_reactions + row.total_comments + row.total_shares, row.total_impressions);
}

/** Aviso do indicador quando o período não está todo importado. */
export function coverageNote(daysWithData: number, periodDays: number, report: string): string | undefined {
  if (daysWithData === 0) return `Sem a planilha de ${report} para este período.`;
  if (daysWithData < periodDays) return `Só ${daysWithData} de ${periodDays} dias têm a planilha de ${report}.`;
  return undefined;
}

export function useLinkedinSeries(data: LinkedinDashboardData, period: ResolvedMetricsPeriod) {
  const { from, to, compareFrom, compareTo } = period;
  return React.useCallback(
    (metric: ChartMetric | "ctr" | "engagement", range: "atual" | "anterior" = "atual") => {
      const [a, b] = range === "atual" ? [from, to] : [compareFrom, compareTo];
      switch (metric) {
        case "impressions":
          return linkedinDailySeries(data.dailyMetrics, (row) => row.total_impressions, a, b);
        case "clicks":
          return linkedinDailySeries(data.dailyMetrics, (row) => row.total_clicks, a, b);
        case "ctr":
          return linkedinDailySeries(data.dailyMetrics, (row) => ratio(row.total_clicks, row.total_impressions), a, b);
        case "engagement":
          return linkedinDailySeries(data.dailyMetrics, engagementOf, a, b);
        case "newFollowers":
          return linkedinDailySeries(data.followerDailyMetrics, (row) => row.total_followers, a, b);
        case "pageViews":
        default:
          return linkedinDailySeries(data.visitorDailyMetrics, (row) => row.total_views_total, a, b);
      }
    },
    [data.dailyMetrics, data.followerDailyMetrics, data.visitorDailyMetrics, from, to, compareFrom, compareTo]
  );
}

export function LinkedinOverviewTab({
  period,
  data,
  current,
  previous,
  periodPosts,
  previousPostsCount,
  dataUntil,
  onOpenPost,
}: {
  period: ResolvedMetricsPeriod;
  data: LinkedinDashboardData;
  current: LinkedinPeriodTotals;
  previous: LinkedinPeriodTotals;
  periodPosts: LinkedinPost[];
  previousPostsCount: number;
  dataUntil: string | null;
  onOpenPost: (post: LinkedinPost) => void;
}) {
  const [chartMetric, setChartMetric] = React.useState<ChartMetric>("impressions");
  const series = useLinkedinSeries(data, period);
  const compareLabel = period.compareLabel;
  const spark = (metric: ChartMetric | "ctr" | "engagement") => series(metric).map((point) => point.value);

  const trend = React.useMemo(() => {
    const now = series(chartMetric);
    const before = series(chartMetric, "anterior");
    return now.map((point, index) => ({
      date: point.date,
      value: point.value,
      previous: before[index]?.value ?? null,
      previousDate: before[index]?.date,
    }));
  }, [series, chartMetric]);

  const formats = React.useMemo(() => {
    const stats = computeLinkedinPerformanceByFormat(periodPosts);
    return (["video", "carrossel", "imagem"] as LinkedinPostFormat[]).map((format) => {
      const stat = stats.find((item) => FORMAT_KEY[item.label] === format);
      return { format, posts: stat?.posts ?? 0, impressions: stat?.impressions ?? 0, rate: stat && stat.impressions > 0 ? stat.engagementRate : null };
    });
  }, [periodPosts]);
  const bestFormat = formats.filter((stat) => stat.posts >= 2 && stat.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0]?.format;

  const topPosts = React.useMemo(() => [...periodPosts].sort((a, b) => b.impressions - a.impressions).slice(0, 5), [periodPosts]);
  const averageRate = periodPosts.length
    ? periodPosts.reduce((sum, post) => sum + linkedinPostEngagementPercent(post), 0) / periodPosts.length
    : null;

  const contentNote = coverageNote(current.contentDays, period.days, "conteúdo");
  const followersNote = coverageNote(current.followerDays, period.days, "seguidores");
  const visitorsNote = coverageNote(current.visitorDays, period.days, "visitantes");
  const engagementParts = [
    { key: "cliques", label: "Cliques", value: current.clicks ?? 0, color: CHART_COLORS.blue },
    { key: "reacoes", label: "Reações", value: current.reactions ?? 0, color: CHART_COLORS.ochre },
    { key: "comentarios", label: "Comentários", value: current.comments ?? 0, color: CHART_COLORS.purple },
    { key: "compartilhamentos", label: "Compartilhamentos", value: current.shares ?? 0, color: CHART_COLORS.teal },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile
          label="Impressões"
          icon={Eye}
          value={formatCompact(current.impressions)}
          current={current.impressions}
          previous={previous.impressions}
          previousText={formatCompact(previous.impressions)}
          compareLabel={compareLabel}
          spark={spark("impressions")}
          selected={chartMetric === "impressions"}
          onSelect={() => setChartMetric("impressions")}
          sub={
            current.impressions !== null
              ? (current.sponsoredImpressions ?? 0) > 0
                ? `${formatCompact(current.organicImpressions)} orgânicas · ${formatCompact(current.sponsoredImpressions)} patrocinadas`
                : "Todas orgânicas"
              : undefined
          }
          note={contentNote}
          hint="Quantas vezes as publicações da página apareceram na tela de alguém (orgânico + patrocinado)."
        />
        <KpiTile
          label="Cliques"
          icon={MousePointerClick}
          value={formatCompact(current.clicks)}
          current={current.clicks}
          previous={previous.clicks}
          previousText={formatCompact(previous.clicks)}
          compareLabel={compareLabel}
          spark={spark("clicks")}
          selected={chartMetric === "clicks"}
          onSelect={() => setChartMetric("clicks")}
          note={contentNote}
          hint="Cliques nas publicações, no nome ou no logo da página."
        />
        <KpiTile
          label="CTR"
          icon={Percent}
          value={formatPercent(current.ctr, 2)}
          current={current.ctr}
          previous={previous.ctr}
          previousText={formatPercent(previous.ctr, 2)}
          compareLabel={compareLabel}
          spark={spark("ctr")}
          note={contentNote}
          hint="Taxa de cliques: cliques ÷ impressões do período."
        />
        <KpiTile
          label="Taxa de engajamento"
          icon={ThumbsUp}
          value={formatPercent(current.engagementRate, 2)}
          current={current.engagementRate}
          previous={previous.engagementRate}
          previousText={formatPercent(previous.engagementRate, 2)}
          compareLabel={compareLabel}
          spark={spark("engagement")}
          sub={
            current.reactions !== null
              ? `${formatInt(current.reactions)} reações · ${formatInt(current.comments)} comentários · ${formatInt(current.shares)} compartilhamentos`
              : undefined
          }
          note={contentNote}
          hint="(cliques + reações + comentários + compartilhamentos) ÷ impressões do período."
        />
        <KpiTile
          label="Novos seguidores"
          icon={UserPlus}
          value={formatInt(current.newFollowers)}
          current={current.newFollowers}
          previous={previous.newFollowers}
          previousText={formatInt(previous.newFollowers)}
          compareLabel={compareLabel}
          spark={spark("newFollowers")}
          selected={chartMetric === "newFollowers"}
          onSelect={() => setChartMetric("newFollowers")}
          sub={
            current.newFollowers !== null
              ? `${formatInt(current.organicFollowers)} orgânicos · ${formatInt(current.sponsoredFollowers)} patrocinados`
              : undefined
          }
          note={followersNote}
          hint="Pessoas que começaram a seguir a página no período (o LinkedIn não informa quem deixou de seguir)."
        />
        <KpiTile
          label="Visitas à página"
          icon={MonitorSmartphone}
          value={formatCompact(current.pageViews)}
          current={current.pageViews}
          previous={previous.pageViews}
          previousText={formatCompact(previous.pageViews)}
          compareLabel={compareLabel}
          spark={spark("pageViews")}
          selected={chartMetric === "pageViews"}
          onSelect={() => setChartMetric("pageViews")}
          sub={current.uniqueVisitors !== null ? `${formatCompact(current.uniqueVisitors)} visitantes únicos (soma dos dias)` : undefined}
          note={visitorsNote}
          hint="Visualizações da página da empresa (visão geral, vida na empresa e vagas)."
        />
      </div>

      <MetricsSection
        title={`${CHART_METRICS[chartMetric].label} dia a dia`}
        description="Clique em um indicador acima para trocar a linha. Tracejado: período de comparação."
        icon={Sparkles}
      >
        {trend.some((point) => point.value !== null) ? (
          <TrendChart
            data={trend}
            label={`${CHART_METRICS[chartMetric].label} (${period.label.split("·").pop()?.trim()})`}
            previousLabel={compareLabel}
            color={CHART_METRICS[chartMetric].color}
          />
        ) : (
          <MetricsEmpty
            icon={Eye}
            title="Sem dados do LinkedIn neste período"
            description={
              dataUntil
                ? `A última planilha importada vai até ${formatFullDate(dataUntil)}. Importe os relatórios mais novos ou escolha outro período.`
                : "Importe as planilhas exportadas da página do LinkedIn."
            }
          />
        )}
      </MetricsSection>

      <div className="grid gap-5 lg:grid-cols-5">
        <MetricsSection className="lg:col-span-2" title="De onde vêm as impressões" icon={Layers} description="Orgânico × patrocinado no período.">
          {current.impressions ? (
            <div className="space-y-4">
              <ShareBar
                segments={[
                  { key: "organico", label: "Orgânico", value: current.organicImpressions ?? 0, color: CHART_COLORS.blue },
                  { key: "patrocinado", label: "Patrocinado", value: current.sponsoredImpressions ?? 0, color: CHART_COLORS.ochre },
                ]}
                format={formatCompact}
              />
              {(current.sponsoredImpressions ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma impressão patrocinada no período: todo o alcance veio do orgânico.</p>
              )}
            </div>
          ) : (
            <MetricsEmpty icon={Layers} title="Sem impressões no período" />
          )}
          {engagementParts.some((part) => part.value > 0) && (
            <div className="mt-5 border-t border-[#edf3f5] pt-4">
              <p className="mb-3 text-xs font-semibold text-[#4a6470]">Do que é feito o engajamento</p>
              <ShareBar segments={engagementParts} format={formatInt} />
            </div>
          )}
        </MetricsSection>

        <MetricsSection
          className="lg:col-span-3"
          title="Desempenho por formato"
          icon={Trophy}
          description={`Média por publicação do período (${periodPosts.length} publicações). Formato vem do LinkedIn e do post do Instagram vinculado.`}
        >
          <div className="grid gap-3 md:grid-cols-3">
            {formats.map((stat) => {
              const Icon = LINKEDIN_FORMAT_ICONS[stat.format];
              const best = stat.format === bestFormat;
              return (
                <div key={stat.format} className={cn("rounded-lg border p-4", best ? "border-[#347796] bg-[#f5fafc]" : "border-[#dce9eb]")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#10232d]">
                      <span className="flex size-8 items-center justify-center rounded-md text-white" style={{ background: LINKEDIN_FORMAT_COLORS[stat.format] }}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      {LINKEDIN_FORMAT_LABELS[stat.format]}
                    </span>
                    {best && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#347796] px-2 py-0.5 text-xs font-medium text-white">
                        <Flame className="size-3" aria-hidden />
                        melhor
                      </span>
                    )}
                  </div>
                  {stat.posts === 0 ? (
                    <p className="mt-4 text-xs text-muted-foreground">Nenhuma publicação desse formato no período.</p>
                  ) : (
                    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Publicações</dt>
                        <dd className="font-mono text-base font-semibold text-[#10232d]">{stat.posts}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Engajamento</dt>
                        <dd className="font-mono text-base font-semibold text-[#10232d]">{formatPercent(stat.rate, 2)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Impressões médias</dt>
                        <dd className="font-mono font-medium text-[#10232d]">{formatCompact(stat.impressions / stat.posts)}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              );
            })}
          </div>
        </MetricsSection>
      </div>

      <MetricsSection
        title="Top 5 do período"
        icon={Rocket}
        description={`Publicações do período com mais impressões. ${formatInt(periodPosts.length)} publicações no período (${formatInt(previousPostsCount)} em ${compareLabel}).`}
      >
        {topPosts.length ? (
          <div className="-mx-2 divide-y divide-[#edf3f5]">
            {topPosts.map((post, index) => (
              <LinkedinPostRankRow
                key={post.id}
                post={post}
                rank={index + 1}
                metricLabel="impressões"
                metricValue={formatCompact(post.impressions)}
                secondary={`${formatPercent(linkedinPostEngagementPercent(post), 1)} de engajamento`}
                onOpen={() => onOpenPost(post)}
              />
            ))}
          </div>
        ) : (
          <MetricsEmpty icon={Rocket} title="Nenhuma publicação no período" description="As publicações chegam com a planilha de Conteúdo." />
        )}
        {averageRate !== null && (
          <p className="mt-3 text-xs text-muted-foreground">Taxa média de engajamento das publicações do período: {formatPercent(averageRate, 2)}.</p>
        )}
      </MetricsSection>
    </div>
  );
}
