"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Users,
  Heart,
  MessageCircle,
  Bookmark,
  ImageIcon,
  Eye,
  TrendingUp,
  ExternalLink,
  Loader2,
  Instagram,
  LayoutDashboard,
  Building2,
  ListFilter,
  Link2,
  Filter,
  X,
  ChevronDown,
  Share2,
  CalendarDays,
  Clock3,
  Activity,
  Camera,
  Sparkles,
  Rows2,
  Info,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  REACH_GOAL_MONTHLY,
  ENGAGEMENT_RATE_GOAL_PCT,
  POSTS_GOAL_ANNUAL,
} from "@/lib/instagram-goals";
import type { Area } from "@/lib/areas";
import type { User } from "@/lib/users";
import type { InstagramAccountStats, InstagramPost } from "@/lib/instagram-posts";
import type { InstagramAccountInsightDay } from "@/lib/instagram-account-insights";
import type { InstagramDemographicRow } from "@/lib/instagram-demographics";
import {
  computeCaptionThemePerformance,
  computeBestPostingHours,
  computePostingHeatmap,
  computePeriodComparison,
  computeFormatPerformance,
  computeContentSuggestions,
  computeEngagementRateByArea,
  computeEngagementRateBySolicitante,
  computeEngagementTrend,
  computeMonthlyPostVolume,
  computeTopAreasByEngagementRate,
  computeTopPostsByEngagementRate,
  paginateItems,
  type TrendGranularity,
} from "@/lib/instagram-analytics";
import { InstagramAreaDashboard } from "@/components/instagram/instagram-area-dashboard";
import { SectionCard, KpiCard, ComparisonStat } from "@/components/instagram/instagram-section-card";
import { InstagramPeriodPicker } from "@/components/instagram/instagram-period-picker";
import {
  resolvePeriodRange,
  isWithinRange,
  getAvailableYears,
  formatPeriodFilterLabel,
  describeComparisonBaseline,
  type PeriodFilter,
} from "@/lib/instagram-period";
import { InstagramBarChart } from "@/components/instagram/instagram-bar-chart";
import { InstagramTrendChart } from "@/components/instagram/instagram-trend-chart";
import { InstagramAccountTrendChart } from "@/components/instagram/instagram-account-trend-chart";
import { InstagramPostThumbnail } from "@/components/instagram/instagram-post-thumbnail";
import { InstagramPagination } from "@/components/instagram/instagram-pagination";
import { InstagramReportExport } from "@/components/instagram/instagram-report-export";
import {
  computePostEngagementRate,
  computeAggregateEngagementRate,
  formatEngagementRate,
} from "@/lib/instagram-engagement";
import {
  InstagramPostLinkEditor,
  type PostLinkPatch,
} from "@/components/instagram/instagram-post-link-editor";
import {
  getPostAreas,
  getPostSolicitantes,
  isCollabPost,
  isPostFullyLinked,
  isPostPendingLink,
  getPendingLinkLabels,
} from "@/lib/instagram-link-rules";
import { INSTAGRAM_MEDIA_TYPE_FILTERS, getInstagramMediaLabel } from "@/lib/instagram-media-type";
import { postHasTag } from "@/lib/instagram-post-tags";
import { isUserActive, sortUsersActiveFirst } from "@/lib/user-status";
import { FormerEmployeeBadge } from "@/components/usuarios/former-employee-badge";
import { AreaWithIcon } from "@/components/solicitacoes/area-with-icon";
import { cn } from "@/lib/utils";

const SYNC_SINCE = "2025-01-01T00:00:00.000Z";
const DEFAULT_PAGE_SIZE = 10;

type MainTab = "overview" | "audience" | "areas" | "posts";
type LinkFilter = "all" | "pendentes" | "vinculados";
type TrendRange = 30 | 90 | 180;
type PostSortOption =
  | "date_desc"
  | "engagement_rate"
  | "follows"
  | "profile_visits"
  | "link_clicks"
  | "reposts"
  | "reach"
  | "views"
  | "reels_watch_time";

const POST_SORT_OPTIONS: { value: PostSortOption; label: string }[] = [
  { value: "date_desc", label: "Mais recentes" },
  { value: "engagement_rate", label: "Maior taxa de engajamento" },
  { value: "follows", label: "Mais seguidores ganhos" },
  { value: "profile_visits", label: "Mais visitas ao perfil" },
  { value: "link_clicks", label: "Mais cliques no link" },
  { value: "reposts", label: "Mais reposts" },
  { value: "reach", label: "Maior alcance" },
  { value: "views", label: "Mais visualizações" },
  { value: "reels_watch_time", label: "Maior tempo médio (Reels)" },
];

interface InstagramInsightsClientProps {
  initialPosts: InstagramPost[];
  initialAccountStats: InstagramAccountStats | null;
  initialAccountStatsHistory: InstagramAccountStats[];
  initialAreas: Area[];
  initialUsers: User[];
  initialStories?: StoryInsight[];
  initialMonthlyGoal?: number;
  initialAccountInsights?: InstagramAccountInsightDay[];
  initialDemographics?: InstagramDemographicRow[];
}

interface StoryInsight {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  permalink?: string;
  published_at: string | null;
  reach: number;
  views: number;
  replies: number;
  shares?: number;
  total_interactions?: number;
  follows?: number;
  profile_visits?: number;
  nav_taps_forward?: number;
  nav_taps_back?: number;
  nav_exits?: number;
  nav_swipe_forward?: number;
}

const MAIN_TABS: { id: MainTab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "overview",
    label: "Visão geral",
    icon: <LayoutDashboard className="h-4 w-4" />,
    description: "KPIs e gráficos consolidados",
  },
  {
    id: "audience",
    label: "Conta & audiência",
    icon: <Users className="h-4 w-4" />,
    description: "Métricas diárias da conta (~90 dias na API) e demografia",
  },
  {
    id: "areas",
    label: "Por área",
    icon: <Building2 className="h-4 w-4" />,
    description: "Dashboard do escritório e por área",
  },
  {
    id: "posts",
    label: "Postagens",
    icon: <Link2 className="h-4 w-4" />,
    description: "Filtros, vínculos e edição",
  },
];

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil",
  US: "Estados Unidos",
  PT: "Portugal",
  AR: "Argentina",
  ES: "Espanha",
  FR: "França",
  IT: "Itália",
  DE: "Alemanha",
  GB: "Reino Unido",
  MX: "México",
  CL: "Chile",
  CO: "Colômbia",
  UY: "Uruguai",
  PY: "Paraguai",
  CA: "Canadá",
  JP: "Japão",
};

