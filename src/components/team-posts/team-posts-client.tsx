"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Eye,
  ImageIcon,
  Lock,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  PeriodComparisonGrid,
  PostListRow,
  TopPostsList,
} from "@/components/instagram/instagram-area-dashboard";
import { InstagramPeriodPicker } from "@/components/instagram/instagram-period-picker";
import { InstagramReportExport } from "@/components/instagram/instagram-report-export";
import { KpiCard, SectionCard } from "@/components/instagram/instagram-section-card";
import { AreaIcon } from "@/lib/area-icons";
import type { Area } from "@/lib/areas";
import {
  computeAggregateEngagementRate,
  formatEngagementRate,
} from "@/lib/instagram-engagement";
import { getPostSolicitantes } from "@/lib/instagram-link-rules";
import {
  filterByPeriod,
  formatPeriodFilterLabel,
  getAvailableYears,
  resolvePeriodRange,
  type PeriodFilter,
} from "@/lib/instagram-period";
import type { TeamReportRow } from "@/lib/instagram-report";
import {
  computeTeamMemberStats,
  personInAreas,
  scopeTeamPosts,
  type TeamMemberStats,
} from "@/lib/team-posts/domain";
import type { TeamPostsPageData } from "@/lib/team-posts/server";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";
import { MediaSlideBlock } from "./media-slide-block";

const ALL_AREAS = "all";

type ReadyData = Extract<TeamPostsPageData, { status: "ready" }>;

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toReportRow(row: TeamMemberStats): TeamReportRow {
  return {
    name: row.name,
    area: row.area,
    posts: row.posts,
    reels: row.reels,
    reach: row.reach,
    views: row.views,
    engagementActions: row.engagementActions,
    engagementRate: row.engagementRate,
    lastPostDate: row.lastPostAt ? new Date(row.lastPostAt).toLocaleDateString("pt-BR") : "",
  };
}

function StatePanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-lg border border-border/50 bg-white/70 px-6 py-12 text-center shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export function TeamPostsClient({ data }: { data: TeamPostsPageData }) {
  if (data.status === "denied") {
    return (
      <StatePanel icon={<Lock className="h-5 w-5" />} title="Sem acesso às postagens da equipe">
        Esta página é para coordenadores, gestores e sócios acompanharem os posts da própria área.
        Se você lidera uma equipe e não está vendo os dados, peça ao administrador para conferir
        sua liderança por área em Usuários.
      </StatePanel>
    );
  }
  if (data.status === "error") {
    return (
      <StatePanel icon={<AlertTriangle className="h-5 w-5" />} title="Não foi possível carregar as postagens">
        {data.message} Tente recarregar a página em alguns instantes.
      </StatePanel>
    );
  }
  return <TeamPostsDashboard data={data} />;
}

