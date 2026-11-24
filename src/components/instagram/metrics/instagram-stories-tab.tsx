"use client";

import * as React from "react";
import { CircleUserRound, Eye, LogOut, MessageCircle, Users } from "lucide-react";
import { KpiTile, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { formatCompact, formatInt, formatPercent } from "@/lib/social-metrics/format";
import { dateInSaoPaulo, formatFullDate, isDateInRange, type ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import type { InstagramStory } from "@/lib/instagram-stories";

export type ClientStory = InstagramStory;

interface StorySummary {
  count: number;
  avgViews: number | null;
  avgReach: number | null;
  replies: number;
  exitRate: number | null;
}

function summarize(stories: ClientStory[]): StorySummary {
  const count = stories.length;
  const views = stories.reduce((sum, story) => sum + story.views, 0);
  const reach = stories.reduce((sum, story) => sum + story.reach, 0);
  const exits = stories.reduce((sum, story) => sum + story.nav_exits, 0);
  return {
    count,
    avgViews: count ? views / count : null,
    avgReach: count ? reach / count : null,
    replies: stories.reduce((sum, story) => sum + story.replies, 0),
    exitRate: views > 0 ? (exits / views) * 100 : null,
  };
}

function StoryThumb({ story }: { story: ClientStory }) {
  const [failed, setFailed] = React.useState(false);
  const src = story.thumbnail_url ?? story.media_url;
  const exitRate = story.views > 0 ? (story.nav_exits / story.views) * 100 : null;
  const time = story.published_at
    ? new Date(story.published_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
    : "";
  const content = (
    <>
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md bg-[#eef3f5]">
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-[#9fb4bd]">
            <CircleUserRound className="size-6" aria-hidden />
            <span className="text-xs">capa expirou</span>
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-white/95 px-1.5 py-0.5 font-mono text-xs text-[#10232d] shadow-sm">{time}</span>
      </div>
      <dl className="mt-2 space-y-0.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Visualizações</dt>
          <dd className="font-mono font-medium text-[#10232d]">{formatInt(story.views)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Alcance</dt>
          <dd className="font-mono font-medium text-[#10232d]">{formatInt(story.reach)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Saídas</dt>
          <dd className="font-mono font-medium text-[#10232d]">{formatPercent(exitRate, 0)}</dd>
        </div>
      </dl>
    </>
  );
  return story.permalink ? (
    <a href={story.permalink} target="_blank" rel="noreferrer" className="block w-28 shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50 sm:w-32">
      {content}
    </a>
  ) : (
    <div className="w-28 shrink-0 sm:w-32">{content}</div>
  );
}

export function InstagramStoriesTab({ period, stories }: { period: ResolvedMetricsPeriod; stories: ClientStory[] }) {
  const inPeriod = React.useMemo(
    () => stories.filter((story) => isDateInRange(dateInSaoPaulo(story.published_at), period.from, period.to)),
    [stories, period.from, period.to]
  );
  const before = React.useMemo(
    () => stories.filter((story) => isDateInRange(dateInSaoPaulo(story.published_at), period.compareFrom, period.compareTo)),
    [stories, period.compareFrom, period.compareTo]
  );
  const now = summarize(inPeriod);
  const prev = summarize(before);

  const byDay = React.useMemo(() => {
    const groups = new Map<string, ClientStory[]>();
    for (const story of inPeriod) {
      const day = dateInSaoPaulo(story.published_at);
      groups.set(day, [...(groups.get(day) ?? []), story]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, list]) => [day, list.sort((a, b) => (a.published_at ?? "").localeCompare(b.published_at ?? ""))] as const);
  }, [inPeriod]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Stories publicados" icon={CircleUserRound} value={formatInt(now.count)} current={now.count} previous={prev.count} previousText={formatInt(prev.count)} compareLabel={period.compareLabel} />
        <KpiTile label="Visualizações por story" icon={Eye} value={formatCompact(now.avgViews)} current={now.avgViews} previous={prev.avgViews} previousText={formatCompact(prev.avgViews)} compareLabel={period.compareLabel} />
        <KpiTile label="Alcance por story" icon={Users} value={formatCompact(now.avgReach)} current={now.avgReach} previous={prev.avgReach} previousText={formatCompact(prev.avgReach)} compareLabel={period.compareLabel} />
        <KpiTile
          label="Taxa de saída"
          icon={LogOut}
          value={formatPercent(now.exitRate, 1)}
          current={now.exitRate}
          previous={prev.exitRate}
          previousText={formatPercent(prev.exitRate, 1)}
          compareLabel={period.compareLabel}
          inverse
          hint="Quem saiu dos stories ao ver este, sobre as visualizações. Quanto menor, melhor."
          sub={
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3" aria-hidden />
              {formatInt(now.replies)} respostas no período
            </span>
          }
        />
      </div>

      <MetricsSection
        title="Stories do período"
        icon={CircleUserRound}
        description="Coletados a cada 4 h enquanto estão no ar (somem em 24 h). Antes de 23/11/2026 só entravam os stories de quando alguém abria esta tela."
      >
        {byDay.length === 0 ? (
          <MetricsEmpty icon={CircleUserRound} title="Nenhum story gravado no período" />
        ) : (
          <div className="space-y-5">
            {byDay.map(([day, list]) => (
              <div key={day}>
                <p className="mb-2 text-xs font-semibold text-[#4a6470]">
                  {formatFullDate(day)} · {list.length} {list.length === 1 ? "story" : "stories"}
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {list.map((story) => (
                    <StoryThumb key={story.ig_story_id} story={story} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </MetricsSection>
    </div>
  );
}
