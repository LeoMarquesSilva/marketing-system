"use client";

import { useMemo, useState } from "react";
import {
  ImageIcon,
  Users,
  Share2,
  ExternalLink,
  Building2,
  Trophy,
  Clock3,
  TrendingUp,
  Eye,
  Activity,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AreaWithIcon } from "@/components/solicitacoes/area-with-icon";
import { FormerEmployeeBadge } from "@/components/usuarios/former-employee-badge";
import { InstagramBarChart } from "@/components/instagram/instagram-bar-chart";
import { InstagramPostThumbnail } from "@/components/instagram/instagram-post-thumbnail";
import { InstagramEngagementMetrics } from "@/components/instagram/instagram-engagement-metrics";
import { InstagramReportExport } from "@/components/instagram/instagram-report-export";
import {
  SectionCard,
  KpiCard,
  ComparisonStat,
} from "@/components/instagram/instagram-section-card";
import { getAreaIcon } from "@/lib/area-icons";
import {
  computeAreaDashboards,
  computeEngagementRateByArea,
  computeEngagementRateBySolicitante,
  computeOfficeInsight,
  computeTopPostsByEngagement,
  computePeriodComparison,
  computeBestPostingHours,
} from "@/lib/instagram-analytics";
import {
  getPostAreas,
  getPostSolicitantes,
  isCollabPost,
} from "@/lib/instagram-link-rules";
import { getInstagramMediaLabel } from "@/lib/instagram-media-type";
import { computeEngagementActionsFromPost } from "@/lib/instagram-engagement";
import { filterPostsByArea } from "@/lib/instagram-report";
import {
  filterByPeriod,
  getPreviousRange,
  formatRangeLabel,
  type DateRange,
} from "@/lib/instagram-period";
import type { InstagramAccountStats, InstagramPost } from "@/lib/instagram-posts";
import type { Area } from "@/lib/areas";
import type { User } from "@/lib/users";
import { isUserActive } from "@/lib/user-status";
import { cn } from "@/lib/utils";

const OFFICE_TAB_ID = "__office__";