function TeamPostsDashboard({ data }: { data: ReadyData }) {
  const { areaOptions, members, posts, office, accountStats, allAreas } = data;
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({ kind: "preset", preset: "this_year" });
  const [areaKey, setAreaKey] = useState<string>(ALL_AREAS);
  const [memberId, setMemberId] = useState<string | null>(null);

  const periodRange = useMemo(() => resolvePeriodRange(periodFilter), [periodFilter]);
  const periodLabel = formatPeriodFilterLabel(periodFilter);
  const availableYears = useMemo(() => getAvailableYears(posts), [posts]);

  const selectedArea = areaOptions.find((option) => option.key === areaKey) ?? null;
  const scopeLabel = selectedArea
    ? selectedArea.label
    : allAreas
      ? "Todas as áreas"
      : areaOptions.map((option) => option.label).join(", ");

  const scopedMembers = useMemo(
    () => (selectedArea ? members.filter((m) => personInAreas(m, new Set([selectedArea.key]))) : members),
    [members, selectedArea]
  );

  const scopedPosts = useMemo(() => {
    if (!selectedArea) return posts;
    return scopeTeamPosts(posts, new Set([selectedArea.key]), new Set(scopedMembers.map((m) => m.id)));
  }, [posts, selectedArea, scopedMembers]);

  const periodPosts = useMemo(
    () =>
      [...filterByPeriod(scopedPosts, periodRange)].sort(
        (a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()
      ),
    [scopedPosts, periodRange]
  );

  const stats = useMemo(() => computeTeamMemberStats(periodPosts, scopedMembers), [periodPosts, scopedMembers]);
  const membersWithPosts = stats.filter((row) => row.posts > 0).length;
  const reels = periodPosts.filter((post) => post.media_type === "VIDEO").length;
  const reach = periodPosts.reduce((sum, post) => sum + post.reach, 0);
  const teamRate = computeAggregateEngagementRate(periodPosts);

  const officeBenchmark = useMemo(() => {
    const inPeriod = filterByPeriod(office, periodRange);
    const officeReach = inPeriod.reduce((sum, point) => sum + point.reach, 0);
    const actions = inPeriod.reduce((sum, point) => sum + point.engagementActions, 0);
    return {
      rate: officeReach > 0 ? (actions / officeReach) * 100 : 0,
      avgReach: inPeriod.length > 0 ? Math.round(officeReach / inPeriod.length) : 0,
    };
  }, [office, periodRange]);

  const selectedMember = stats.find((row) => row.id === memberId) ?? null;
  const listedPosts = selectedMember
    ? periodPosts.filter((post) => getPostSolicitantes(post).some((author) => author.id === selectedMember.id))
    : periodPosts;

  // Formatos que os componentes do Instagram Insights já consomem.
  const reportUsers = useMemo<User[]>(
    () =>
      members.map((m) => ({
        id: m.id,
        name: m.name,
        email: null,
        department: m.area,
        avatar_url: m.avatar_url,
        is_active: true,
      })),
    [members]
  );
  const reportAreas = useMemo<Area[]>(
    () => areaOptions.map((option) => ({ id: option.key, name: option.label })),
    [areaOptions]
  );
  const teamReportRows = useMemo(() => stats.map(toReportRow), [stats]);

  const selectArea = (key: string) => {
    setAreaKey(key);
    setMemberId(null);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Desempenho no Instagram (@{accountStats?.username ?? "bismarchipires"}) dos posts da sua equipe:
          posts marcados com a área ou com alguém da equipe como autor. Os vínculos são feitos pelo Marketing.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <InstagramPeriodPicker
            value={periodFilter}
            onChange={(next) => {
              setPeriodFilter(next);
              setMemberId(null);
            }}
            availableYears={availableYears}
          />
          <InstagramReportExport
            posts={periodPosts}
            areas={reportAreas}
            users={reportUsers}
            accountStats={accountStats}
            filterDescription={`Equipe: ${scopeLabel} · Período: ${periodLabel}`}
            focusArea={selectedArea?.label}
            reportTitle={`Relatório de postagens da equipe — ${scopeLabel}`}
            dialogTitle={`Relatório — ${scopeLabel}`}
            team={teamReportRows}
            filenameBase={`postagens-equipe-${slugify(selectedArea?.label ?? "todas")}-${new Date().toISOString().slice(0, 10)}`}
            excelLabel="Relatório (Excel)"
            compact
          />
        </div>
      </div>

      {areaOptions.length > 1 && (
        <div className="-mx-1 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por área">
          <div className="flex min-w-max gap-2">
            {[{ key: ALL_AREAS, label: allAreas ? "Todas as áreas" : "Todas as minhas áreas" }, ...areaOptions].map(
              (option) => {
                const active = areaKey === option.key;
                return (
                  <Button
                    key={option.key}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    aria-pressed={active}
                    onClick={() => selectArea(option.key)}
                    className={cn(
                      "h-9 shrink-0 gap-2 rounded-lg",
                      active && "bg-[#347796] text-white hover:bg-[#285f7a] hover:text-white"
                    )}
                  >
                    {option.key === ALL_AREAS ? (
                      <Users className="h-3.5 w-3.5" />
                    ) : (
                      <AreaIcon area={option.label} className="h-3.5 w-3.5" />
                    )}
                    {option.label}
                  </Button>
                );
              }
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Posts publicados"
          value={periodPosts.length}
          sub={`${reels} reel${reels !== 1 ? "s" : ""} · ${periodLabel}`}
          icon={<ImageIcon className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Alcance"
          value={formatNumber(reach)}
          sub={`Média ${formatNumber(periodPosts.length ? Math.round(reach / periodPosts.length) : 0)} por post · escritório ${formatNumber(officeBenchmark.avgReach)}`}
          icon={<Eye className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Taxa de engajamento"
          value={formatEngagementRate(teamRate)}
          sub={`Escritório no período: ${formatEngagementRate(officeBenchmark.rate)}`}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Quem publicou"
          value={`${membersWithPosts} de ${stats.length}`}
          sub="colaboradores com post no período"
          icon={<Users className="h-3.5 w-3.5" />}
        />
      </div>

      <MediaSlideBlock
        // Novo recorte (área ou período) refaz a pré-seleção.
        key={`${areaKey}|${periodLabel}`}
        posts={periodPosts}
        periodLabel={periodLabel}
        filenameBase={`midias-${slugify(selectedArea?.label ?? "equipe")}-${slugify(periodLabel)}`}
      />

      {periodRange && (
        <SectionCard title="Comparativo" description="Posts da equipe neste período contra o período anterior de mesma duração">
          <PeriodComparisonGrid posts={scopedPosts} periodRange={periodRange} />
        </SectionCard>
      )}

      <SectionCard
        title={`Equipe (${stats.length})`}
        description="Posts com a pessoa como autora. Clique em alguém para ver só os posts dela."
        noPadding
      >
        {stats.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Nenhum colaborador ativo encontrado nesta área.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-5 py-2.5 font-semibold">Colaborador</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Posts</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Reels</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Alcance</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Taxa de eng.</th>
                  <th className="px-5 py-2.5 font-semibold">Último post</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => {
                  const active = row.id === memberId;
                  const idle = row.posts === 0;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border/30 last:border-b-0",
                        active ? "bg-[#47cdd0]/10" : "hover:bg-muted/40"
                      )}
                    >
                      <td className="px-5 py-2">
                        <button
                          type="button"
                          disabled={idle}
                          aria-pressed={active}
                          onClick={() => setMemberId(active ? null : row.id)}
                          className="flex min-h-9 w-full items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0] disabled:cursor-default"
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={row.avatar_url || undefined} />
                            <AvatarFallback className="text-[11px]">{getInitials(row.name)}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0">
                            <span className={cn("block truncate font-medium", idle && "text-muted-foreground")}>
                              {row.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{row.area}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.posts}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.reels}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{idle ? "—" : formatNumber(row.reach)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {idle ? "—" : formatEngagementRate(row.engagementRate)}
                      </td>
                      <td className="px-5 py-2 text-xs text-muted-foreground">
                        {idle ? "Sem posts no período" : formatShortDate(row.lastPostAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Top 5 posts"
        description="Ranking por ações de engajamento no período"
        action={<Trophy className="h-4 w-4 text-amber-600" />}
      >
        <TopPostsList posts={periodPosts} users={reportUsers} />
      </SectionCard>

      <SectionCard
        title={selectedMember ? `Posts de ${selectedMember.name} (${listedPosts.length})` : `Todos os posts (${listedPosts.length})`}
        description={periodLabel}
        action={
          selectedMember ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg" onClick={() => setMemberId(null)}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Ver todos
            </Button>
          ) : undefined
        }
      >
        {listedPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum post da equipe no período selecionado.</p>
        ) : (
          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {listedPosts.map((post) => (
              <PostListRow key={post.id} post={post} users={reportUsers} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
