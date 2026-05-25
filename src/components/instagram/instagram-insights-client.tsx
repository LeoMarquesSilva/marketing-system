"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Users,
  ImageIcon,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  TrendingUp,
  ExternalLink,
  Loader2,
  Instagram,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AreaSelectWithCreate } from "@/components/usuarios/area-select-with-create";
import { AreaWithIcon } from "@/components/solicitacoes/area-with-icon";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import type { Area } from "@/lib/areas";
import type { User } from "@/lib/users";
import type { InstagramAccountStats, InstagramPost } from "@/lib/instagram-posts";
import {
  computeAreaDashboards,
  computeInteractionsByArea,
  computeInteractionsBySolicitante,
  paginateItems,
} from "@/lib/instagram-analytics";
import { InstagramAreaDashboard } from "@/components/instagram/instagram-area-dashboard";
import { InstagramBarChart } from "@/components/instagram/instagram-bar-chart";
import { InstagramPagination } from "@/components/instagram/instagram-pagination";
import {
  isInstitutionalArea,
  isPostFullyLinked,
  isPostPendingLink,
  getPendingLinkLabels,
} from "@/lib/instagram-link-rules";
import { getInstagramMediaLabel, INSTAGRAM_MEDIA_TYPE_FILTERS } from "@/lib/instagram-media-type";
import { postHasTag } from "@/lib/instagram-post-tags";
import { cn } from "@/lib/utils";

const SYNC_SINCE = "2025-01-01T00:00:00.000Z";
const DEFAULT_PAGE_SIZE = 10;

interface InstagramInsightsClientProps {
  initialPosts: InstagramPost[];
  initialAccountStats: InstagramAccountStats | null;
  initialAreas: Area[];
  initialUsers: User[];
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

function truncateCaption(caption: string | null, max = 120) {
  if (!caption) return "Sem legenda";
  const line = caption.split("\n")[0];
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type LinkFilter = "all" | "pendentes" | "vinculados";

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/40 dark:border-border/50 bg-white/70 dark:bg-card/80 backdrop-blur-sm p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#101f2e]/8 text-[#101f2e]/60">
          {icon}
        </span>
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

function MetricPill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]" title={label}>
      <div className="flex items-center gap-1 text-muted-foreground">{icon}</div>
      <span className="text-sm font-semibold tabular-nums">{formatNumber(value)}</span>
    </div>
  );
}

