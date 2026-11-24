"use client";

import * as React from "react";
import { CalendarClock, Eye, Flame, Hand, Layers, Percent, Rocket, Sparkles, Trophy, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChip, KpiTile, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { PublishingPace } from "@/components/instagram/metrics/instagram-publishing-pace";
import {
  CHART_COLORS,
  DayHourHeatmap,
  FORMAT_COLORS,
  GainLossChart,
  LineSeriesChart,
  ShareBar,
  TrendChart,
} from "@/components/social-metrics/metrics-charts";
import { FORMAT_ICONS, PostRankRow } from "@/components/instagram/metrics/instagram-post-pieces";
import { computePostEngagementRate } from "@/lib/instagram-engagement";
import { computePostingHeatmap } from "@/lib/instagram-analytics";
import { ENGAGEMENT_RATE_GOAL_PCT, REACH_GOAL_MONTHLY } from "@/lib/instagram-goals";
import { formatCompact, formatInt, formatPercent, formatSigned } from "@/lib/social-metrics/format";
import { addDays, eachDate, formatFullDate, type ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import {
  POST_FORMAT_LABELS,
  computeFormatStats,
  computeInstagramKpis,
  computePeriodGoals,
  computeViewsByFormat,
  dailySeries,
  followersAt,
  followersByDay,
  postsEngagementRate,
  postDate,
  postsInRange,
  sortPosts,
  sumInsight,
  type InsightDay,
  type InsightField,
} from "@/lib/social-metrics/instagram";
import type { InstagramPost } from "@/lib/instagram-posts";
import type { FollowersPoint } from "@/lib/social-metrics/server";

type ChartMetric = Extract<InsightField, "views" | "reach" | "total_interactions">;

const CHART_METRICS: Record<ChartMetric, { label: string; chip: string; color: string; description: string }> = {
  reach: {
    label: "Alcance da conta",
    chip: "Alcance",
    color: CHART_COLORS.blue,
    description: "Contas alcançadas em cada dia, por todo o conteúdo (posts, reels e stories). Tracejado: período de comparação.",
  },
  views: {
    label: "Visualizações",
    chip: "Visualizações",
    color: CHART_COLORS.purple,
    description: "Quantas vezes o conteúdo foi exibido em cada dia. Tracejado: período de comparação.",
  },
  total_interactions: {
    label: "Interações",
    chip: "Interações",
    color: CHART_COLORS.teal,
    description: "Curtidas, comentários, salvamentos e compartilhamentos em cada dia. Tracejado: período de comparação.",
  },
};

export function InstagramOverviewTab({
  period,
  insights,
  posts,
  followersHistory,
  monthlyGoal,
  onMonthlyGoalChange,
  onOpenPost,
}: {
  period: ResolvedMetricsPeriod;
  insights: InsightDay[];
  posts: InstagramPost[];
  followersHistory: FollowersPoint[];
  monthlyGoal: number;
  onMonthlyGoalChange: (goal: number) => void;
  onOpenPost: (post: InstagramPost) => void;
}) {
  const [chartMetric, setChartMetric] = React.useState<ChartMetric>("reach");
  const { from, to, compareFrom, compareTo } = period;

  const current = React.useMemo(() => computeInstagramKpis(insights, posts, from, to), [insights, posts, from, to]);
  const previous = React.useMemo(() => computeInstagramKpis(insights, posts, compareFrom, compareTo), [insights, posts, compareFrom, compareTo]);
  const compareLabel = period.compareLabel;

  const spark = (field: InsightField) => dailySeries(insights, field, from, to).map((point) => point.value);

  const trend = React.useMemo(() => {
    const now = dailySeries(insights, chartMetric, from, to);
    const before = dailySeries(insights, chartMetric, compareFrom, compareTo);
    return now.map((point, index) => ({
      date: point.date,
      value: point.value,
      previous: before[index]?.value ?? null,
      previousDate: before[index]?.date,
    }));
  }, [insights, chartMetric, from, to, compareFrom, compareTo]);

  const followersDaily = React.useMemo(() => followersByDay(followersHistory), [followersHistory]);
  const followersNow = followersAt(followersDaily, to);
  const followersSeries = React.useMemo(
    () => eachDate(from, to).map((date) => ({ date, seguidores: followersDaily.get(date) ?? null })),
    [followersDaily, from, to]
  );
  const gainLoss = React.useMemo(() => {
    const gains = dailySeries(insights, "follows", from, to);
    const losses = dailySeries(insights, "unfollows", from, to);
    return gains.map((point, index) => ({ date: point.date, gains: point.value, losses: losses[index]?.value ?? null }));
  }, [insights, from, to]);

  const viewsByFormat = React.useMemo(() => computeViewsByFormat(insights, from, to), [insights, from, to]);
  const reachSplit = React.useMemo(() => {
    const followers = sumInsight(insights, "reach_followers", from, to).value;
    const others = sumInsight(insights, "reach_non_followers", from, to).value;
    return followers === null || others === null || followers + others === 0 ? null : { followers, others };
  }, [insights, from, to]);
  const periodPosts = React.useMemo(() => postsInRange(posts, from, to), [posts, from, to]);
  const formatStats = React.useMemo(() => computeFormatStats(periodPosts), [periodPosts]);
  const bestFormat = formatStats
    .filter((stat) => stat.posts >= 2 && stat.engagementRate !== null)
    .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))[0]?.format;
  const averageRate = postsEngagementRate(periodPosts);

  // Melhor horário: 6 meses de posts até o fim do período (amostra maior que o período).
  const heatmapPosts = React.useMemo(() => postsInRange(posts, addDays(to, -180), to), [posts, to]);
  const heatmap = React.useMemo(() => computePostingHeatmap(heatmapPosts), [heatmapPosts]);
  const bestCell = heatmap.cells.filter((cell) => cell.postsCount >= 2).sort((a, b) => b.engagementRate - a.engagementRate)[0];

  const topPosts = React.useMemo(() => sortPosts(periodPosts, "reach").slice(0, 5), [periodPosts]);
  const goals = computePeriodGoals(current, period.days, {
    reachMonthly: REACH_GOAL_MONTHLY,
    engagementPct: ENGAGEMENT_RATE_GOAL_PCT,
    postsMonthly: monthlyGoal,
  });
  const postsReachSpark = React.useMemo(() => {
    const byDay = new Map<string, number>();
    for (const post of periodPosts) byDay.set(postDate(post), (byDay.get(postDate(post)) ?? 0) + post.reach);
    return eachDate(from, to).map((date) => byDay.get(date) ?? 0);
  }, [periodPosts, from, to]);

  const followsNote =
    current.followsCoverageStart && current.followsCoverageStart > from
      ? `A Meta só tem ganhos e perdas a partir de ${formatFullDate(current.followsCoverageStart)}.`
      : undefined;
  const viewsNote =
    current.viewsCoverageStart && current.viewsCoverageStart > from
      ? `A Meta só tem visualizações a partir de ${formatFullDate(current.viewsCoverageStart)}.`
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile
          label="Alcance dos posts"
          icon={Users}
          value={formatCompact(current.postsReach)}
          current={current.postsReach}
          previous={previous.postsReach}
          previousText={formatCompact(previous.postsReach)}
          compareLabel={compareLabel}
          spark={postsReachSpark}
          selected={chartMetric === "reach"}
          onSelect={() => setChartMetric("reach")}
          goal={{ label: `Meta do período: ${formatCompact(goals.reach.target)} (${formatCompact(REACH_GOAL_MONTHLY)} por mês)`, pct: goals.reach.pct }}
          hint="Soma do alcance de cada post publicado no período, como o escritório sempre mediu (stories ficam de fora)."
        />
        <KpiTile
          label="Taxa de engajamento dos posts"
          icon={Percent}
          value={formatPercent(current.engagementRate, 2)}
          current={current.engagementRate}
          previous={previous.engagementRate}
          previousText={formatPercent(previous.engagementRate, 2)}
          compareLabel={compareLabel}
          goal={{ label: `Meta: ${formatPercent(ENGAGEMENT_RATE_GOAL_PCT, 1)}`, pct: goals.engagement.pct }}
          hint="(curtidas + comentários + salvamentos) ÷ alcance dos posts publicados no período."
        />
        <KpiTile
          label="Posts publicados"
          icon={CalendarClock}
          value={formatInt(current.posts)}
          current={current.posts}
          previous={previous.posts}
          previousText={formatInt(previous.posts)}
          compareLabel={compareLabel}
          goal={{ label: `Meta do período: ${goals.posts.target} (${monthlyGoal} por mês)`, pct: goals.posts.pct }}
        />
        <KpiTile
          label="Saldo de seguidores"
          icon={UserPlus}
          value={formatSigned(current.netFollowers)}
          current={current.netFollowers}
          previous={previous.netFollowers}
          previousText={formatSigned(previous.netFollowers)}
          compareLabel={compareLabel}
          sub={
            current.follows !== null ? (
              <span>
                <span className="font-medium text-[#2e7cb0]">+{formatInt(current.follows)}</span> começaram ·{" "}
                <span className="font-medium text-[#c2557a]">−{formatInt(current.unfollows)}</span> deixaram de seguir
              </span>
            ) : undefined
          }
          note={followsNote}
        />
        <KpiTile
          label="Visualizações"
          icon={Eye}
          value={formatCompact(current.views)}
          current={current.views}
          previous={previous.views}
          previousText={formatCompact(previous.views)}
          compareLabel={compareLabel}
          spark={spark("views")}
          selected={chartMetric === "views"}
          onSelect={() => setChartMetric("views")}
          note={viewsNote}
          hint="Quantas vezes o conteúdo (posts, reels e stories) foi exibido no período. Número novo da Meta, que substituiu as impressões."
        />
        <KpiTile
          label="Interações"
          icon={Hand}
          value={formatCompact(current.interactions)}
          current={current.interactions}
          previous={previous.interactions}
          previousText={formatCompact(previous.interactions)}
          compareLabel={compareLabel}
          spark={spark("total_interactions")}
          selected={chartMetric === "total_interactions"}
          onSelect={() => setChartMetric("total_interactions")}
          hint="Curtidas, comentários, salvamentos, compartilhamentos e respostas em todo o conteúdo, inclusive stories."
        />
      </div>

      <MetricsSection
        title={`${CHART_METRICS[chartMetric].label} dia a dia`}
        description={CHART_METRICS[chartMetric].description}
        icon={Sparkles}
        action={
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CHART_METRICS) as ChartMetric[]).map((metric) => (
              <FilterChip key={metric} selected={chartMetric === metric} onClick={() => setChartMetric(metric)}>
                {CHART_METRICS[metric].chip}
              </FilterChip>
            ))}
          </div>
        }
      >
        {trend.some((point) => point.value !== null) ? (
          <TrendChart
            data={trend}
            label={`${CHART_METRICS[chartMetric].label} (${period.label.split("·").pop()?.trim()})`}
            previousLabel={compareLabel}
            color={CHART_METRICS[chartMetric].color}
          />
        ) : (
          <MetricsEmpty icon={Eye} title="Sem dados da conta neste período" description="A Meta não tem esse número para as datas escolhidas." />
        )}
      </MetricsSection>

      <PublishingPace posts={posts} until={to} monthlyGoal={monthlyGoal} onGoalChange={onMonthlyGoalChange} />

      <div className="grid gap-5 lg:grid-cols-5">
        <MetricsSection
          className="lg:col-span-3"
          title="Seguidores"
          icon={Users}
          description={followersNow !== null ? `${formatInt(followersNow)} seguidores em ${formatFullDate(to)}` : undefined}
        >
          {gainLoss.some((point) => point.gains !== null) ? (
            <GainLossChart data={gainLoss} />
          ) : (
            <MetricsEmpty icon={UserPlus} title="Sem ganhos e perdas neste período" description="A Meta só guarda ganhos e perdas do último ano." />
          )}
          {followersSeries.filter((point) => point.seguidores !== null).length > 1 && (
            <div className="mt-5 border-t border-[#edf3f5] pt-4">
              <p className="mb-1 text-xs font-medium text-[#4a6470]">Total de seguidores</p>
              <LineSeriesChart
                data={followersSeries}
                series={[{ key: "seguidores", label: "Seguidores", color: CHART_COLORS.blue }]}
                height={140}
              />
            </div>
          )}
        </MetricsSection>

        <MetricsSection className="lg:col-span-2" title="De onde vêm as visualizações" icon={Layers} description="Participação de cada formato nas visualizações do período.">
          {viewsByFormat && viewsByFormat.total > 0 ? (
            <div className="space-y-4">
              <ShareBar
                segments={[
                  { key: "reels", label: "Reels", value: viewsByFormat.reels, color: FORMAT_COLORS.reels },
                  { key: "stories", label: "Stories", value: viewsByFormat.stories, color: FORMAT_COLORS.stories },
                  { key: "carrossel", label: "Carrossel", value: viewsByFormat.carrossel, color: FORMAT_COLORS.carrossel },
                  { key: "imagem", label: "Imagem", value: viewsByFormat.imagem, color: FORMAT_COLORS.imagem },
                ]}
                format={formatCompact}
              />
              {viewsByFormat.missingDays > 0 && (
                <p className="text-xs text-muted-foreground">{viewsByFormat.missingDays} dia(s) do período sem o detalhe por formato na Meta.</p>
              )}
            </div>
          ) : (
            <MetricsEmpty icon={Layers} title="Sem detalhe por formato" description="A Meta só separa visualizações por formato desde ago/2025." />
          )}
          {reachSplit && (
            <div className="mt-5 border-t border-[#edf3f5] pt-4">
              <p className="mb-3 text-xs font-semibold text-[#4a6470]">Quem o conteúdo alcança</p>
              <ShareBar
                segments={[
                  { key: "seguem", label: "Já seguem", value: reachSplit.followers, color: CHART_COLORS.blue },
                  { key: "novos", label: "Ainda não seguem", value: reachSplit.others, color: CHART_COLORS.ochre },
                ]}
                format={formatCompact}
              />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {formatPercent((reachSplit.others / (reachSplit.followers + reachSplit.others)) * 100, 0)} do alcance diário somado veio de quem ainda não segue: é o público novo.
              </p>
            </div>
          )}
        </MetricsSection>
      </div>

      <MetricsSection
        title="Desempenho por formato"
        icon={Trophy}
        description={`Média por post publicado no período (${periodPosts.length} posts). Média, não soma: o formato mais postado não leva vantagem.`}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {formatStats.map((stat) => {
            const Icon = FORMAT_ICONS[stat.format];
            const best = stat.format === bestFormat;
            return (
              <div key={stat.format} className={cn("rounded-lg border p-4", best ? "border-[#347796] bg-[#f5fafc]" : "border-[#dce9eb]")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#10232d]">
                    <span className="flex size-8 items-center justify-center rounded-md text-white" style={{ background: FORMAT_COLORS[stat.format] }}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    {POST_FORMAT_LABELS[stat.format]}
                  </span>
                  {best && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#347796] px-2 py-0.5 text-xs font-medium text-white">
                      <Flame className="size-3" aria-hidden />
                      melhor taxa
                    </span>
                  )}
                </div>
                {stat.posts === 0 ? (
                  <p className="mt-4 text-xs text-muted-foreground">Nenhum post desse formato no período.</p>
                ) : (
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Posts</dt>
                      <dd className="font-mono text-base font-semibold text-[#10232d]">{stat.posts}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Taxa de engajamento</dt>
                      <dd className="font-mono text-base font-semibold text-[#10232d]">{formatPercent(stat.engagementRate, 2)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Alcance médio</dt>
                      <dd className="font-mono font-medium text-[#10232d]">{formatCompact(stat.avgReach)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Visualizações médias</dt>
                      <dd className="font-mono font-medium text-[#10232d]">{formatCompact(stat.avgViews)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Salvamentos médios</dt>
                      <dd className="font-mono font-medium text-[#10232d]">{formatInt(stat.avgSaves)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Compartilhamentos médios</dt>
                      <dd className="font-mono font-medium text-[#10232d]">{formatInt(stat.avgShares)}</dd>
                    </div>
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      </MetricsSection>

      <div className="grid gap-5 xl:grid-cols-5">
        <MetricsSection
          className="xl:col-span-2"
          title="Melhor dia e horário"
          icon={CalendarClock}
          description={
            bestCell
              ? `Melhor janela: ${heatmap.dayLabels[bestCell.day]} ${heatmap.blockLabels[bestCell.block]} (${formatPercent(bestCell.engagementRate, 1)} de engajamento). Base: ${heatmapPosts.length} posts dos últimos 6 meses.`
              : `Base: ${heatmapPosts.length} posts dos últimos 6 meses.`
          }
        >
          {heatmapPosts.length ? (
            <DayHourHeatmap
              cells={heatmap.cells.map((cell) => ({ day: cell.day, block: cell.block, value: cell.engagementRate, posts: cell.postsCount }))}
              dayLabels={heatmap.dayLabels}
              blockLabels={heatmap.blockLabels}
            />
          ) : (
            <MetricsEmpty icon={CalendarClock} title="Sem posts suficientes" />
          )}
          <p className="mt-3 text-xs text-muted-foreground">Taxa de engajamento por dia e faixa de 3 h da publicação. Faixas com menos de 2 posts ficam em cinza.</p>
        </MetricsSection>

        <MetricsSection className="xl:col-span-3" title="Top 5 do período" icon={Rocket} description="Posts publicados no período com maior alcance.">
          {topPosts.length ? (
            <div className="-mx-2 divide-y divide-[#edf3f5]">
              {topPosts.map((post, index) => (
                <PostRankRow
                  key={post.id}
                  post={post}
                  rank={index + 1}
                  metricLabel="alcance"
                  metricValue={formatCompact(post.reach)}
                  secondary={`${formatPercent(computePostEngagementRate(post), 1)} de engajamento`}
                  onOpen={() => onOpenPost(post)}
                />
              ))}
            </div>
          ) : (
            <MetricsEmpty icon={Rocket} title="Nenhum post no período" />
          )}
          {averageRate !== null && (
            <p className="mt-3 text-xs text-muted-foreground">Taxa média de engajamento dos posts do período: {formatPercent(averageRate, 2)}.</p>
          )}
        </MetricsSection>
      </div>
    </div>
  );
}
