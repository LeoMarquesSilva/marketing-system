"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ImageIcon,
  Users,
  Share2,
  ExternalLink,
  CalendarRange,
  X,
  Building2,
  Trophy,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Label } from "@/components/ui/label";
import { AreaWithIcon } from "@/components/solicitacoes/area-with-icon";
import { FormerEmployeeBadge } from "@/components/usuarios/former-employee-badge";
import { InstagramBarChart } from "@/components/instagram/instagram-bar-chart";
import { InstagramEngagementMetrics } from "@/components/instagram/instagram-engagement-metrics";
import { InstagramReportExport } from "@/components/instagram/instagram-report-export";
import { getAreaIcon } from "@/lib/area-icons";
import { computeAreaDashboards, computeEngagementActionsByArea, computeEngagementActionsBySolicitante, computeOfficeInsight, computeTopPostsByEngagement } from "@/lib/instagram-analytics";
import {
  getPostAreas,
  getPostSolicitantes,
  isCollabPost,
} from "@/lib/instagram-link-rules";
import { getInstagramMediaLabel } from "@/lib/instagram-media-type";
import { computeEngagementActionsFromPost } from "@/lib/instagram-engagement";
import {
  filterPostsByArea,
  filterPostsByPeriod,
  formatPeriodLabel,
} from "@/lib/instagram-report";
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
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
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

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-black/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
    </div>
  );
}