export function InstagramInsightsClient({
  initialPosts,
  initialAccountStats,
  initialAreas,
  initialUsers,
}: InstagramInsightsClientProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [accountStats, setAccountStats] = useState(initialAccountStats);
  const [areas, setAreas] = useState(initialAreas);
  const [users] = useState(initialUsers);
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [solicitanteFilter, setSolicitanteFilter] = useState<string>("all");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("pendentes");
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ synced: number; page: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const linkCounts = useMemo(() => {
    const vinculados = posts.filter(isPostFullyLinked).length;
    const pendentes = posts.filter(isPostPendingLink).length;
    return { vinculados, pendentes };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (linkFilter === "pendentes" && !isPostPendingLink(p)) return false;
      if (linkFilter === "vinculados" && !isPostFullyLinked(p)) return false;
      if (areaFilter === "sem_area" && p.area) return false;
      if (areaFilter !== "all" && areaFilter !== "sem_area" && p.area !== areaFilter) return false;
      if (mediaTypeFilter !== "all" && p.media_type !== mediaTypeFilter) return false;
      if (tagFilter === "Newsletter" && !postHasTag(p.tags, "Newsletter")) return false;
      if (tagFilter === "sem_tag" && (p.tags?.length ?? 0) > 0) return false;
      if (solicitanteFilter === "sem_solicitante" && p.solicitante_id) return false;
      if (solicitanteFilter !== "all" && solicitanteFilter !== "sem_solicitante" && p.solicitante_id !== solicitanteFilter) return false;
      return true;
    });
  }, [posts, areaFilter, mediaTypeFilter, tagFilter, solicitanteFilter, linkFilter]);

  const kpis = useMemo(() => {
    const withArea = filteredPosts.filter((p) => p.area);
    const withSolicitante = filteredPosts.filter((p) => p.solicitante_id);
    const totalReach = filteredPosts.reduce((s, p) => s + p.reach, 0);
    const totalViews = filteredPosts.reduce((s, p) => s + p.views, 0);
    const totalInteractions = filteredPosts.reduce((s, p) => s + p.total_interactions, 0);
    const avgEngagement =
      filteredPosts.length > 0 ? totalInteractions / filteredPosts.length : 0;

    return { withArea: withArea.length, withSolicitante: withSolicitante.length, totalReach, totalViews, avgEngagement };
  }, [filteredPosts]);

  const chartByArea = useMemo(
    () => computeInteractionsByArea(filteredPosts),
    [filteredPosts]
  );

  const chartBySolicitante = useMemo(
    () => computeInteractionsBySolicitante(filteredPosts, users),
    [filteredPosts, users]
  );

  const areaDashboards = useMemo(
    () => computeAreaDashboards(filteredPosts, areas, users),
    [filteredPosts, areas, users]
  );

  const pagination = useMemo(
    () => paginateItems(filteredPosts, page, pageSize),
    [filteredPosts, page, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [areaFilter, mediaTypeFilter, tagFilter, solicitanteFilter, linkFilter]);

  const reloadPosts = useCallback(async () => {
    await fetch("/api/instagram/tags/refresh", { method: "POST" });
    const listRes = await fetch("/api/instagram/posts");
    const listJson = await listRes.json();
    if (listRes.ok) {
      setPosts(listJson.posts ?? []);
      setAccountStats(listJson.accountStats ?? null);
    }
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncProgress({ synced: 0, page: 0 });

    try {
      let after: string | undefined;
      let totalSynced = 0;
      let page = 0;

      while (true) {
        page++;
        const res = await fetch("/api/instagram/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ since: SYNC_SINCE, after }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao sincronizar");

        totalSynced += json.synced ?? 0;
        setSyncProgress({ synced: totalSynced, page });

        if (!json.hasMore || !json.nextAfter) break;
        after = json.nextAfter;
      }

      await reloadPosts();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [reloadPosts]);

  const handleAssignmentChange = useCallback(
    async (
      postId: string,
      patch: {
        area?: string | null;
        solicitante_id?: string | null;
        solicitante?: string | null;
      }
    ) => {
      setSavingPostId(postId);
      try {
        const res = await fetch(`/api/instagram/posts/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");

        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== postId) return p;
            return {
              ...p,
              ...(patch.area !== undefined ? { area: patch.area || null } : {}),
              ...(patch.solicitante_id !== undefined
                ? { solicitante_id: patch.solicitante_id || null }
                : {}),
              ...(patch.solicitante !== undefined
                ? { solicitante: patch.solicitante || null }
                : {}),
            };
          })
        );
      } catch (err) {
        console.error(err);
      } finally {
        setSavingPostId(null);
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-xl bg-[#101f2e] hover:bg-[#101f2e]/90"
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {syncing
            ? syncProgress
              ? `Sincronizando… ${syncProgress.synced} posts (pág. ${syncProgress.page})`
              : "Sincronizando…"
            : "Sincronizar desde 2025"}
        </Button>

        <Select value={linkFilter} onValueChange={(v) => setLinkFilter(v as LinkFilter)}>
          <SelectTrigger className="w-[220px] rounded-xl">
            <SelectValue placeholder="Status do vínculo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os posts</SelectItem>
            <SelectItem value="pendentes">
              Pendentes de vínculo ({linkCounts.pendentes})
            </SelectItem>
            <SelectItem value="vinculados">
              Já vinculados ({linkCounts.vinculados})
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-[170px] rounded-xl">
            <SelectValue placeholder="Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tags</SelectItem>
            <SelectItem value="Newsletter">Newsletter</SelectItem>
            <SelectItem value="sem_tag">Sem tags</SelectItem>
          </SelectContent>
        </Select>

        <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
          <SelectTrigger className="w-[160px] rounded-xl">
            <SelectValue placeholder="Formato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os formatos</SelectItem>
            {INSTAGRAM_MEDIA_TYPE_FILTERS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[190px] rounded-xl">
            <SelectValue placeholder="Filtrar por área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            <SelectItem value="sem_area">Sem área definida</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.name}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={solicitanteFilter} onValueChange={setSolicitanteFilter}>
          <SelectTrigger className="w-[210px] rounded-xl">
            <SelectValue placeholder="Filtrar por solicitante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os solicitantes</SelectItem>
            <SelectItem value="sem_solicitante">Sem solicitante</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {accountStats && (
          <span className="text-sm text-muted-foreground ml-auto flex items-center gap-1.5">
            <Instagram className="h-4 w-4" />@{accountStats.username}
            <span className="text-muted-foreground/50">·</span>
            Atualizado {formatDate(accountStats.fetched_at)}
          </span>
        )}
      </div>

      {syncError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {syncError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Seguidores"
          value={formatNumber(accountStats?.followers_count ?? 0)}
          sub="conta @bismarchipires"
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Posts desde 2025"
          value={formatNumber(posts.length)}
          sub={`${accountStats?.media_count ?? 0} no total da conta`}
          icon={<ImageIcon className="h-4 w-4" />}
        />
        <KpiCard
          label="Alcance total"
          value={formatNumber(kpis.totalReach)}
          sub={`${formatNumber(kpis.totalViews)} visualizações`}
          icon={<Eye className="h-4 w-4" />}
        />
        <KpiCard
          label="Interações médias"
          value={formatNumber(Math.round(kpis.avgEngagement))}
          sub={`${kpis.withArea} c/ área · ${kpis.withSolicitante} c/ solicitante`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InstagramBarChart
          title="Interações por área"
          data={chartByArea}
          useAreaIcons
          emptyMessage="Atribua áreas às postagens para ver este gráfico."
        />
        <InstagramBarChart
          title="Interações por solicitante"
          data={chartBySolicitante}
          emptyMessage="Atribua solicitantes às postagens para ver este gráfico."
        />
      </div>

      <InstagramAreaDashboard areas={areaDashboards} />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Postagens</h3>
          {filteredPosts.length > 0 && (
            <InstagramPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              start={pagination.start}
              end={pagination.end}
              pageSize={pagination.pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </div>

      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-white/50 p-12 text-center">
          <Instagram className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground mb-4">
            {posts.length === 0
              ? "Nenhum post sincronizado desde 2025. Clique em \"Sincronizar desde 2025\" para importar."
              : linkFilter === "pendentes"
                ? "Todos os posts já estão vinculados (área e solicitante quando exigido)."
                : linkFilter === "vinculados"
                  ? "Nenhum post vinculado ainda. Use o filtro \"Pendentes\" para preencher."
                  : "Nenhum post corresponde aos filtros selecionados."}
          </p>
          {posts.length === 0 ? (
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="rounded-xl">
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sincronizar agora
            </Button>
          ) : linkFilter !== "all" ? (
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setLinkFilter("all")}
            >
              Ver todos os posts
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {pagination.items.map((post) => {
            const solicitanteUser = post.solicitante_id
              ? users.find((u) => u.id === post.solicitante_id)
              : null;

            return (
              <article
                key={post.id}
                className={cn(
                  "rounded-2xl border border-white/60 bg-gradient-to-br from-white/90 via-white/70 to-white/50",
                  "backdrop-blur-xl shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] overflow-hidden",
                  "transition-all hover:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.12)] hover:-translate-y-0.5"
                )}
              >
                <div className="flex flex-col md:flex-row">
                  <div className="relative md:w-48 lg:w-56 shrink-0 aspect-square md:aspect-auto md:min-h-[180px] bg-muted">
                    {(post.thumbnail_url || post.media_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.thumbnail_url || post.media_url || ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 rounded-full bg-black/60 text-white border-0 text-[10px]">
                      {getInstagramMediaLabel(post.media_type)}
                    </Badge>
                  </div>

                  <div className="flex-1 p-5 flex flex-col gap-4 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {isPostPendingLink(post) &&
                            getPendingLinkLabels(post).map((label) => (
                              <Badge
                                key={label}
                                variant="outline"
                                className="rounded-full text-amber-700 border-amber-300 bg-amber-50 text-[10px] capitalize"
                              >
                                Falta {label}
                              </Badge>
                            ))}
                          {(post.tags ?? []).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className={cn(
                                "rounded-full text-[10px]",
                                tag === "Newsletter"
                                  ? "text-violet-700 border-violet-300 bg-violet-50"
                                  : tag.startsWith("Edição #")
                                    ? "text-indigo-700 border-indigo-300 bg-indigo-50"
                                    : "text-[#101f2e] border-[#101f2e]/20 bg-[#101f2e]/5"
                              )}
                            >
                              {tag}
                            </Badge>
                          ))}
                          {isPostFullyLinked(post) && (
                            <Badge variant="outline" className="rounded-full text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
                              Vinculado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                          {truncateCaption(post.caption, 200)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {formatDate(post.published_at)}
                        </p>
                      </div>
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Abrir no Instagram"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 py-2 px-3 rounded-xl bg-black/[0.03]">
                      <MetricPill icon={<Eye className="h-3.5 w-3.5" />} value={post.views} label="Visualizações" />
                      <MetricPill icon={<Users className="h-3.5 w-3.5" />} value={post.reach} label="Alcance" />
                      <MetricPill icon={<Heart className="h-3.5 w-3.5" />} value={post.likes} label="Curtidas" />
                      <MetricPill icon={<MessageCircle className="h-3.5 w-3.5" />} value={post.comments} label="Comentários" />
                      <MetricPill icon={<Share2 className="h-3.5 w-3.5" />} value={post.shares} label="Compartilhamentos" />
                      <MetricPill icon={<Bookmark className="h-3.5 w-3.5" />} value={post.saves} label="Salvos" />
                      <MetricPill icon={<TrendingUp className="h-3.5 w-3.5" />} value={post.total_interactions} label="Interações" />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 pt-1 border-t border-border/40">
                      <div className="min-w-0">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                          Área responsável
                        </label>
                        <div className="relative">
                          {savingPostId === post.id && (
                            <Loader2 className="absolute right-10 top-2.5 h-4 w-4 animate-spin text-muted-foreground z-10" />
                          )}
                          <AreaSelectWithCreate
                            areas={areas}
                            value={post.area ?? ""}
                            onValueChange={(val) => {
                              const patch: {
                                area: string | null;
                                solicitante_id?: string | null;
                                solicitante?: string | null;
                              } = { area: val || null };

                              if (post.solicitante_id && val && !isInstitutionalArea(val)) {
                                const user = users.find((u) => u.id === post.solicitante_id);
                                if (user && user.department !== val) {
                                  patch.solicitante_id = null;
                                  patch.solicitante = null;
                                }
                              }

                              handleAssignmentChange(post.id, patch);
                            }}
                            onAreasChange={setAreas}
                            placeholder="Selecione a área"
                          />
                        </div>
                        {post.area && (
                          <div className="mt-2">
                            <AreaWithIcon area={post.area} className="text-sm" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                          Solicitante
                          {isInstitutionalArea(post.area) && (
                            <span className="normal-case font-normal text-muted-foreground/80 ml-1">
                              (opcional)
                            </span>
                          )}
                        </label>
                        <UserSelectSearch
                          users={users}
                          value={post.solicitante_id ?? ""}
                          departmentFilter={
                            post.area && !isInstitutionalArea(post.area)
                              ? post.area
                              : undefined
                          }
                          allowClear
                          disabled={!post.area}
                          onValueChange={(userId) => {
                            const user = userId ? users.find((u) => u.id === userId) : null;
                            handleAssignmentChange(post.id, {
                              solicitante_id: userId || null,
                              solicitante: user?.name ?? null,
                            });
                          }}
                          placeholder={
                            !post.area
                              ? "Selecione a área primeiro"
                              : isInstitutionalArea(post.area)
                                ? "Opcional — pesquisar solicitante"
                                : "Pesquisar solicitante da área"
                          }
                        />
                        {(solicitanteUser || post.solicitante) && (
                          <div className="mt-2 flex items-center gap-2 text-sm">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={solicitanteUser?.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(solicitanteUser?.name ?? post.solicitante ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <span>{solicitanteUser?.name ?? post.solicitante}</span>
                          </div>
                        )}
                        {!post.solicitante_id && !post.solicitante && (
                          <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                            <UserCircle className="h-3.5 w-3.5" />
                            Nenhum solicitante atribuído
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          <InstagramPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            start={pagination.start}
            end={pagination.end}
            pageSize={pagination.pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}
      </div>
    </div>
  );
}