function countryLabel(code: string) {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

/** Tempo assistido (ms) para um rótulo curto: "1,2s" ou "1m 05s". */
function formatWatchTime(ms: number) {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function genderLabel(code: string) {
  const c = code.toUpperCase();
  if (c === "M") return "Masculino";
  if (c === "F") return "Feminino";
  if (c === "U") return "Não informado";
  return code;
}

function sortPosts(list: InstagramPost[], sort: PostSortOption): InstagramPost[] {
  const sorted = [...list];
  const byDate = (a: InstagramPost, b: InstagramPost) =>
    (b.published_at ?? "").localeCompare(a.published_at ?? "");

  switch (sort) {
    case "engagement_rate":
      return sorted.sort(
        (a, b) => computePostEngagementRate(b) - computePostEngagementRate(a) || byDate(a, b)
      );
    case "follows":
      return sorted.sort((a, b) => b.follows - a.follows || byDate(a, b));
    case "profile_visits":
      return sorted.sort((a, b) => b.profile_visits - a.profile_visits || byDate(a, b));
    case "link_clicks":
      return sorted.sort((a, b) => b.link_clicks - a.link_clicks || byDate(a, b));
    case "reposts":
      return sorted.sort((a, b) => b.reposts - a.reposts || byDate(a, b));
    case "reach":
      return sorted.sort((a, b) => b.reach - a.reach || byDate(a, b));
    case "views":
      return sorted.sort((a, b) => b.views - a.views || byDate(a, b));
    case "reels_watch_time":
      return sorted.sort(
        (a, b) => b.reels_avg_watch_time - a.reels_avg_watch_time || byDate(a, b)
      );
    default:
      return sorted.sort(byDate);
  }
}

function DemographicBars({
  data,
  format,
  emptyLabel,
  color = "bg-[#04202f]",
}: {
  data: { label: string; value: number }[];
  format?: (label: string) => string;
  emptyLabel: string;
  color?: string;
}) {
  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = (d.value / total) * 100;
        return (
          <div key={d.label} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground">{format ? format(d.label) : d.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", color)}
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPostDateTime(iso: string | null) {
  if (!iso) return { date: "—", time: "—" };
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function truncateCaption(caption: string | null, max = 120) {
  if (!caption) return "Sem legenda";
  const line = caption.split("\n")[0];
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function PostMetricTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-base font-semibold tabular-nums leading-none mt-1">{value}</p>
    </div>
  );
}

function getEngagementVsAverage(rate: number, average: number) {
  if (average <= 0 || rate <= 0) return null;
  const ratio = rate / average;
  if (ratio >= 1.1) {
    return { label: "Acima da média", className: "text-emerald-700 border-emerald-300 bg-emerald-50" };
  }
  if (ratio <= 0.9) {
    return { label: "Abaixo da média", className: "text-rose-700 border-rose-300 bg-rose-50" };
  }
  return { label: "Na média", className: "text-slate-600 border-slate-300 bg-slate-50" };
}

function countHashtags(caption: string | null) {
  if (!caption) return 0;
  const matches = caption.match(/#[\p{L}0-9_]+/gu);
  return matches ? matches.length : 0;
}

function PostCard({
  post,
  users,
  areas,
  saving,
  accountAvgRate,
  onAreasChange,
  onSave,
}: {
  post: InstagramPost;
  users: User[];
  areas: Area[];
  saving: boolean;
  accountAvgRate: number;
  onAreasChange: (areas: Area[]) => void;
  onSave: (patch: PostLinkPatch) => void;
}) {
  const postAuthors = getPostSolicitantes(post);
  const postAreasList = getPostAreas(post);
  const pending = isPostPendingLink(post);
  const [editorOpen, setEditorOpen] = useState(pending);
  const engagementRate = computePostEngagementRate(post);
  const publishedAt = formatPostDateTime(post.published_at);
  const vsAverage = getEngagementVsAverage(engagementRate, accountAvgRate);
  const hashtagCount = countHashtags(post.caption);

  return (
    <article
      className={cn(
        "rounded-lg border border-border/50 bg-background/50 overflow-hidden",
        "transition-colors hover:border-border hover:bg-background/80"
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[188px_1fr] sm:items-start">
        <div className="flex justify-center sm:justify-start border-b sm:border-b-0 sm:border-r border-border/40 bg-muted/15 p-3">
          <InstagramPostThumbnail post={post} size="card" />
        </div>

        <div className="p-3.5 flex flex-col gap-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="outline" className="rounded-full text-[10px] text-[#04202f] border-[#04202f]/20 bg-[#04202f]/5">
                  {getInstagramMediaLabel(post.media_type)}
                </Badge>
                {vsAverage && (
                  <Badge variant="outline" className={cn("rounded-full text-[10px]", vsAverage.className)}>
                    {vsAverage.label}
                  </Badge>
                )}
                {hashtagCount > 0 && (
                  <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
                    {hashtagCount} hashtag{hashtagCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                {pending &&
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
                          : "text-[#04202f] border-[#04202f]/20 bg-[#04202f]/5"
                    )}
                  >
                    {tag}
                  </Badge>
                ))}
                {isCollabPost(post) && (
                  <Badge
                    variant="outline"
                    className="rounded-full text-sky-700 border-sky-300 bg-sky-50 text-[10px]"
                  >
                    Collab
                  </Badge>
                )}
                {isPostFullyLinked(post) && (
                  <Badge
                    variant="outline"
                    className="rounded-full text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]"
                  >
                    Vinculado
                  </Badge>
                )}
              </div>

              {(postAreasList.length > 0 || postAuthors.length > 0) && (
                <div className="flex flex-wrap items-center gap-1">
                  {postAreasList.map((area) => (
                    <AreaWithIcon key={area} area={area} className="text-[11px]" />
                  ))}
                  {postAuthors.map((author) => {
                    const user = users.find((u) => u.id === author.id);
                    const inactive = user ? !isUserActive(user) : false;
                    return (
                      <span
                        key={author.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px]",
                          inactive
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-border/60 bg-muted/40 text-foreground"
                        )}
                      >
                        {user?.name ?? author.name}
                        {inactive && <FormerEmployeeBadge />}
                      </span>
                    );
                  })}
                </div>
              )}

              <p className="text-sm text-foreground leading-snug line-clamp-2">
                {truncateCaption(post.caption, 160)}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {publishedAt.date}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {publishedAt.time}
                </span>
              </div>
            </div>

            {post.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Abrir no Instagram"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver no Instagram
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-1.5">
            <PostMetricTile
              icon={<TrendingUp className="h-3 w-3 text-emerald-600" />}
              label="Engajamento"
              value={formatEngagementRate(engagementRate)}
            />
            <PostMetricTile
              icon={<Eye className="h-3 w-3" />}
              label="Alcance"
              value={formatNumber(post.reach)}
            />
            <PostMetricTile
              icon={<Heart className="h-3 w-3 text-rose-500" />}
              label="Curtidas"
              value={formatNumber(post.likes)}
            />
            <PostMetricTile
              icon={<MessageCircle className="h-3 w-3 text-indigo-500" />}
              label="Comentários"
              value={formatNumber(post.comments)}
            />
            <PostMetricTile
              icon={<Bookmark className="h-3 w-3 text-amber-500" />}
              label="Salvamentos"
              value={formatNumber(post.saves)}
            />
            <PostMetricTile
              icon={<Eye className="h-3 w-3" />}
              label="Visualizações"
              value={formatNumber(post.views)}
            />
            <PostMetricTile
              icon={<Share2 className="h-3 w-3" />}
              label="Compart."
              value={formatNumber(post.shares)}
            />
          </div>

          {(post.profile_visits > 0 ||
            post.follows > 0 ||
            post.link_clicks > 0 ||
            post.reposts > 0 ||
            post.reels_avg_watch_time > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {post.profile_visits > 0 && (
                <span>Visitas ao perfil <span className="font-semibold text-foreground tabular-nums">{formatNumber(post.profile_visits)}</span></span>
              )}
              {post.follows > 0 && (
                <span>Seguidores <span className="font-semibold text-emerald-700 tabular-nums">+{formatNumber(post.follows)}</span></span>
              )}
              {post.link_clicks > 0 && (
                <span>Cliques no link <span className="font-semibold text-foreground tabular-nums">{formatNumber(post.link_clicks)}</span></span>
              )}
              {post.reposts > 0 && (
                <span>Reposts <span className="font-semibold text-foreground tabular-nums">{formatNumber(post.reposts)}</span></span>
              )}
              {post.reels_avg_watch_time > 0 && (
                <span>Tempo médio (reel) <span className="font-semibold text-foreground tabular-nums">{formatWatchTime(post.reels_avg_watch_time)}</span></span>
              )}
            </div>
          )}

          <div className="border-t border-border/30 pt-2">
            <button
              type="button"
              onClick={() => setEditorOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                {pending ? "Vincular área e autor" : "Editar vínculos"}
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", editorOpen && "rotate-180")}
              />
            </button>

            {editorOpen && (
              <div className="mt-2">
                <InstagramPostLinkEditor
                  key={`${post.id}-${getPostAreas(post).join("|")}-${getPostSolicitantes(post)
                    .map((s) => s.id)
                    .join("|")}-${post.skip_participants}`}
                  post={post}
                  areas={areas}
                  users={users}
                  saving={saving}
                  compact
                  onAreasChange={onAreasChange}
                  onSave={onSave}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function InstagramInsightsClient({
  initialPosts,
  initialAccountStats,
  initialAccountStatsHistory,
  initialAreas,
  initialUsers,
  initialStories = [],
  initialMonthlyGoal = 12,
  initialAccountInsights = [],
  initialDemographics = [],
}: InstagramInsightsClientProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [accountStats, setAccountStats] = useState(initialAccountStats);
  const [accountStatsHistory] = useState(initialAccountStatsHistory);
  const [accountInsights, setAccountInsights] = useState(initialAccountInsights);
  const [demographics, setDemographics] = useState(initialDemographics);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [areas, setAreas] = useState(initialAreas);
  const [users] = useState(initialUsers);
  const sortedUsers = useMemo(() => sortUsersActiveFirst(users), [users]);

  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({ kind: "all" });
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [solicitanteFilter, setSolicitanteFilter] = useState<string>("all");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("pendentes");
  const [postSort, setPostSort] = useState<PostSortOption>("date_desc");
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>("week");
  const [trendRange, setTrendRange] = useState<TrendRange>(90);
  const [stories, setStories] = useState<StoryInsight[]>(initialStories);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState<number>(initialMonthlyGoal);
  const [savingGoal, setSavingGoal] = useState(false);

  const persistMonthlyGoal = useCallback(async (n: number) => {
    const safe = Math.max(1, Math.floor(Number.isFinite(n) ? n : 1));
    setSavingGoal(true);
    try {
      await fetch("/api/instagram/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyGoal: safe }),
      });
    } catch {
      // mantém valor local mesmo se o salvamento falhar
    } finally {
      setSavingGoal(false);
    }
  }, []);

  const availableYears = useMemo(() => getAvailableYears(posts), [posts]);
  const periodRange = useMemo(() => resolvePeriodRange(periodFilter), [periodFilter]);
  const scopedPosts = useMemo(
    () => posts.filter((p) => isWithinRange(p.published_at, periodRange)),
    [posts, periodRange]
  );
  const scopedStories = useMemo(
    () => stories.filter((s) => isWithinRange(s.published_at, periodRange)),
    [stories, periodRange]
  );

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

  const hasActiveFilters =
    linkFilter !== "all" ||
    areaFilter !== "all" ||
    mediaTypeFilter !== "all" ||
    tagFilter !== "all" ||
    solicitanteFilter !== "all" ||
    postSort !== "date_desc";

  const filteredPosts = useMemo(() => {
    return scopedPosts.filter((p) => {
      if (linkFilter === "pendentes" && !isPostPendingLink(p)) return false;
      if (linkFilter === "vinculados" && !isPostFullyLinked(p)) return false;

      const postAreas = getPostAreas(p);
      const postSolicitantes = getPostSolicitantes(p);

      if (areaFilter === "sem_area" && postAreas.length > 0) return false;
      if (areaFilter !== "all" && areaFilter !== "sem_area" && !postAreas.includes(areaFilter)) {
        return false;
      }
      if (mediaTypeFilter !== "all" && p.media_type !== mediaTypeFilter) return false;
      if (tagFilter === "Newsletter" && !postHasTag(p.tags, "Newsletter")) return false;
      if (tagFilter === "sem_tag" && (p.tags?.length ?? 0) > 0) return false;
      if (solicitanteFilter === "sem_solicitante" && postSolicitantes.length > 0) return false;
      if (
        solicitanteFilter !== "all" &&
        solicitanteFilter !== "sem_solicitante" &&
        !postSolicitantes.some((s) => s.id === solicitanteFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [scopedPosts, areaFilter, mediaTypeFilter, tagFilter, solicitanteFilter, linkFilter]);

  const sortedPosts = useMemo(
    () => sortPosts(filteredPosts, postSort),
    [filteredPosts, postSort]
  );

  const overviewKpis = useMemo(() => {
    const totalReach = scopedPosts.reduce((s, p) => s + p.reach, 0);
    const totalViews = scopedPosts.reduce((s, p) => s + p.views, 0);
    return {
      totalReach,
      totalViews,
      engagementRate: computeAggregateEngagementRate(scopedPosts),
    };
  }, [scopedPosts]);

  const chartByArea = useMemo(() => computeEngagementRateByArea(scopedPosts), [scopedPosts]);
  const chartBySolicitante = useMemo(
    () => computeEngagementRateBySolicitante(scopedPosts, users),
    [scopedPosts, users]
  );
  const engagementTrend = useMemo(
    () =>
      computeEngagementTrend(posts, {
        granularity: trendGranularity,
        rangeDays: trendRange,
      }),
    [posts, trendGranularity, trendRange]
  );
  const trendSummary = useMemo(() => {
    if (engagementTrend.length === 0) return null;
    const latest = engagementTrend[engagementTrend.length - 1];
    const previous = engagementTrend.length > 1 ? engagementTrend[engagementTrend.length - 2] : null;
    // Variação em pontos percentuais sobre a taxa de engajamento.
    const deltaPts = previous ? latest.engagementRate - previous.engagementRate : null;
    return { latest, previous, deltaPts };
  }, [engagementTrend]);
  const trendAverageRate = useMemo(() => {
    if (engagementTrend.length === 0) return 0;
    const sum = engagementTrend.reduce((acc, p) => acc + p.engagementRate, 0);
    return sum / engagementTrend.length;
  }, [engagementTrend]);
  const monthlyPostVolume = useMemo(() => computeMonthlyPostVolume(posts), [posts]);
  const accountAvgRate = useMemo(() => computeAggregateEngagementRate(posts), [posts]);
  const bestPostingHours = useMemo(
    () => computeBestPostingHours(scopedPosts, { limit: 6, timeZone: "America/Sao_Paulo", minPosts: 2 }),
    [scopedPosts]
  );
  const postingHeatmap = useMemo(
    () => computePostingHeatmap(scopedPosts, { timeZone: "America/Sao_Paulo" }),
    [scopedPosts]
  );
  const periodComparison = useMemo(
    () => computePeriodComparison(posts, periodRange ? { range: periodRange } : { rangeDays: 30 }),
    [posts, periodRange]
  );
  const periodGoals = useMemo(() => {
    const days = periodRange
      ? Math.max(
          1,
          Math.round((periodRange.to.getTime() - periodRange.from.getTime()) / 86_400_000)
        )
      : 30;
    const monthsFactor = days / 30;
    const reachTarget = Math.round(REACH_GOAL_MONTHLY * monthsFactor);
    const postsTarget = Math.max(1, Math.round(monthlyGoal * monthsFactor));
    const cur = periodComparison.current;
    return {
      engagement: {
        targetLabel: `${ENGAGEMENT_RATE_GOAL_PCT.toLocaleString("pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`,
        pct: (cur.engagementRate / ENGAGEMENT_RATE_GOAL_PCT) * 100,
      },
      reach: {
        targetLabel: formatNumber(reachTarget),
        pct: reachTarget > 0 ? (cur.reach / reachTarget) * 100 : null,
      },
      posts: {
        targetLabel: `${postsTarget} post${postsTarget !== 1 ? "s" : ""}`,
        pct: postsTarget > 0 ? (cur.postsCount / postsTarget) * 100 : null,
      },
    };
  }, [periodRange, periodComparison, monthlyGoal]);
  const formatPerformance = useMemo(() => computeFormatPerformance(scopedPosts), [scopedPosts]);
  const topPostsOffice = useMemo(() => computeTopPostsByEngagementRate(scopedPosts, 5), [scopedPosts]);
  const topAreas = useMemo(() => computeTopAreasByEngagementRate(scopedPosts, 3), [scopedPosts]);
  const captionThemes = useMemo(() => computeCaptionThemePerformance(scopedPosts, 8), [scopedPosts]);
  const contentSuggestions = useMemo(() => computeContentSuggestions(scopedPosts), [scopedPosts]);
  const storiesSummary = useMemo(() => {
    const sum = (fn: (s: StoryInsight) => number) =>
      scopedStories.reduce((acc, s) => acc + fn(s), 0);
    const totalReach = sum((s) => s.reach);
    const totalExits = sum((s) => s.nav_exits ?? 0);
    const totalReplies = sum((s) => s.replies);
    const totalShares = sum((s) => s.shares ?? 0);
    const totalFollows = sum((s) => s.follows ?? 0);
    const totalProfileVisits = sum((s) => s.profile_visits ?? 0);
    const totalInteractions = sum((s) => s.total_interactions ?? 0);
    const totalTapsForward = sum((s) => s.nav_taps_forward ?? 0);
    const totalTapsBack = sum((s) => s.nav_taps_back ?? 0);
    const totalSwipeForward = sum((s) => s.nav_swipe_forward ?? 0);
    // Retenção = parcela de visualizações que NÃO saíram (exit) do story.
    const retentionRate = totalReach > 0 ? Math.max(0, 1 - totalExits / totalReach) * 100 : null;
    return {
      total: scopedStories.length,
      totalReach,
      totalViews: sum((s) => s.views),
      totalReplies,
      totalShares,
      totalFollows,
      totalProfileVisits,
      totalInteractions,
      totalExits,
      totalTapsForward,
      totalTapsBack,
      totalSwipeForward,
      retentionRate,
    };
  }, [scopedStories]);
  const accountInsightsScoped = accountInsights;

  const accountInsightsRangeLabel = useMemo(() => {
    if (accountInsightsScoped.length === 0) return "aguardando primeira coleta";
    const first = accountInsightsScoped[0].date;
    const last = accountInsightsScoped[accountInsightsScoped.length - 1].date;
    const fmt = (iso: string) =>
      new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    const days = accountInsightsScoped.length;
    if (days <= 90) {
      return `${fmt(first)} – ${fmt(last)} · ${days} dias (recorte recente da API Meta)`;
    }
    return `${fmt(first)} – ${fmt(last)} · ${days} dias no banco (acumulado pela sincronização)`;
  }, [accountInsightsScoped]);

  const accountTrendData = useMemo(() => {
    const rows = accountInsightsScoped;
    if (rows.length === 0) return [];

    const toPoint = (
      key: string,
      label: string,
      reach: number,
      views: number,
      accountsEngaged: number,
      interactions: number
    ) => ({ date: key, label, reach, views, accountsEngaged, interactions });

    // Gráfico diário até ~3 meses; acima disso agrupa por mês (legível desde 2025).
    if (rows.length <= 90) {
      return rows.map((d) =>
        toPoint(
          d.date,
          new Date(`${d.date}T12:00:00`).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          }),
          d.reach,
          d.views,
          d.accounts_engaged,
          d.total_interactions
        )
      );
    }

    const byMonth = new Map<
      string,
      { reach: number; views: number; accountsEngaged: number; interactions: number }
    >();
    for (const d of rows) {
      const key = d.date.slice(0, 7);
      const cur = byMonth.get(key) ?? {
        reach: 0,
        views: 0,
        accountsEngaged: 0,
        interactions: 0,
      };
      cur.reach += d.reach;
      cur.views += d.views;
      cur.accountsEngaged += d.accounts_engaged;
      cur.interactions += d.total_interactions;
      byMonth.set(key, cur);
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split("-");
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        });
        return toPoint(key, label, v.reach, v.views, v.accountsEngaged, v.interactions);
      });
  }, [accountInsightsScoped]);

  const accountInsightsSummary = useMemo(() => {
    const rows = accountInsightsScoped;
    const sum = (fn: (r: InstagramAccountInsightDay) => number) =>
      rows.reduce((acc, r) => acc + fn(r), 0);
    const days = rows.length;
    const avg = (total: number) => (days > 0 ? Math.round(total / days) : 0);
    const reachSum = sum((r) => r.reach);
    const viewsSum = sum((r) => r.views);
    const accountsEngagedSum = sum((r) => r.accounts_engaged);
    const interactionsSum = sum((r) => r.total_interactions);
    return {
      days,
      avgReach: avg(reachSum),
      avgViews: avg(viewsSum),
      avgAccountsEngaged: avg(accountsEngagedSum),
      avgInteractions: avg(interactionsSum),
      profileLinksTaps: sum((r) => r.profile_links_taps),
      peakReach: rows.reduce((m, r) => Math.max(m, r.reach), 0),
      peakViews: rows.reduce((m, r) => Math.max(m, r.views), 0),
    };
  }, [accountInsightsScoped]);

  const demographicsGrouped = useMemo(() => {
    const pick = (kind: string, breakdown: string) =>
      demographics
        .filter((d) => d.kind === kind && d.breakdown === breakdown)
        .sort((a, b) => b.value - a.value);
    return {
      gender: pick("followers", "gender"),
      age: pick("followers", "age").sort((a, b) => a.label.localeCompare(b.label)),
      country: pick("followers", "country").slice(0, 8),
      city: pick("followers", "city").slice(0, 8),
      hasAny: demographics.length > 0,
    };
  }, [demographics]);

  const followersTrend = useMemo(() => {
    const history = accountStatsHistory;
    if (history.length < 2) {
      return { dayGrowth: null as number | null, weekGrowth: null as number | null };
    }

    const latest = history[history.length - 1];
    const oneDayAgo = history[history.length - 2];
    const weekReference = history[Math.max(0, history.length - 8)];

    return {
      dayGrowth: latest.followers_count - oneDayAgo.followers_count,
      weekGrowth: latest.followers_count - weekReference.followers_count,
    };
  }, [accountStatsHistory]);

  const reportFilterDescription = useMemo(() => {
    return "Todos os posts sincronizados desde 2025";
  }, []);

  const postsFilterDescription = useMemo(() => {
    const parts: string[] = [];
    if (linkFilter === "pendentes") parts.push("Pendentes de vínculo");
    else if (linkFilter === "vinculados") parts.push("Já vinculados");
    if (areaFilter === "sem_area") parts.push("Sem área");
    else if (areaFilter !== "all") parts.push(`Área: ${areaFilter}`);
    if (mediaTypeFilter !== "all") {
      const label = INSTAGRAM_MEDIA_TYPE_FILTERS.find((f) => f.value === mediaTypeFilter)?.label;
      parts.push(`Formato: ${label ?? mediaTypeFilter}`);
    }
    if (tagFilter === "Newsletter") parts.push("Tag: Newsletter");
    else if (tagFilter === "sem_tag") parts.push("Sem tags");
    if (solicitanteFilter === "sem_solicitante") parts.push("Sem solicitante");
    else if (solicitanteFilter !== "all") {
      const user = users.find((u) => u.id === solicitanteFilter);
      parts.push(`Solicitante: ${user?.name ?? solicitanteFilter}`);
    }
    if (postSort !== "date_desc") {
      const sortLabel = POST_SORT_OPTIONS.find((o) => o.value === postSort)?.label;
      if (sortLabel) parts.push(`Ordem: ${sortLabel}`);
    }
    return parts.length ? parts.join(" · ") : "Todos os posts";
  }, [linkFilter, areaFilter, mediaTypeFilter, tagFilter, solicitanteFilter, postSort, users]);

  const pagination = useMemo(
    () => paginateItems(sortedPosts, page, pageSize),
    [sortedPosts, page, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [areaFilter, mediaTypeFilter, tagFilter, solicitanteFilter, linkFilter, periodFilter, postSort]);

  const clearFilters = useCallback(() => {
    setLinkFilter("all");
    setAreaFilter("all");
    setMediaTypeFilter("all");
    setTagFilter("all");
    setSolicitanteFilter("all");
    setPostSort("date_desc");
  }, []);

  const loadAccountAudience = useCallback(async (refresh = false) => {
    setAudienceLoading(true);
    setAudienceError(null);
    try {
      const url = refresh ? "/api/instagram/account-audience?refresh=1" : "/api/instagram/account-audience";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar audiência");
      setAccountInsights(json.insights ?? []);
      setDemographics(json.demographics ?? []);
      if (json.accountStats) setAccountStats(json.accountStats);
      if (json.syncWarning) setAudienceError(json.syncWarning);
    } catch (err) {
      setAudienceError(err instanceof Error ? err.message : "Erro ao carregar audiência");
    } finally {
      setAudienceLoading(false);
    }
  }, []);

  const reloadPosts = useCallback(async () => {
    await fetch("/api/instagram/tags/refresh", { method: "POST" });
    const listRes = await fetch("/api/instagram/posts");
    const listJson = await listRes.json();
    if (listRes.ok) {
      setPosts(listJson.posts ?? []);
      setAccountStats(listJson.accountStats ?? null);
    }
  }, []);

  const loadStories = useCallback(async () => {
    setStoriesLoading(true);
    setStoriesError(null);
    try {
      const res = await fetch("/api/instagram/stories");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar stories");
      setStories(json.stories ?? []);
    } catch (err) {
      setStoriesError(err instanceof Error ? err.message : "Erro ao carregar stories");
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStories();
    void loadAccountAudience();
  }, [loadStories, loadAccountAudience]);

  useEffect(() => {
    if (activeTab === "audience" && accountInsights.length === 0 && !audienceLoading) {
      void loadAccountAudience();
    }
  }, [activeTab, accountInsights.length, audienceLoading, loadAccountAudience]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncProgress({ synced: 0, page: 0 });

    try {
      let after: string | undefined;
      let totalSynced = 0;
      let syncPage = 0;

      while (true) {
        syncPage++;
        const res = await fetch("/api/instagram/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ since: SYNC_SINCE, after }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao sincronizar");

        totalSynced += json.synced ?? 0;
        setSyncProgress({ synced: totalSynced, page: syncPage });

        if (!json.hasMore || !json.nextAfter) break;
        after = json.nextAfter;
      }

      await reloadPosts();
      await loadStories();
      await loadAccountAudience(true);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [reloadPosts, loadStories, loadAccountAudience]);

  const handleAssignmentChange = useCallback(async (postId: string, patch: PostLinkPatch) => {
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
          const primary = patch.solicitantes[0];
          return {
            ...p,
            areas: patch.areas,
            area: patch.areas[0] ?? null,
            solicitantes: patch.solicitantes,
            solicitante_id: primary?.id ?? null,
            solicitante: primary?.name ?? null,
            skip_participants: patch.skip_participants ?? p.skip_participants,
          };
        })
      );
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPostId(null);
    }
  }, []);

  const accountUsername = accountStats?.username ?? "bismarchipires";

  return (
    <div className="flex flex-col gap-5 min-h-0">
      {/* Barra de ações — sticky abaixo do header global */}
      <div
        className={cn(
          "sticky top-14 z-20 -mx-1 px-1",
          "rounded-lg border border-border/50 bg-background/90 backdrop-blur-xl shadow-sm"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="shrink-0 rounded-xl bg-[#04202f] text-white hover:bg-[#04202f]/90 hover:text-white"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {syncing
                ? syncProgress
                  ? `Sincronizando… ${syncProgress.synced} posts`
                  : "Sincronizando…"
                : "Sincronizar"}
            </Button>

            {accountStats && (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground min-w-0">
                {accountStats.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={accountStats.profile_picture_url}
                    alt={`@${accountUsername}`}
                    className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-[#04202f]/10"
                  />
                ) : (
                  <Instagram className="h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">@{accountUsername}</span>
                    {accountStats.follows_count != null && (
                      <span className="hidden md:inline text-xs text-muted-foreground">
                        · segue {formatNumber(accountStats.follows_count)}
                      </span>
                    )}
                  </div>
                  <span className="hidden sm:block truncate text-xs text-muted-foreground/80 max-w-[280px]">
                    {accountStats.biography
                      ? accountStats.biography
                      : `Atualizado ${formatDate(accountStats.fetched_at)}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <InstagramPeriodPicker
              value={periodFilter}
              onChange={setPeriodFilter}
              availableYears={availableYears}
            />
            <Badge variant="outline" className="rounded-full tabular-nums">
              {periodFilter.kind === "all" ? posts.length : scopedPosts.length} posts
            </Badge>
            {linkCounts.pendentes > 0 && (
              <Badge className="rounded-full bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-200">
                {linkCounts.pendentes} pendentes
              </Badge>
            )}
            <InstagramReportExport
              posts={posts}
              areas={areas}
              users={users}
              accountStats={accountStats}
              filterDescription={reportFilterDescription}
              compact
            />
          </div>
        </div>

        {syncError && (
          <div className="mx-4 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {syncError}
          </div>
        )}
      </div>

      {/* KPIs da conta — sempre visíveis */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Seguidores"
          value={formatNumber(accountStats?.followers_count ?? 0)}
          sub={`@${accountUsername} · ${followersTrend.dayGrowth != null ? `${followersTrend.dayGrowth >= 0 ? "+" : ""}${formatNumber(followersTrend.dayGrowth)} no dia` : "sem histórico"}`}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Posts desde 2025"
          value={formatNumber(posts.length)}
          sub={`${accountStats?.media_count ?? 0} no total da conta`}
          icon={<ImageIcon className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Taxa de engajamento"
          value={formatEngagementRate(overviewKpis.engagementRate)}
          sub={`Meta anual: ${ENGAGEMENT_RATE_GOAL_PCT.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Alcance total"
          value={formatNumber(overviewKpis.totalReach)}
          sub={followersTrend.weekGrowth != null ? `${followersTrend.weekGrowth >= 0 ? "+" : ""}${formatNumber(followersTrend.weekGrowth)} seguidores na semana` : "sem histórico semanal"}
          icon={<Eye className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Navegação principal */}
      <div className="space-y-4">
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <div
            className="flex gap-1 min-w-max border-b border-border/60"
            role="tablist"
            aria-label="Seções do Instagram Insights"
          >
            {MAIN_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 -mb-px transition-colors shrink-0",
                    isActive
                      ? "border-[#04202f] text-foreground bg-muted/30"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.id === "posts" && linkCounts.pendentes > 0 && (
                    <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                      {linkCounts.pendentes}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground -mt-2">
          {MAIN_TABS.find((t) => t.id === activeTab)?.description}
        </p>

        {/* Tab: Visão geral */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <SectionCard
                title={
                  periodFilter.kind === "all"
                    ? "Resumo dos últimos 30 dias"
                    : `Resumo · ${formatPeriodFilterLabel(periodFilter)}`
                }
                description="Variação real de performance no período"
                action={
                  <Badge variant="outline" className="rounded-full gap-1.5 font-normal text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    Comparativo com {describeComparisonBaseline(periodFilter)}
                  </Badge>
                }
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <ComparisonStat
                    label="Taxa de engajamento"
                    value={formatEngagementRate(periodComparison.current.engagementRate)}
                    delta={periodComparison.deltaRatePts}
                    deltaSuffix=" p.p."
                    sub={`Anterior: ${formatEngagementRate(periodComparison.previous.engagementRate)}`}
                    goal={periodGoals.engagement}
                  />
                  <ComparisonStat
                    label="Alcance"
                    value={formatNumber(periodComparison.current.reach)}
                    delta={periodComparison.deltaReachPct}
                    deltaSuffix="%"
                    sub={`Anterior: ${formatNumber(periodComparison.previous.reach)}`}
                    goal={periodGoals.reach}
                  />
                  <ComparisonStat
                    label="Posts publicados"
                    value={formatNumber(periodComparison.current.postsCount)}
                    delta={periodComparison.deltaPostsPct}
                    deltaSuffix="%"
                    sub={`Anterior: ${formatNumber(periodComparison.previous.postsCount)} posts`}
                    goal={periodGoals.posts}
                  />
                </div>
              </SectionCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.03 }}>
            <SectionCard
              title="Tendência de taxa de engajamento"
              description="Evolução de engajamento no período (alcance como base)"
              action={
                <div className="flex items-center gap-2">
                  <Select
                    value={trendGranularity}
                    onValueChange={(value) => setTrendGranularity(value as TrendGranularity)}
                  >
                    <SelectTrigger className="h-8 w-[132px] rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Semanal</SelectItem>
                      <SelectItem value="month">Mensal</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={String(trendRange)}
                    onValueChange={(value) => setTrendRange(Number(value) as TrendRange)}
                  >
                    <SelectTrigger className="h-8 w-[112px] rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="180">180 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
            >
              <div className="space-y-4">
                <InstagramTrendChart
                  title="Engajamento ao longo do tempo"
                  data={engagementTrend}
                  referenceValue={trendAverageRate}
                  referenceLabel="Média do período"
                />
                {trendSummary && (
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Último período
                        </p>
                        <p className="text-sm font-semibold mt-0.5">
                          {trendSummary.latest.bucketLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Taxa no período
                        </p>
                        <p className="text-sm font-semibold mt-0.5 tabular-nums">
                          {formatEngagementRate(trendSummary.latest.engagementRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Variação
                        </p>
                        <p
                          className={cn(
                            "text-sm font-semibold mt-0.5 tabular-nums",
                            trendSummary.deltaPts != null && trendSummary.deltaPts > 0
                              ? "text-emerald-700"
                              : trendSummary.deltaPts != null && trendSummary.deltaPts < 0
                                ? "text-rose-700"
                                : "text-muted-foreground"
                          )}
                        >
                          {trendSummary.deltaPts != null
                            ? `${trendSummary.deltaPts >= 0 ? "+" : ""}${trendSummary.deltaPts.toFixed(2)} p.p.`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
              <SectionCard
                title="Volume de posts por mês"
                description={`Ritmo de publicação vs. metas (${monthlyGoal}/mês · ${POSTS_GOAL_ANNUAL}/ano)`}
                action={
                  <div className="flex items-center gap-2">
                    <label htmlFor="ig-monthly-goal" className="text-xs text-muted-foreground whitespace-nowrap">
                      Meta/mês
                    </label>
                    <input
                      id="ig-monthly-goal"
                      type="number"
                      min={1}
                      value={monthlyGoal}
                      onChange={(e) => setMonthlyGoal(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                      onBlur={(e) => persistMonthlyGoal(Number(e.target.value))}
                      className="h-8 w-16 rounded-lg border border-border/60 bg-background px-2 text-sm tabular-nums focus:border-[#04202f] focus:outline-none"
                    />
                    {savingGoal && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                }
              >
                {monthlyPostVolume.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados suficientes no período.</p>
                ) : (
                  (() => {
                    const PLOT_H = 96;
                    const counts = monthlyPostVolume.map((m) => m.postsCount);
                    const maxValue = Math.max(...counts, monthlyGoal, 1);
                    const goalPct = (monthlyGoal / maxValue) * 100;
                    const nearThreshold = monthlyGoal * 0.8;
                    const now = new Date();
                    const currentMonthKey = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                    const judged = monthlyPostVolume.filter((m) => m.monthStart !== currentMonthKey);
                    const hitCount = judged.filter((m) => m.postsCount >= monthlyGoal).length;
                    const avg =
                      counts.reduce((s, c) => s + c, 0) / monthlyPostVolume.length;
                    const currentYear = now.getFullYear();
                    const yearToDate = monthlyPostVolume
                      .filter((m) => new Date(m.monthStart).getFullYear() === currentYear)
                      .reduce((s, m) => s + m.postsCount, 0);
                    const annualPct = (yearToDate / POSTS_GOAL_ANNUAL) * 100;

                    const statusFor = (count: number, isCurrent: boolean) => {
                      if (isCurrent) return { bar: "bg-sky-400/70", ring: "" };
                      if (count >= monthlyGoal) return { bar: "bg-emerald-500", ring: "" };
                      if (count >= nearThreshold) return { bar: "bg-amber-400", ring: "" };
                      return { bar: "bg-rose-500", ring: "" };
                    };

                    return (
                      <div className="space-y-3">
                        <div className="flex items-end gap-2 overflow-x-auto pb-1">
                          {monthlyPostVolume.map((month) => {
                            const isCurrent = month.monthStart === currentMonthKey;
                            const barPct = (month.postsCount / maxValue) * 100;
                            const status = statusFor(month.postsCount, isCurrent);
                            return (
                              <div
                                key={month.monthStart}
                                className="flex min-w-[40px] flex-1 flex-col items-center gap-1.5"
                                title={`${month.monthLabel}: ${month.postsCount} post${month.postsCount !== 1 ? "s" : ""}${isCurrent ? " (mês em andamento)" : month.postsCount >= monthlyGoal ? " · meta atingida" : month.postsCount >= nearThreshold ? " · perto da meta" : " · abaixo da meta"}`}
                              >
                                <span className="text-[11px] font-semibold tabular-nums text-foreground">
                                  {month.postsCount}
                                </span>
                                <div
                                  className="relative flex w-full items-end justify-center"
                                  style={{ height: PLOT_H }}
                                >
                                  <div
                                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#04202f]/40"
                                    style={{ bottom: `${goalPct}%` }}
                                  />
                                  <div
                                    className={cn(
                                      "w-full max-w-[28px] rounded-t-md transition-all",
                                      status.bar,
                                      isCurrent && "[background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.35)_4px,rgba(255,255,255,0.35)_8px)]"
                                    )}
                                    style={{ height: `${Math.max(barPct, 3)}%` }}
                                  />
                                </div>
                                <span
                                  className={cn(
                                    "text-[10px] whitespace-nowrap",
                                    isCurrent ? "font-semibold text-sky-700" : "text-muted-foreground"
                                  )}
                                >
                                  {month.monthLabel.replace(" de ", "/")}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/40 pt-3">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Na meta
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Perto (≥80%)
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Abaixo
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-sm bg-sky-400/70" /> Mês atual
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
                            <span>
                              <span className="font-semibold text-foreground">{hitCount}</span> de {judged.length} meses na meta
                            </span>
                            <span>Média {avg.toFixed(1)}/mês</span>
                            <span>
                              Meta anual{" "}
                              <span
                                className={cn(
                                  "font-semibold",
                                  annualPct >= 100
                                    ? "text-emerald-700"
                                    : annualPct >= 80
                                      ? "text-amber-600"
                                      : "text-foreground"
                                )}
                              >
                                {yearToDate}/{POSTS_GOAL_ANNUAL}
                              </span>{" "}
                              ({currentYear})
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </SectionCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
              <SectionCard
                title="Melhores horários para postar"
                description="Ranking por taxa de engajamento dos posts já publicados"
                action={<Clock3 className="h-4 w-4 text-muted-foreground" />}
              >
                {bestPostingHours.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem histórico suficiente para recomendar horários.
                  </p>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {bestPostingHours.map((slot, index) => (
                        <div key={slot.hour} className="rounded-xl border border-border/40 bg-background/50 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              #{index + 1} melhor janela
                            </p>
                            <Badge variant="outline" className="rounded-full text-[10px]">
                              {slot.postsCount} post{slot.postsCount !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          <p className="mt-1 text-2xl font-bold tabular-nums">{slot.hourLabel}</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-700">
                            {formatEngagementRate(slot.engagementRate)}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Alcance acumulado: {formatNumber(slot.totalReach)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {postingHeatmap.cells.length > 0 && (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Mapa por dia e horário
                          </p>
                          {postingHeatmap.best && (
                            <p className="text-[11px] text-muted-foreground">
                              Melhor janela:{" "}
                              <span className="font-semibold text-foreground">
                                {postingHeatmap.dayLabels[postingHeatmap.best.day]}{" "}
                                {postingHeatmap.blockLabels[postingHeatmap.best.block]}
                              </span>{" "}
                              · {formatEngagementRate(postingHeatmap.best.engagementRate)}
                            </p>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <div className="min-w-[560px]">
                            <div className="grid" style={{ gridTemplateColumns: `48px repeat(${postingHeatmap.blockLabels.length}, 1fr)` }}>
                              <div />
                              {postingHeatmap.blockLabels.map((label) => (
                                <div key={label} className="px-1 pb-1 text-center text-[10px] text-muted-foreground tabular-nums">
                                  {label}
                                </div>
                              ))}
                              {postingHeatmap.dayLabels.map((dayLabel, dayIndex) => (
                                <Fragment key={dayLabel}>
                                  <div className="flex items-center pr-2 text-[11px] font-medium text-muted-foreground">
                                    {dayLabel}
                                  </div>
                                  {postingHeatmap.blockLabels.map((_, blockIndex) => {
                                    const cell = postingHeatmap.cells.find(
                                      (c) => c.day === dayIndex && c.block === blockIndex
                                    );
                                    const intensity =
                                      cell && postingHeatmap.maxRate > 0
                                        ? cell.engagementRate / postingHeatmap.maxRate
                                        : 0;
                                    const isBest =
                                      postingHeatmap.best != null &&
                                      cell != null &&
                                      postingHeatmap.best.day === dayIndex &&
                                      postingHeatmap.best.block === blockIndex;
                                    return (
                                      <div key={`${dayIndex}-${blockIndex}`} className="p-0.5">
                                        <div
                                          className={cn(
                                            "flex h-9 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums transition-colors",
                                            cell ? "text-[#0b1620]" : "text-muted-foreground/40",
                                            isBest && "ring-2 ring-emerald-500 ring-offset-1"
                                          )}
                                          style={{
                                            backgroundColor: cell
                                              ? `rgba(16, 185, 129, ${0.12 + intensity * 0.78})`
                                              : "rgba(148, 163, 184, 0.08)",
                                          }}
                                          title={
                                            cell
                                              ? `${dayLabel} ${postingHeatmap.blockLabels[blockIndex]} · ${formatEngagementRate(cell.engagementRate)} · ${cell.postsCount} post${cell.postsCount !== 1 ? "s" : ""}`
                                              : `${dayLabel} ${postingHeatmap.blockLabels[blockIndex]} · sem posts`
                                          }
                                        >
                                          {cell ? cell.engagementRate.toFixed(1) : "·"}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Intensidade da cor = taxa de engajamento. Passe o mouse para ver detalhes de cada janela.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.13 }}>
              <SectionCard
                title="Performance por formato"
                description="Qual formato gera mais engajamento sobre o alcance"
                action={<ImageIcon className="h-4 w-4 text-muted-foreground" />}
              >
                {formatPerformance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem posts suficientes para comparar formatos.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {formatPerformance.map((format, index) => (
                      <div
                        key={format.mediaType}
                        className={cn(
                          "rounded-xl border p-4",
                          index === 0
                            ? "border-emerald-200/70 bg-emerald-50/40"
                            : "border-border/40 bg-background/50"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{getInstagramMediaLabel(format.mediaType)}</p>
                          {index === 0 && (
                            <Badge className="rounded-full bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                              Melhor
                            </Badge>
                          )}
                        </div>
                        <p className="text-2xl font-bold tabular-nums mt-1">
                          {formatEngagementRate(format.engagementRate)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {format.postsCount} post{format.postsCount !== 1 ? "s" : ""} · alcance {formatNumber(format.totalReach)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
            <SectionCard
              title="Top 5 posts do escritório"
              description="Ranking por taxa de engajamento (curtidas + comentários + salvamentos ÷ alcance)"
            >
              {topPostsOffice.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados suficientes para ranking.</p>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {topPostsOffice.map((item, index) => (
                    <div key={item.post.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 p-2.5">
                      <span className="w-8 text-sm font-bold tabular-nums text-muted-foreground">#{index + 1}</span>
                      <InstagramPostThumbnail post={item.post} size="list" showBadge={false} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{truncateCaption(item.post.caption, 100)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.post.published_at)} · Alcance {formatNumber(item.post.reach)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{formatEngagementRate(item.engagementRate)}</p>
                        <p className="text-[11px] text-muted-foreground">Taxa {formatEngagementRate(item.engagementRate)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }}>
            <SectionCard
              title="Top 3 áreas"
              description="Áreas com melhor taxa de engajamento sobre alcance"
              action={<Activity className="h-4 w-4 text-muted-foreground" />}
            >
              {topAreas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma área vinculada com dados suficientes.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {topAreas.map((area, index) => (
                    <div key={area.area} className="rounded-xl border border-border/40 bg-background/50 p-4">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">#{index + 1} área</p>
                      <p className="text-sm font-semibold mt-1 truncate">{area.area}</p>
                      <p className="text-xl font-bold mt-1 tabular-nums">{formatEngagementRate(area.engagementRate)}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {area.postsCount} posts · alcance {formatNumber(area.totalReach)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.25 }}>
            <SectionCard
              title="Stories (histórico persistido)"
              description="Stories salvos no banco — não somem após as 24h do Instagram"
              action={
                <Button variant="outline" size="sm" className="rounded-lg h-8" onClick={loadStories} disabled={storiesLoading}>
                  {storiesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Coletar stories de hoje</span>
                </Button>
              }
            >
              {storiesError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {storiesError}
                </div>
              )}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-3">
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Stories</p>
                  <p className="text-lg font-bold tabular-nums">{storiesSummary.total}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Alcance</p>
                  <p className="text-lg font-bold tabular-nums">{formatNumber(storiesSummary.totalReach)}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Visualizações</p>
                  <p className="text-lg font-bold tabular-nums">{formatNumber(storiesSummary.totalViews)}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Retenção</p>
                  <p className="text-lg font-bold tabular-nums">
                    {storiesSummary.retentionRate != null
                      ? `${storiesSummary.retentionRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Respostas</p>
                  <p className="text-lg font-bold tabular-nums">{formatNumber(storiesSummary.totalReplies)}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Compart.</p>
                  <p className="text-lg font-bold tabular-nums">{formatNumber(storiesSummary.totalShares)}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Visitas ao perfil</p>
                  <p className="text-lg font-bold tabular-nums">{formatNumber(storiesSummary.totalProfileVisits)}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Seguidores ganhos</p>
                  <p className="text-lg font-bold tabular-nums">{formatNumber(storiesSummary.totalFollows)}</p>
                </div>
              </div>
              {(storiesSummary.totalExits > 0 ||
                storiesSummary.totalTapsForward > 0 ||
                storiesSummary.totalTapsBack > 0 ||
                storiesSummary.totalSwipeForward > 0) && (
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">Navegação</span>
                  <span>Avançar (toque): <span className="font-semibold text-foreground tabular-nums">{formatNumber(storiesSummary.totalTapsForward)}</span></span>
                  <span>Voltar: <span className="font-semibold text-foreground tabular-nums">{formatNumber(storiesSummary.totalTapsBack)}</span></span>
                  <span>Próximo story: <span className="font-semibold text-foreground tabular-nums">{formatNumber(storiesSummary.totalSwipeForward)}</span></span>
                  <span>Saídas: <span className="font-semibold text-foreground tabular-nums">{formatNumber(storiesSummary.totalExits)}</span></span>
                </div>
              )}
              {storiesLoading && stories.length === 0 && (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 p-2.5">
                      <div className="h-12 w-12 rounded-lg bg-muted/40 animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-32 rounded bg-muted/40 animate-pulse" />
                        <div className="h-3 w-48 rounded bg-muted/30 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!storiesLoading && scopedStories.length === 0 && !storiesError && (
                <p className="text-sm text-muted-foreground">
                  {stories.length > 0
                    ? "Nenhum story neste período. Ajuste o filtro de período."
                    : "Nenhum story salvo ainda. Clique em \u201cColetar stories de hoje\u201d para começar o histórico."}
                </p>
              )}
              {scopedStories.length > 0 && (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {scopedStories.map((story) => (
                    <div key={story.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 p-2.5">
                      <InstagramPostThumbnail
                        post={{
                          id: story.id,
                          ig_media_id: story.id,
                          caption: null,
                          media_type: story.media_type ?? null,
                          media_url: story.media_url ?? null,
                          thumbnail_url: story.thumbnail_url ?? null,
                          permalink: story.permalink ?? null,
                          published_at: story.published_at,
                          area: null,
                          areas: [],
                          solicitante_id: null,
                          solicitante: null,
                          solicitantes: [],
                          skip_participants: false,
                          tags: [],
                          likes: 0,
                          comments: 0,
                          reach: story.reach,
                          views: story.views,
                          saves: 0,
                          shares: 0,
                          total_interactions: 0,
                          media_product_type: "STORY",
                          follows: 0,
                          profile_visits: 0,
                          reposts: 0,
                          profile_activity: 0,
                          link_clicks: 0,
                          reels_avg_watch_time: 0,
                          reels_total_watch_time: 0,
                          synced_at: new Date().toISOString(),
                          created_at: new Date().toISOString(),
                        }}
                        size="list"
                        showBadge={false}
                      />
                      <div className="text-xs text-muted-foreground min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {formatDate(story.published_at)}
                        </p>
                        <p>Alcance {formatNumber(story.reach)} · Visualizações {formatNumber(story.views)} · Respostas {formatNumber(story.replies)}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
                          {(story.shares ?? 0) > 0 && <span>Compart. {formatNumber(story.shares ?? 0)}</span>}
                          {(story.profile_visits ?? 0) > 0 && <span>Visitas perfil {formatNumber(story.profile_visits ?? 0)}</span>}
                          {(story.follows ?? 0) > 0 && <span>+{formatNumber(story.follows ?? 0)} seguidores</span>}
                          {(story.nav_exits ?? 0) > 0 && <span>Saídas {formatNumber(story.nav_exits ?? 0)}</span>}
                          {(story.nav_taps_forward ?? 0) > 0 && <span>Avançar {formatNumber(story.nav_taps_forward ?? 0)}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            </motion.div>

            <SectionCard
              title="Análises detalhadas"
              description="Abrir visão tática por tema, área e recomendações"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-8"
                  onClick={() => setShowDeepAnalysis((v) => !v)}
                >
                  <Rows2 className="h-3.5 w-3.5 mr-1.5" />
                  {showDeepAnalysis ? "Ocultar detalhes" : "Mostrar detalhes"}
                </Button>
              }
            >
              {!showDeepAnalysis ? (
                <p className="text-sm text-muted-foreground">
                  Mantenha esta visão enxuta para reunião executiva. Abra os detalhes quando quiser análise tática.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                    <InstagramBarChart
                      title="Taxa por área (%)"
                      data={chartByArea}
                      useAreaIcons
                      valueFormatter={(value) => `${value.toFixed(1)}%`}
                      emptyMessage="Atribua áreas às postagens para ver este gráfico."
                    />
                    <InstagramBarChart
                      title="Taxa por autor (%)"
                      data={chartBySolicitante}
                      useAvatars
                      valueFormatter={(value) => `${value.toFixed(1)}%`}
                      emptyMessage="Atribua autores às postagens para ver este gráfico."
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/40">
                          <th className="py-2.5 pr-3 font-semibold">Tema</th>
                          <th className="py-2.5 pr-3 font-semibold">Posts</th>
                          <th className="py-2.5 pr-3 font-semibold">Alcance</th>
                          <th className="py-2.5 pr-3 font-semibold">Taxa de eng.</th>
                          <th className="py-2.5 pr-0 font-semibold">Exemplo de legenda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {captionThemes.map((theme) => (
                          <tr key={theme.theme} className="border-b border-border/30 last:border-b-0">
                            <td className="py-2.5 pr-3 font-medium">{theme.theme}</td>
                            <td className="py-2.5 pr-3 tabular-nums">{theme.postsCount}</td>
                            <td className="py-2.5 pr-3 tabular-nums">{formatNumber(theme.totalReach)}</td>
                            <td className="py-2.5 pr-3 tabular-nums font-semibold">
                              {formatEngagementRate(theme.engagementRate)}
                            </td>
                            <td className="py-2.5 pr-0 text-xs text-muted-foreground">
                              {truncateCaption(theme.sampleCaptions[0] ?? "—", 88)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    {contentSuggestions.map((suggestion) => (
                      <div key={suggestion.title} className="rounded-xl border border-border/40 bg-muted/10 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{suggestion.title}</p>
                          <Badge
                            className={cn(
                              "rounded-full text-[10px]",
                              suggestion.expectedImpact === "alto"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            )}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {suggestion.expectedImpact}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{suggestion.reason}</p>
                        <p className="text-sm mt-2">{suggestion.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Status de vinculação"
              description="Saúde do mapeamento entre posts, áreas e autores"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-8"
                  onClick={() => {
                    setLinkFilter("pendentes");
                    setActiveTab("posts");
                  }}
                >
                  <ListFilter className="h-3.5 w-3.5 mr-1.5" />
                  Gerenciar pendências
                </Button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Total sincronizado
                  </p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{posts.length}</p>
                </div>
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-4">
                  <p className="text-xs text-amber-800/80 uppercase tracking-wider font-semibold">
                    Pendentes de vínculo
                  </p>
                  <p className="text-2xl font-bold tabular-nums mt-1 text-amber-900">
                    {linkCounts.pendentes}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-4">
                  <p className="text-xs text-emerald-800/80 uppercase tracking-wider font-semibold">
                    Já vinculados
                  </p>
                  <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-900">
                    {linkCounts.vinculados}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* Tab: Conta & audiência */}
        {activeTab === "audience" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/70 px-4 py-3 text-sm text-sky-950">
              <div className="flex gap-2.5">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-700" aria-hidden />
                <div className="space-y-1.5 text-xs leading-relaxed text-sky-900/90">
                  <p className="font-semibold text-sky-950">Limites do Meta vs. postagens</p>
                  <p>
                    As postagens podem ser sincronizadas desde jan/2025. Já as métricas diárias da
                    conta (alcance, visualizações, engajamento) só ficam disponíveis na API por cerca
                    de 90 dias — não há histórico completo retroativo como nas mídias.
                  </p>
                  <p>
                    O gráfico abaixo mostra o que guardamos no banco: na primeira coleta entra o
                    recorte que o Meta ainda expõe; com sincronizações regulares, o histórico vai
                    crescendo mês a mês.
                  </p>
                </div>
              </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <SectionCard
                title="Tendência da conta"
                description={`Métricas diárias da conta · ${accountInsightsRangeLabel}. Atualizar da API puxa o recorte disponível no Meta (~90 dias).`}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-8"
                    onClick={() => loadAccountAudience(true)}
                    disabled={audienceLoading}
                  >
                    {audienceLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5">Atualizar da API</span>
                  </Button>
                }
              >
                {audienceError && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {audienceError}
                  </div>
                )}
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 mb-4">
                  <KpiCard
                    label="Alcance médio/dia"
                    value={formatNumber(accountInsightsSummary.avgReach)}
                    icon={<Eye className="h-3.5 w-3.5" />}
                    sub="alcance único por dia · somar dias ≠ total"
                  />
                  <KpiCard
                    label="Visualizações médias/dia"
                    value={formatNumber(accountInsightsSummary.avgViews)}
                    icon={<Eye className="h-3.5 w-3.5" />}
                    sub="média no período guardado"
                  />
                  <KpiCard
                    label="Contas engajadas/dia"
                    value={formatNumber(accountInsightsSummary.avgAccountsEngaged)}
                    icon={<Users className="h-3.5 w-3.5" />}
                    sub="média diária"
                  />
                  <KpiCard
                    label="Interações/dia"
                    value={formatNumber(accountInsightsSummary.avgInteractions)}
                    icon={<Heart className="h-3.5 w-3.5" />}
                    sub="média diária"
                  />
                  <KpiCard
                    label="Cliques no link"
                    value={formatNumber(accountInsightsSummary.profileLinksTaps)}
                    icon={<Link2 className="h-3.5 w-3.5" />}
                    sub="soma no período guardado"
                  />
                  <KpiCard
                    label="Pico de alcance/dia"
                    value={formatNumber(accountInsightsSummary.peakReach)}
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    sub={
                      accountInsightsSummary.peakViews > 0
                        ? `melhor dia · pico views ${formatNumber(accountInsightsSummary.peakViews)}`
                        : "melhor dia no período"
                    }
                  />
                </div>
                <InstagramAccountTrendChart data={accountTrendData} />
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                  Cada ponto do gráfico é o valor daquele dia. Somar vários dias não equivale ao
                  alcance único do período.
                  {accountInsightsScoped.length > 90 &&
                    " Com mais de 90 dias no banco, o gráfico agrupa por mês para facilitar a leitura."}
                </p>
              </SectionCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
              <SectionCard
                title="Demografia dos seguidores"
                description="Retrato atual na API Meta (this_month/this_week) — não é série histórica"
                action={<Users className="h-4 w-4 text-muted-foreground" />}
              >
                {!demographicsGrouped.hasAny ? (
                  <p className="text-sm text-muted-foreground">
                    Demografia ainda não coletada. Sincronize para coletar (requer 100+ seguidores na
                    conta; o Meta só libera demografia acima desse limite).
                  </p>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Gênero</p>
                      <DemographicBars
                        data={demographicsGrouped.gender}
                        format={genderLabel}
                        emptyLabel="Sem dados de gênero"
                        color="bg-violet-500"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Faixa etária</p>
                      <DemographicBars
                        data={demographicsGrouped.age}
                        emptyLabel="Sem dados de idade"
                        color="bg-sky-500"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Países</p>
                      <DemographicBars
                        data={demographicsGrouped.country}
                        format={countryLabel}
                        emptyLabel="Sem dados de país"
                        color="bg-emerald-500"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Cidades</p>
                      <DemographicBars
                        data={demographicsGrouped.city}
                        emptyLabel="Sem dados de cidade"
                        color="bg-amber-500"
                      />
                    </div>
                  </div>
                )}
              </SectionCard>
            </motion.div>
          </div>
        )}

        {/* Tab: Por área */}
        {activeTab === "areas" && (
          <InstagramAreaDashboard
            posts={posts}
            areas={areas}
            users={users}
            accountStats={accountStats}
            periodRange={periodRange}
            periodLabel={periodFilter.kind === "all" ? null : formatPeriodFilterLabel(periodFilter)}
          />
        )}

        {/* Tab: Postagens */}
        {activeTab === "posts" && (
          <div className="space-y-4">
            <SectionCard
              title="Filtros"
              description={`${filteredPosts.length} de ${posts.length} posts · ${postsFilterDescription}`}
              action={
                hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg shrink-0"
                    onClick={clearFilters}
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Limpar
                  </Button>
                ) : (
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                )
              }
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-5 min-w-[320px]">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Status do vínculo
                    </label>
                    <Select value={linkFilter} onValueChange={(v) => setLinkFilter(v as LinkFilter)}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Status do vínculo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os posts</SelectItem>
                        <SelectItem value="pendentes">
                          Pendentes ({linkCounts.pendentes})
                        </SelectItem>
                        <SelectItem value="vinculados">
                          Vinculados ({linkCounts.vinculados})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Área
                    </label>
                    <Select value={areaFilter} onValueChange={setAreaFilter}>
                      <SelectTrigger className="w-full rounded-xl">
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
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Solicitante
                    </label>
                    <Select value={solicitanteFilter} onValueChange={setSolicitanteFilter}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Filtrar por solicitante" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="all">Todos os solicitantes</SelectItem>
                        <SelectItem value="sem_solicitante">Sem solicitante</SelectItem>
                        {sortedUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                            {!isUserActive(u) ? " (Ex-funcionário)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Formato
                    </label>
                    <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
                      <SelectTrigger className="w-full rounded-xl">
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
                  </div>

                  <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tags
                    </label>
                    <Select value={tagFilter} onValueChange={setTagFilter}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Tags" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as tags</SelectItem>
                        <SelectItem value="Newsletter">Newsletter</SelectItem>
                        <SelectItem value="sem_tag">Sem tags</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ordenar por
                    </label>
                    <Select value={postSort} onValueChange={(v) => setPostSort(v as PostSortOption)}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        {POST_SORT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Lista de postagens"
              description="Vincule áreas e autores a cada post"
              noPadding
              action={
                filteredPosts.length > 0 ? (
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
                ) : undefined
              }
              bodyClassName="flex flex-col min-h-0"
            >
              {filteredPosts.length === 0 ? (
                <div className="p-10 text-center">
                  <Instagram className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    {posts.length === 0
                      ? 'Nenhum post sincronizado. Clique em "Sincronizar" para importar.'
                      : linkFilter === "pendentes"
                        ? "Todos os posts já estão vinculados."
                        : linkFilter === "vinculados"
                          ? 'Nenhum post vinculado. Use o filtro "Pendentes".'
                          : "Nenhum post corresponde aos filtros selecionados."}
                  </p>
                  {posts.length === 0 ? (
                    <Button
                      onClick={handleSync}
                      disabled={syncing}
                      variant="outline"
                      className="rounded-xl"
                    >
                      {syncing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sincronizar agora
                    </Button>
                  ) : hasActiveFilters ? (
                    <Button variant="outline" className="rounded-xl" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="max-h-[min(72vh,900px)] overflow-y-auto overscroll-contain px-5 py-4 space-y-3">
                    {pagination.items.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        users={users}
                        areas={areas}
                        saving={savingPostId === post.id}
                        accountAvgRate={accountAvgRate}
                        onAreasChange={setAreas}
                        onSave={(patch) => handleAssignmentChange(post.id, patch)}
                      />
                    ))}
                  </div>

                  <div className="border-t border-border/40 px-5 py-3 bg-muted/20">
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
                </>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