interface InstagramAreaDashboardProps {
  posts: InstagramPost[];
  areas: Area[];
  users: User[];
  accountStats: InstagramAccountStats | null;
  periodRange: DateRange | null;
  periodLabel: string | null;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function formatEngagementRate(rate: number) {
  return `${rate.toFixed(1)}%`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function truncateCaption(caption: string | null, max = 100) {
  if (!caption) return "Sem legenda";
  const line = caption.split("\n")[0];
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function sortPostsByDate(posts: InstagramPost[]) {
  return [...posts].sort(
    (a, b) =>
      new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()
  );
}

function emptyAreaInsight(areaName: string) {
  return {
    area: areaName,
    posts: 0,
    reach: 0,
    views: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    engagementActions: 0,
    avgEngagementActions: 0,
    collaborators: [],
  };
}

function PeriodHint({ periodLabel, count, total }: { periodLabel: string | null; count: number; total: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      {periodLabel ? (
        <>
          <span className="font-medium text-foreground">{periodLabel}</span>
          {" · "}
          {count} de {total} post{total !== 1 ? "s" : ""}
        </>
      ) : (
        <>Todos os {total} post{total !== 1 ? "s" : ""} desde 2025</>
      )}
    </p>
  );
}

function PeriodComparisonGrid({ posts, periodRange }: { posts: InstagramPost[]; periodRange: DateRange | null }) {
  const comparison = useMemo(
    () =>
      computePeriodComparison(posts, periodRange ? { range: periodRange } : { rangeDays: 30 }),
    [posts, periodRange]
  );

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ComparisonStat
        label="Taxa de engajamento"
        value={formatEngagementRate(comparison.current.engagementRate)}
        delta={comparison.deltaRatePts}
        deltaSuffix=" p.p."
        sub={`Anterior: ${formatEngagementRate(comparison.previous.engagementRate)}`}
      />
      <ComparisonStat
        label="Alcance"
        value={formatNumber(comparison.current.reach)}
        delta={comparison.deltaReachPct}
        deltaSuffix="%"
        sub={`Anterior: ${formatNumber(comparison.previous.reach)}`}
      />
      <ComparisonStat
        label="Posts publicados"
        value={formatNumber(comparison.current.postsCount)}
        delta={comparison.deltaPostsPct}
        deltaSuffix="%"
        sub={`Anterior: ${formatNumber(comparison.previous.postsCount)} posts`}
      />
    </div>
  );
}

function BestHoursMini({ posts }: { posts: InstagramPost[] }) {
  const hours = useMemo(
    () => computeBestPostingHours(posts, { limit: 3, timeZone: "America/Sao_Paulo", minPosts: 2 }),
    [posts]
  );

  if (hours.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sem histórico suficiente para recomendar horários.</p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {hours.map((slot, index) => (
        <div key={slot.hour} className="rounded-xl border border-border/40 bg-background/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              #{index + 1} janela
            </p>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {slot.postsCount} post{slot.postsCount !== 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{slot.hourLabel}</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-700">
            {formatEngagementRate(slot.engagementRate)}
          </p>
        </div>
      ))}
    </div>
  );
}

function PostListRow({
  post,
  users,
  areaName,
  rank,
}: {
  post: InstagramPost;
  users: User[];
  areaName?: string;
  rank?: number;
}) {
  const authors = getPostSolicitantes(post);
  const postAreas = getPostAreas(post);
  const isCollab = isCollabPost(post);

  return (
    <div
      className={cn(
        "flex gap-3 items-start rounded-xl border border-border/40 bg-background/50 p-3 hover:bg-background/80 transition-colors",
        rank === 1 && "border-amber-300/60 bg-amber-50/40",
        rank === 2 && "border-slate-300/60 bg-slate-50/40",
        rank === 3 && "border-orange-300/50 bg-orange-50/30"
      )}
    >
      {rank != null && (
        <div
          className={cn(
            "flex h-16 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold tabular-nums",
            rank === 1 && "bg-amber-100 text-amber-800",
            rank === 2 && "bg-slate-100 text-slate-700",
            rank === 3 && "bg-orange-100 text-orange-800",
            rank > 3 && "bg-muted text-muted-foreground text-base"
          )}
        >
          #{rank}
        </div>
      )}
      <InstagramPostThumbnail post={post} size="list" showBadge={false} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge variant="outline" className="rounded-full text-[10px]">
                {getInstagramMediaLabel(post.media_type)}
              </Badge>
              {isCollab && (
                <Badge variant="outline" className="rounded-full text-[10px] text-sky-700 border-sky-300 bg-sky-50">
                  Collab
                </Badge>
              )}
              {postAreas.map((area) => (
                <AreaWithIcon key={area} area={area} className="text-[10px]" />
              ))}
              {(post.tags ?? []).slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="rounded-full text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
            <p className="text-sm line-clamp-2">{truncateCaption(post.caption, 120)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(post.published_at)}
              {authors.length > 0 && (
                <>
                  {" · "}
                  {authors
                    .map((a) => {
                      const u = users.find((x) => x.id === a.id);
                      return u?.name ?? a.name;
                    })
                    .join(", ")}
                </>
              )}
              {areaName && isCollab && postAreas.length > 1 && (
                <> · + {postAreas.filter((a) => a !== areaName).join(", ")}</>
              )}
            </p>
          </div>
          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground"
              title="Abrir no Instagram"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
          <InstagramEngagementMetrics
            variant="compact"
            reach={post.reach}
            likes={post.likes}
            comments={post.comments}
            saves={post.saves}
          />
          <span>{formatNumber(post.views)} views</span>
        </div>
      </div>
    </div>
  );
}

function TopPostsList({ posts, users, areaName }: { posts: InstagramPost[]; users: User[]; areaName?: string }) {
  const topPosts = useMemo(() => computeTopPostsByEngagement(posts, 5), [posts]);

  if (topPosts.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum post no período.</p>;
  }

  return (
    <div className="space-y-2">
      {topPosts.map((post, index) => (
        <PostListRow key={post.id} post={post} users={users} areaName={areaName} rank={index + 1} />
      ))}
    </div>
  );
}

function OfficeDetailPanel({
  allPosts,
  filteredPosts,
  periodLabel,
  periodRange,
  users,
  areas,
  accountStats,
}: {
  allPosts: InstagramPost[];
  filteredPosts: InstagramPost[];
  periodLabel: string | null;
  periodRange: DateRange | null;
  users: User[];
  areas: Area[];
  accountStats: InstagramAccountStats | null;
}) {
  const insight = useMemo(() => computeOfficeInsight(filteredPosts), [filteredPosts]);
  const collabCount = filteredPosts.filter(isCollabPost).length;
  const engagementRate = insight.reach > 0 ? (insight.engagementActions / insight.reach) * 100 : 0;
  const shares = filteredPosts.reduce((s, p) => s + p.shares, 0);

  const chartByArea = useMemo(() => computeEngagementRateByArea(filteredPosts), [filteredPosts]);
  const chartByAuthor = useMemo(
    () => computeEngagementRateBySolicitante(filteredPosts, users),
    [filteredPosts, users]
  );

  const reportFilterDescription = [
    "Escritório todo",
    periodLabel ? `Período: ${periodLabel}` : "Todos os posts desde 2025",
  ].join(" · ");

  if (filteredPosts.length === 0) {
    return (
      <SectionCard title="Escritório todo" description="Visão consolidada de todas as áreas">
        <PeriodHint periodLabel={periodLabel} count={0} total={allPosts.length} />
        <div className="mt-3 rounded-xl border border-dashed border-border/60 bg-background/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum post no período selecionado.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Escritório todo"
        description={`${filteredPosts.length} post${filteredPosts.length !== 1 ? "s" : ""}${collabCount > 0 ? ` · ${collabCount} collab` : ""}`}
        action={
          <InstagramReportExport
            posts={filteredPosts}
            areas={areas}
            users={users}
            accountStats={accountStats}
            filterDescription={reportFilterDescription}
            compact
            dialogTitle="Relatório — Escritório todo"
          />
        }
      >
        <div className="space-y-4">
          <PeriodHint periodLabel={periodLabel} count={filteredPosts.length} total={allPosts.length} />
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Posts" value={insight.posts} icon={<ImageIcon className="h-3.5 w-3.5" />} />
            <KpiCard label="Taxa de engajamento" value={formatEngagementRate(engagementRate)} icon={<TrendingUp className="h-3.5 w-3.5" />} />
            <KpiCard label="Alcance" value={formatNumber(insight.reach)} icon={<Eye className="h-3.5 w-3.5" />} />
            <KpiCard label="Áreas ativas" value={new Set(filteredPosts.flatMap(getPostAreas)).size} icon={<Building2 className="h-3.5 w-3.5" />} />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatNumber(insight.likes)} curtidas · {formatNumber(insight.comments)} comentários ·{" "}
            {formatNumber(insight.saves)} salvamentos · {formatNumber(insight.views)} visualizações ·{" "}
            {formatNumber(shares)} compartilhamentos
          </p>
        </div>
      </SectionCard>

      {periodRange && (
        <SectionCard
          title={`Resumo · ${periodLabel ?? "período"}`}
          description="Variação real de performance no período"
          action={
            <Badge variant="outline" className="rounded-full gap-1.5 font-normal text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Comparativo com {formatRangeLabel(getPreviousRange(periodRange))}
            </Badge>
          }
        >
          <PeriodComparisonGrid posts={allPosts} periodRange={periodRange} />
        </SectionCard>
      )}

      <SectionCard title="Engajamento por área e por autor" description="Taxa de engajamento sobre alcance">
        <div className="grid lg:grid-cols-2 gap-4 lg:items-start">
          <InstagramBarChart
            title="Taxa por área"
            data={chartByArea}
            useAreaIcons
            valueFormatter={formatEngagementRate}
            emptyMessage="Atribua áreas às postagens para ver este gráfico."
          />
          <InstagramBarChart
            title="Taxa por autor"
            data={chartByAuthor}
            useAvatars
            valueFormatter={formatEngagementRate}
            emptyMessage="Atribua autores às postagens para ver este gráfico."
          />
        </div>
      </SectionCard>

      <SectionCard title="Melhores horários" description="Janelas com melhor taxa de engajamento" action={<Clock3 className="h-4 w-4 text-muted-foreground" />}>
        <BestHoursMini posts={filteredPosts} />
      </SectionCard>

      <SectionCard title="Top 5 posts do escritório" description="Ranking por taxa de engajamento" action={<Trophy className="h-4 w-4 text-amber-600" />}>
        <TopPostsList posts={filteredPosts} users={users} />
      </SectionCard>

      <SectionCard title={`Todos os posts (${filteredPosts.length})`} description="Lista completa do período">
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {filteredPosts.map((post) => (
            <PostListRow key={post.id} post={post} users={users} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function AreaDetailPanel({
  areaName,
  allAreaPosts,
  filteredAreaPosts,
  insight,
  periodLabel,
  periodRange,
  users,
  areas,
  accountStats,
}: {
  areaName: string;
  allAreaPosts: InstagramPost[];
  filteredAreaPosts: InstagramPost[];
  insight: ReturnType<typeof computeAreaDashboards>[number];
  periodLabel: string | null;
  periodRange: DateRange | null;
  users: User[];
  areas: Area[];
  accountStats: InstagramAccountStats | null;
}) {
  const collabCount = filteredAreaPosts.filter(isCollabPost).length;
  const totalLikes = filteredAreaPosts.reduce((s, p) => s + p.likes, 0);
  const totalComments = filteredAreaPosts.reduce((s, p) => s + p.comments, 0);
  const totalSaves = filteredAreaPosts.reduce((s, p) => s + p.saves, 0);
  const shares = filteredAreaPosts.reduce((s, p) => s + p.shares, 0);
  const engagementRate = insight.reach > 0 ? (insight.engagementActions / insight.reach) * 100 : 0;

  const chartByAuthor = useMemo(() => {
    const map = new Map<
      string,
      { reach: number; actions: number; name: string; isFormerEmployee: boolean; avatarUrl: string | null }
    >();
    for (const post of filteredAreaPosts) {
      const actions = computeEngagementActionsFromPost(post);
      for (const s of getPostSolicitantes(post)) {
        const user = users.find((u) => u.id === s.id);
        const name = user?.name ?? s.name;
        const current = map.get(s.id) ?? {
          reach: 0,
          actions: 0,
          name,
          isFormerEmployee: user ? !isUserActive(user) : false,
          avatarUrl: user?.avatar_url ?? null,
        };
        map.set(s.id, {
          reach: current.reach + post.reach,
          actions: current.actions + actions,
          name,
          isFormerEmployee: current.isFormerEmployee,
          avatarUrl: current.avatarUrl ?? user?.avatar_url ?? null,
        });
      }
    }
    return Array.from(map.values())
      .map(({ name, reach, actions, isFormerEmployee, avatarUrl }) => ({
        label: name,
        total: reach > 0 ? (actions / reach) * 100 : 0,
        isFormerEmployee,
        avatarUrl,
        sublabel: isFormerEmployee ? "Ex-funcionário" : undefined,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredAreaPosts, users]);

  const chartByFormat = useMemo(() => {
    const map = new Map<string, { reach: number; actions: number }>();
    for (const post of filteredAreaPosts) {
      const label = getInstagramMediaLabel(post.media_type);
      const current = map.get(label) ?? { reach: 0, actions: 0 };
      current.reach += post.reach;
      current.actions += computeEngagementActionsFromPost(post);
      map.set(label, current);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        total: value.reach > 0 ? (value.actions / value.reach) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredAreaPosts]);

  const collaboratorsWithPosts = insight.collaborators.filter((c) => c.posts > 0);

  const reportFilterDescription = [
    `Área: ${areaName}`,
    periodLabel ? `Período: ${periodLabel}` : "Todos os posts vinculados",
  ].join(" · ");

  if (filteredAreaPosts.length === 0) {
    return (
      <SectionCard
        title={areaName}
        description="Dashboard da área"
        action={<AreaWithIcon area={areaName} className="text-sm" />}
      >
        <PeriodHint periodLabel={periodLabel} count={0} total={allAreaPosts.length} />
        <div className="mt-3 rounded-xl border border-dashed border-border/60 bg-background/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum post nesta área no período selecionado.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={areaName}
        description={`${filteredAreaPosts.length} post${filteredAreaPosts.length !== 1 ? "s" : ""}${collabCount > 0 ? ` · ${collabCount} collab` : ""}`}
        action={
          <InstagramReportExport
            posts={filteredAreaPosts}
            areas={areas}
            users={users}
            accountStats={accountStats}
            focusArea={areaName}
            filterDescription={reportFilterDescription}
            compact
            dialogTitle={`Relatório — ${areaName}`}
          />
        }
      >
        <div className="space-y-4">
          <PeriodHint periodLabel={periodLabel} count={filteredAreaPosts.length} total={allAreaPosts.length} />
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Posts" value={insight.posts} icon={<ImageIcon className="h-3.5 w-3.5" />} />
            <KpiCard label="Taxa de engajamento" value={formatEngagementRate(engagementRate)} icon={<TrendingUp className="h-3.5 w-3.5" />} />
            <KpiCard label="Alcance" value={formatNumber(insight.reach)} icon={<Eye className="h-3.5 w-3.5" />} />
            <KpiCard label="Colaboradores" value={collaboratorsWithPosts.length} icon={<Users className="h-3.5 w-3.5" />} />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatNumber(totalLikes)} curtidas · {formatNumber(totalComments)} comentários ·{" "}
            {formatNumber(totalSaves)} salvamentos · {formatNumber(insight.views)} visualizações ·{" "}
            {formatNumber(shares)} compartilhamentos
          </p>
        </div>
      </SectionCard>

      {periodRange && (
        <SectionCard
          title={`Resumo · ${periodLabel ?? "período"}`}
          description="Variação real de performance no período"
          action={
            <Badge variant="outline" className="rounded-full gap-1.5 font-normal text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Comparativo com {formatRangeLabel(getPreviousRange(periodRange))}
            </Badge>
          }
        >
          <PeriodComparisonGrid posts={allAreaPosts} periodRange={periodRange} />
        </SectionCard>
      )}

      <SectionCard title="Engajamento por colaborador e formato" description="Taxa de engajamento sobre alcance">
        <div className="grid lg:grid-cols-2 gap-4 lg:items-start">
          <InstagramBarChart
            title="Taxa por colaborador"
            data={chartByAuthor}
            useAvatars
            valueFormatter={formatEngagementRate}
            emptyMessage="Nenhum autor vinculado nesta área."
          />
          <InstagramBarChart
            title="Taxa por formato"
            data={chartByFormat}
            valueFormatter={formatEngagementRate}
            emptyMessage="Sem posts nesta área."
          />
        </div>
      </SectionCard>

      <SectionCard title="Melhores horários" description="Janelas com melhor taxa de engajamento" action={<Clock3 className="h-4 w-4 text-muted-foreground" />}>
        <BestHoursMini posts={filteredAreaPosts} />
      </SectionCard>

      <SectionCard title={`Colaboradores (${collaboratorsWithPosts.length})`} description="Quem produz conteúdo nesta área">
        {collaboratorsWithPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum colaborador com posts nesta área.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {collaboratorsWithPosts.map((collab) => (
              <div
                key={collab.userId}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border/40 bg-background/50 px-3 py-2.5",
                  !collab.is_active && "border-amber-200/60 bg-amber-50/30"
                )}
              >
                <Avatar className={cn("h-8 w-8 shrink-0", !collab.is_active && "opacity-75")}>
                  <AvatarImage src={collab.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">{getInitials(collab.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={cn("text-sm font-medium truncate", !collab.is_active && "text-muted-foreground")}>
                      {collab.name}
                    </p>
                    {!collab.is_active && <FormerEmployeeBadge />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {collab.posts} post{collab.posts !== 1 ? "s" : ""} ·{" "}
                    {formatEngagementRate(collab.reach > 0 ? (collab.engagementActions / collab.reach) * 100 : 0)} taxa ·{" "}
                    {formatNumber(collab.reach)} alcance
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Top 5 posts — ${areaName}`} description="Ranking por taxa de engajamento" action={<Trophy className="h-4 w-4 text-amber-600" />}>
        <TopPostsList posts={filteredAreaPosts} users={users} areaName={areaName} />
      </SectionCard>

      <SectionCard title={`Todos os posts da área (${filteredAreaPosts.length})`} description="Lista completa do período">
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {filteredAreaPosts.map((post) => (
            <PostListRow key={post.id} post={post} users={users} areaName={areaName} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export function InstagramAreaDashboard({
  posts,
  areas,
  users,
  accountStats,
  periodRange,
  periodLabel,
}: InstagramAreaDashboardProps) {
  const areaDashboards = useMemo(
    () => computeAreaDashboards(posts, areas, users),
    [posts, areas, users]
  );

  const areasWithPosts = useMemo(
    () => areaDashboards.filter((a) => a.posts > 0),
    [areaDashboards]
  );

  const [activeTab, setActiveTab] = useState<string>(OFFICE_TAB_ID);

  const effectiveActiveTab =
    activeTab === OFFICE_TAB_ID || areasWithPosts.some((a) => a.area === activeTab)
      ? activeTab
      : areasWithPosts[0]?.area ?? OFFICE_TAB_ID;
  const isOfficeView = effectiveActiveTab === OFFICE_TAB_ID;
  const selected = areasWithPosts.find((a) => a.area === effectiveActiveTab);

  const allOfficePosts = useMemo(() => sortPostsByDate(posts), [posts]);
  const filteredOfficePosts = useMemo(
    () => sortPostsByDate(filterByPeriod(allOfficePosts, periodRange)),
    [allOfficePosts, periodRange]
  );

  const allAreaPosts = useMemo(() => {
    if (!selected) return [];
    return sortPostsByDate(filterPostsByArea(posts, selected.area));
  }, [posts, selected]);

  const filteredAreaPosts = useMemo(
    () => sortPostsByDate(filterByPeriod(allAreaPosts, periodRange)),
    [allAreaPosts, periodRange]
  );

  const periodInsight = useMemo(() => {
    if (!selected) return emptyAreaInsight("");
    const dashboards = computeAreaDashboards(filteredAreaPosts, areas, users);
    return dashboards.find((d) => d.area === selected.area) ?? emptyAreaInsight(selected.area);
  }, [filteredAreaPosts, areas, users, selected]);

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Sincronize posts para ver o dashboard do escritório e por área.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seletor de área (mesmo conceito das abas, mantém o filtro de período global) */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-2 min-w-max">
          <Button
            variant={isOfficeView ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(OFFICE_TAB_ID)}
            className={cn("gap-2 rounded-xl shrink-0 h-9", isOfficeView && "bg-[#101f2e] hover:bg-[#101f2e]/90")}
            aria-current={isOfficeView ? "page" : undefined}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Escritório todo</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                isOfficeView ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {posts.length}
            </span>
          </Button>

          {areasWithPosts.map((area) => {
            const Icon = getAreaIcon(area.area);
            const isActive = !isOfficeView && selected?.area === area.area;
            return (
              <Button
                key={area.area}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(area.area)}
                className={cn("gap-2 rounded-xl shrink-0 h-9", isActive && "bg-[#101f2e] hover:bg-[#101f2e]/90")}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="max-w-[140px] truncate">{area.area}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                    isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {area.posts}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {isOfficeView ? (
        <OfficeDetailPanel
          allPosts={allOfficePosts}
          filteredPosts={filteredOfficePosts}
          periodLabel={periodLabel}
          periodRange={periodRange}
          users={users}
          areas={areas}
          accountStats={accountStats}
        />
      ) : selected ? (
        <AreaDetailPanel
          areaName={selected.area}
          allAreaPosts={allAreaPosts}
          filteredAreaPosts={filteredAreaPosts}
          insight={periodInsight}
          periodLabel={periodLabel}
          periodRange={periodRange}
          users={users}
          areas={areas}
          accountStats={accountStats}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Atribua áreas às postagens para ver dashboards por área.
          </p>
        </div>
      )}
    </div>
  );
}