function AreaPeriodFilter({
  periodFrom,
  periodTo,
  onPeriodFromChange,
  onPeriodToChange,
  onClear,
  totalPosts,
  filteredCount,
  scopeLabel = "da área",
}: {
  periodFrom: string;
  periodTo: string;
  onPeriodFromChange: (value: string) => void;
  onPeriodToChange: (value: string) => void;
  onClear: () => void;
  totalPosts: number;
  filteredCount: number;
  scopeLabel?: string;
}) {
  const periodLabel = formatPeriodLabel(periodFrom, periodTo);
  const hasFilter = Boolean(periodFrom || periodTo);

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          Período
        </div>
        {hasFilter && (
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg" onClick={onClear}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Limpar período
          </Button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Data inicial</Label>
          <DatePickerField
            value={periodFrom}
            onChange={onPeriodFromChange}
            placeholder="Desde..."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Data final</Label>
          <DatePickerField
            value={periodTo}
            onChange={onPeriodToChange}
            placeholder="Até..."
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {hasFilter ? (
          <>
            <span className="font-medium text-foreground">{periodLabel}</span>
            {" · "}
            {filteredCount} de {totalPosts} post{totalPosts !== 1 ? "s" : ""} no período
          </>
        ) : (
          <>Mostrando todos os {totalPosts} posts {scopeLabel} desde 2025</>
        )}
      </p>
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
        "flex gap-3 rounded-xl border border-border/40 bg-white/70 p-3 hover:bg-white transition-colors",
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
      <div className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-muted">
        {(post.thumbnail_url || post.media_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail_url || post.media_url || ""}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
      </div>

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

function TopPostsSection({
  posts,
  users,
  title,
  areaName,
}: {
  posts: InstagramPost[];
  users: User[];
  title: string;
  areaName?: string;
}) {
  const topPosts = useMemo(() => computeTopPostsByEngagement(posts, 5), [posts]);

  return (
    <div className="px-5 py-4 border-b border-border/40">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-600" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      </div>
      {topPosts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum post no período.</p>
      ) : (
        <div className="space-y-2">
          {topPosts.map((post, index) => (
            <PostListRow
              key={post.id}
              post={post}
              users={users}
              areaName={areaName}
              rank={index + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfficeDetailPanel({
  allPosts,
  filteredPosts,
  periodFrom,
  periodTo,
  onPeriodFromChange,
  onPeriodToChange,
  onClearPeriod,
  users,
  areas,
  accountStats,
}: {
  allPosts: InstagramPost[];
  filteredPosts: InstagramPost[];
  periodFrom: string;
  periodTo: string;
  onPeriodFromChange: (value: string) => void;
  onPeriodToChange: (value: string) => void;
  onClearPeriod: () => void;
  users: User[];
  areas: Area[];
  accountStats: InstagramAccountStats | null;
}) {
  const insight = useMemo(() => computeOfficeInsight(filteredPosts), [filteredPosts]);
  const collabCount = filteredPosts.filter(isCollabPost).length;
  const periodLabel = formatPeriodLabel(periodFrom, periodTo);

  const chartByArea = useMemo(
    () => computeEngagementActionsByArea(filteredPosts),
    [filteredPosts]
  );

  const chartByAuthor = useMemo(
    () => computeEngagementActionsBySolicitante(filteredPosts, users),
    [filteredPosts, users]
  );

  const reportFilterDescription = [
    "Escritório todo",
    periodLabel ? `Período: ${periodLabel}` : "Todos os posts desde 2025",
  ].join(" · ");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-white/90 via-white/70 to-white/50 backdrop-blur-xl shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-border/40 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-5 w-5 text-[#101f2e]" />
                Escritório todo
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""} no período
                {collabCount > 0 && ` · ${collabCount} collab`}
              </p>
            </div>
            <InstagramReportExport
              posts={filteredPosts}
              areas={areas}
              users={users}
              accountStats={accountStats}
              filterDescription={reportFilterDescription}
              compact
              dialogTitle="Relatório — Escritório todo"
            />
          </div>

          <AreaPeriodFilter
            periodFrom={periodFrom}
            periodTo={periodTo}
            onPeriodFromChange={onPeriodFromChange}
            onPeriodToChange={onPeriodToChange}
            onClear={onClearPeriod}
            totalPosts={allPosts.length}
            filteredCount={filteredPosts.length}
            scopeLabel="do escritório"
          />

          {filteredPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-white/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum post no período selecionado.
              </p>
            </div>
          ) : (
            <>
              <InstagramEngagementMetrics
                variant="hero"
                reach={insight.reach}
                likes={insight.likes}
                comments={insight.comments}
                saves={insight.saves}
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Metric icon={<ImageIcon className="h-3 w-3" />} label="Posts" value={String(insight.posts)} />
                <Metric icon={<Users className="h-3 w-3" />} label="Views" value={formatNumber(insight.views)} />
                <Metric
                  icon={<Share2 className="h-3 w-3" />}
                  label="Shares"
                  value={formatNumber(filteredPosts.reduce((s, p) => s + p.shares, 0))}
                />
                <Metric
                  icon={<Building2 className="h-3 w-3" />}
                  label="Áreas"
                  value={String(new Set(filteredPosts.flatMap(getPostAreas)).size)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Média {formatNumber(Math.round(insight.avgEngagementActions))} ações de engajamento/post
              </p>
            </>
          )}
        </div>

        {filteredPosts.length > 0 && (
          <>
            <div className="grid lg:grid-cols-2 gap-4 p-5 border-b border-border/40">
              <InstagramBarChart
                title="Ações de engajamento por área"
                data={chartByArea}
                useAreaIcons
                emptyMessage="Atribua áreas às postagens para ver este gráfico."
              />
              <InstagramBarChart
                title="Ações de engajamento por autor"
                data={chartByAuthor}
                emptyMessage="Atribua autores às postagens para ver este gráfico."
              />
            </div>

            <TopPostsSection
              posts={filteredPosts}
              users={users}
              title="Top 5 posts do escritório"
            />

            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Todos os posts ({filteredPosts.length})
              </h4>
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filteredPosts.map((post) => (
                  <PostListRow key={post.id} post={post} users={users} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AreaDetailPanel({
  areaName,
  allAreaPosts,
  filteredAreaPosts,
  insight,
  periodFrom,
  periodTo,
  onPeriodFromChange,
  onPeriodToChange,
  onClearPeriod,
  users,
  areas,
  accountStats,
}: {
  areaName: string;
  allAreaPosts: InstagramPost[];
  filteredAreaPosts: InstagramPost[];
  insight: ReturnType<typeof computeAreaDashboards>[number];
  periodFrom: string;
  periodTo: string;
  onPeriodFromChange: (value: string) => void;
  onPeriodToChange: (value: string) => void;
  onClearPeriod: () => void;
  users: User[];
  areas: Area[];
  accountStats: InstagramAccountStats | null;
}) {
  const collabCount = filteredAreaPosts.filter(isCollabPost).length;
  const totalLikes = filteredAreaPosts.reduce((s, p) => s + p.likes, 0);
  const totalComments = filteredAreaPosts.reduce((s, p) => s + p.comments, 0);
  const totalSaves = filteredAreaPosts.reduce((s, p) => s + p.saves, 0);
  const periodLabel = formatPeriodLabel(periodFrom, periodTo);

  const chartByAuthor = useMemo(() => {
    const map = new Map<string, { total: number; name: string; isFormerEmployee: boolean }>();
    for (const post of filteredAreaPosts) {
      const actions = computeEngagementActionsFromPost(post);
      for (const s of getPostSolicitantes(post)) {
        const user = users.find((u) => u.id === s.id);
        const name = user?.name ?? s.name;
        const current = map.get(s.id) ?? {
          total: 0,
          name,
          isFormerEmployee: user ? !isUserActive(user) : false,
        };
        map.set(s.id, {
          total: current.total + actions,
          name,
          isFormerEmployee: current.isFormerEmployee,
        });
      }
    }
    return Array.from(map.values())
      .map(({ name, total, isFormerEmployee }) => ({
        label: name,
        total,
        isFormerEmployee,
        sublabel: isFormerEmployee ? "Ex-funcionário" : undefined,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredAreaPosts, users]);

  const chartByFormat = useMemo(() => {
    const map = new Map<string, number>();
    for (const post of filteredAreaPosts) {
      const label = getInstagramMediaLabel(post.media_type);
      map.set(label, (map.get(label) ?? 0) + computeEngagementActionsFromPost(post));
    }
    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredAreaPosts]);

  const collaboratorsWithPosts = insight.collaborators.filter((c) => c.posts > 0);

  const reportFilterDescription = [
    `Área: ${areaName}`,
    periodLabel ? `Período: ${periodLabel}` : "Todos os posts vinculados",
  ].join(" · ");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-white/90 via-white/70 to-white/50 backdrop-blur-xl shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-border/40 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <AreaWithIcon area={areaName} className="text-lg font-semibold" />
              <p className="text-sm text-muted-foreground mt-1">
                {filteredAreaPosts.length} post{filteredAreaPosts.length !== 1 ? "s" : ""} no período
                {collabCount > 0 && ` · ${collabCount} collab`}
              </p>
            </div>
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
          </div>

          <AreaPeriodFilter
            periodFrom={periodFrom}
            periodTo={periodTo}
            onPeriodFromChange={onPeriodFromChange}
            onPeriodToChange={onPeriodToChange}
            onClear={onClearPeriod}
            totalPosts={allAreaPosts.length}
            filteredCount={filteredAreaPosts.length}
          />

          {filteredAreaPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-white/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum post nesta área no período selecionado.
              </p>
            </div>
          ) : (
            <>
              <InstagramEngagementMetrics
                variant="hero"
                reach={insight.reach}
                likes={totalLikes}
                comments={totalComments}
                saves={totalSaves}
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Metric icon={<ImageIcon className="h-3 w-3" />} label="Posts" value={String(insight.posts)} />
                <Metric icon={<Users className="h-3 w-3" />} label="Views" value={formatNumber(insight.views)} />
                <Metric
                  icon={<Share2 className="h-3 w-3" />}
                  label="Shares"
                  value={formatNumber(filteredAreaPosts.reduce((s, p) => s + p.shares, 0))}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Média {formatNumber(Math.round(insight.avgEngagementActions))} ações de engajamento/post ·{" "}
                {collaboratorsWithPosts.length} colaborador
                {collaboratorsWithPosts.length !== 1 ? "es" : ""} com posts
              </p>
            </>
          )}
        </div>

        {filteredAreaPosts.length > 0 && (
          <>
            <div className="grid lg:grid-cols-2 gap-4 p-5 border-b border-border/40">
              <InstagramBarChart
                title="Ações de engajamento por colaborador"
                data={chartByAuthor}
                emptyMessage="Nenhum autor vinculado nesta área."
              />
              <InstagramBarChart
                title="Ações de engajamento por formato"
                data={chartByFormat}
                emptyMessage="Sem posts nesta área."
              />
            </div>

            <div className="px-5 py-4 border-b border-border/40">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Colaboradores ({collaboratorsWithPosts.length})
              </h4>
              {collaboratorsWithPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum colaborador com posts nesta área.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {collaboratorsWithPosts.map((collab) => (
                    <div
                      key={collab.userId}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-border/40 bg-white/60 px-3 py-2.5",
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
                          {formatNumber(collab.engagementActions)} ações ·{" "}
                          {formatNumber(collab.reach)} alcance
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <TopPostsSection
              posts={filteredAreaPosts}
              users={users}
              title={`Top 5 posts — ${areaName}`}
              areaName={areaName}
            />

            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Todos os posts da área ({filteredAreaPosts.length})
              </h4>
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filteredAreaPosts.map((post) => (
                  <PostListRow
                    key={post.id}
                    post={post}
                    users={users}
                    areaName={areaName}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function InstagramAreaDashboard({
  posts,
  areas,
  users,
  accountStats,
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
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  useEffect(() => {
    if (activeTab === OFFICE_TAB_ID) return;
    if (!areasWithPosts.some((a) => a.area === activeTab)) {
      setActiveTab(areasWithPosts.length > 0 ? areasWithPosts[0].area : OFFICE_TAB_ID);
    }
  }, [areasWithPosts, activeTab]);

  useEffect(() => {
    setPeriodFrom("");
    setPeriodTo("");
  }, [activeTab]);

  const isOfficeView = activeTab === OFFICE_TAB_ID;
  const selected = areasWithPosts.find((a) => a.area === activeTab);

  const allOfficePosts = useMemo(() => sortPostsByDate(posts), [posts]);

  const filteredOfficePosts = useMemo(
    () => sortPostsByDate(filterPostsByPeriod(allOfficePosts, periodFrom, periodTo)),
    [allOfficePosts, periodFrom, periodTo]
  );

  const allAreaPosts = useMemo(() => {
    if (!selected) return [];
    return sortPostsByDate(filterPostsByArea(posts, selected.area));
  }, [posts, selected]);

  const filteredAreaPosts = useMemo(
    () => sortPostsByDate(filterPostsByPeriod(allAreaPosts, periodFrom, periodTo)),
    [allAreaPosts, periodFrom, periodTo]
  );

  const periodInsight = useMemo(() => {
    if (!selected) return emptyAreaInsight("");
    const dashboards = computeAreaDashboards(filteredAreaPosts, areas, users);
    return dashboards.find((d) => d.area === selected.area) ?? emptyAreaInsight(selected.area);
  }, [filteredAreaPosts, areas, users, selected]);

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-white/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Sincronize posts para ver o dashboard do escritório e por área.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Dashboard Instagram</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral do escritório ou detalhe por área — filtre por período e veja o top 5.
        </p>
      </div>

      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-2 min-w-max border-b border-border/60 pb-3">
          <Button
            variant={isOfficeView ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(OFFICE_TAB_ID)}
            className={cn(
              "gap-2 rounded-xl shrink-0 h-9",
              isOfficeView && "bg-[#101f2e] hover:bg-[#101f2e]/90"
            )}
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
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(area.area)}
                className={cn(
                  "gap-2 rounded-xl shrink-0 h-9",
                  isActive && "bg-[#101f2e] hover:bg-[#101f2e]/90"
                )}
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
          periodFrom={periodFrom}
          periodTo={periodTo}
          onPeriodFromChange={setPeriodFrom}
          onPeriodToChange={setPeriodTo}
          onClearPeriod={() => {
            setPeriodFrom("");
            setPeriodTo("");
          }}
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
          periodFrom={periodFrom}
          periodTo={periodTo}
          onPeriodFromChange={setPeriodFrom}
          onPeriodToChange={setPeriodTo}
          onClearPeriod={() => {
            setPeriodFrom("");
            setPeriodTo("");
          }}
          users={users}
          areas={areas}
          accountStats={accountStats}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-white/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Atribua áreas às postagens para ver dashboards por área.
          </p>
        </div>
      )}
    </div>
  );
}
