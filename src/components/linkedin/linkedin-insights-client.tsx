"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Eye,
  FileClock,
  FileSpreadsheet,
  Link2,
  Linkedin,
  MousePointerClick,
  MapPin,
  MonitorSmartphone,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard, KpiCard, ComparisonStat } from "@/components/instagram/instagram-section-card";
import { InstagramPeriodPicker } from "@/components/instagram/instagram-period-picker";
import { LinkedinImportButton, type LinkedinImportFeedback } from "@/components/linkedin/linkedin-import-button";
import { LinkedinAudienceChart } from "@/components/linkedin/linkedin-audience-chart";
import { LinkedinDemographicRanking } from "@/components/linkedin/linkedin-demographic-ranking";
import { LinkedinPerformanceChart } from "@/components/linkedin/linkedin-performance-chart";
import { LinkedinPostCard } from "@/components/linkedin/linkedin-post-card";
import { LinkedinRankingList } from "@/components/linkedin/linkedin-ranking-list";
import {
  aggregateLinkedinDailyMetrics,
  aggregateLinkedinAudienceMetrics,
  buildLinkedinAudienceTrend,
  buildLinkedinMonthlyTrend,
  computeLinkedinPerformanceByArea,
  computeLinkedinPerformanceByAuthor,
  computeLinkedinPerformanceByFormat,
  getLinkedinPostTitle,
  percentDelta,
  type LinkedinTrendGranularity,
} from "@/lib/linkedin-analytics";
import {
  getPreviousRange,
  isWithinRange,
  resolvePeriodRange,
  type PeriodFilter,
} from "@/lib/instagram-period";
import type {
  LinkedinDashboardData,
  LinkedinDemographicDimension,
  LinkedinPost,
} from "@/lib/linkedin-types";
import { cn } from "@/lib/utils";

type LinkedinTab = "overview" | "audience" | "people" | "posts" | "imports";
type LinkFilter = "all" | "linked" | "pending";
type AudienceSource = "followers" | "visitors";

const TABS: Array<{ id: LinkedinTab; label: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "Visão geral", icon: BarChart3 },
  { id: "audience", label: "Seguidores & visitantes", icon: Users },
  { id: "people", label: "Áreas & autores", icon: Users },
  { id: "posts", label: "Publicações", icon: Linkedin },
  { id: "imports", label: "Importações", icon: FileClock },
];

const DEMOGRAPHIC_TABS: Array<{
  id: LinkedinDemographicDimension;
  label: string;
  icon: typeof MapPin;
}> = [
  { id: "location", label: "Localidade", icon: MapPin },
  { id: "function", label: "Função", icon: BriefcaseBusiness },
  { id: "seniority", label: "Experiência", icon: Users },
  { id: "industry", label: "Setor", icon: Building2 },
  { id: "company_size", label: "Empresa", icon: Building2 },
];

function formatNumber(value: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function metricDateIso(date: string): string {
  return `${date}T12:00:00`;
}

function getYears(data: LinkedinDashboardData): number[] {
  const years = new Set<number>([new Date().getFullYear()]);
  for (const row of data.dailyMetrics) years.add(Number(row.metric_date.slice(0, 4)));
  for (const row of data.followerDailyMetrics) years.add(Number(row.metric_date.slice(0, 4)));
  for (const row of data.visitorDailyMetrics) years.add(Number(row.metric_date.slice(0, 4)));
  for (const post of data.posts) {
    if (post.published_at) years.add(new Date(post.published_at).getFullYear());
  }
  return Array.from(years).filter(Number.isFinite).sort((left, right) => right - left);
}

function currentComparisonRange(data: LinkedinDashboardData, period: PeriodFilter) {
  const selected = resolvePeriodRange(period);
  if (selected) return selected;
  const lastDate = data.dailyMetrics.at(-1)?.metric_date;
  const to = lastDate ? new Date(`${lastDate}T00:00:00`) : new Date();
  to.setDate(to.getDate() + 1);
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return { from, to };
}

function comparePostsByMetric(left: LinkedinPost, right: LinkedinPost): number {
  return right.engagement_rate - left.engagement_rate || right.impressions - left.impressions;
}

function GranularityToggle({
  value,
  onChange,
}: {
  value: LinkedinTrendGranularity;
  onChange: (value: LinkedinTrendGranularity) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border/60 bg-slate-50 p-0.5">
      {(["day", "month"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
            value === option ? "bg-white text-[#0A66C2] shadow-sm" : "text-slate-400"
          )}
        >
          {option === "day" ? "Diário" : "Mensal"}
        </button>
      ))}
    </div>
  );
}

export function LinkedinInsightsClient({ initialData }: { initialData: LinkedinDashboardData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LinkedinTab>("overview");
  const [period, setPeriod] = useState<PeriodFilter>({ kind: "all" });
  const [feedback, setFeedback] = useState<LinkedinImportFeedback | { error: string } | null>(null);
  const [search, setSearch] = useState("");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [visiblePosts, setVisiblePosts] = useState(20);
  const [granularity, setGranularity] = useState<LinkedinTrendGranularity>("month");
  const [audienceSource, setAudienceSource] = useState<AudienceSource>("followers");
  const [demographicDimension, setDemographicDimension] = useState<LinkedinDemographicDimension>("location");

  const range = useMemo(() => resolvePeriodRange(period), [period]);
  const scopedDaily = useMemo(
    () => initialData.dailyMetrics.filter((row) => isWithinRange(metricDateIso(row.metric_date), range)),
    [initialData.dailyMetrics, range]
  );
  const scopedPosts = useMemo(
    () => initialData.posts.filter((post) => isWithinRange(post.published_at, range)),
    [initialData.posts, range]
  );
  const scopedFollowers = useMemo(
    () => initialData.followerDailyMetrics.filter((row) => isWithinRange(metricDateIso(row.metric_date), range)),
    [initialData.followerDailyMetrics, range]
  );
  const scopedVisitors = useMemo(
    () => initialData.visitorDailyMetrics.filter((row) => isWithinRange(metricDateIso(row.metric_date), range)),
    [initialData.visitorDailyMetrics, range]
  );
  const summary = useMemo(() => aggregateLinkedinDailyMetrics(scopedDaily), [scopedDaily]);
  const audienceSummary = useMemo(
    () => aggregateLinkedinAudienceMetrics(scopedFollowers, scopedVisitors),
    [scopedFollowers, scopedVisitors]
  );
  const trend = useMemo(
    () => buildLinkedinMonthlyTrend(scopedDaily, granularity),
    [granularity, scopedDaily]
  );
  const audienceTrend = useMemo(
    () => buildLinkedinAudienceTrend(scopedFollowers, scopedVisitors, granularity),
    [granularity, scopedFollowers, scopedVisitors]
  );
  const formats = useMemo(() => computeLinkedinPerformanceByFormat(scopedPosts), [scopedPosts]);
  const areas = useMemo(() => computeLinkedinPerformanceByArea(scopedPosts), [scopedPosts]);
  const authors = useMemo(() => computeLinkedinPerformanceByAuthor(scopedPosts), [scopedPosts]);
  const matchedCount = scopedPosts.filter((post) => post.instagram_post_id).length;
  const matchRate = scopedPosts.length > 0 ? matchedCount / scopedPosts.length : 0;

  const comparison = useMemo(() => {
    const currentRange = currentComparisonRange(initialData, period);
    const previousRange = getPreviousRange(currentRange);
    const currentRows = initialData.dailyMetrics.filter((row) =>
      isWithinRange(metricDateIso(row.metric_date), currentRange)
    );
    const previousRows = initialData.dailyMetrics.filter((row) =>
      isWithinRange(metricDateIso(row.metric_date), previousRange)
    );
    return {
      current: aggregateLinkedinDailyMetrics(currentRows),
      previous: aggregateLinkedinDailyMetrics(previousRows),
      currentPosts: initialData.posts.filter((post) => isWithinRange(post.published_at, currentRange)).length,
      previousPosts: initialData.posts.filter((post) => isWithinRange(post.published_at, previousRange)).length,
    };
  }, [initialData, period]);

  const filteredPosts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return scopedPosts
      .filter((post) => {
        if (linkFilter === "linked" && !post.instagram_post_id) return false;
        if (linkFilter === "pending" && post.instagram_post_id) return false;
        if (!term) return true;
        return [post.caption, post.byline, post.published_by]
          .some((value) => value?.toLocaleLowerCase("pt-BR").includes(term));
      })
      .sort(comparePostsByMetric);
  }, [linkFilter, scopedPosts, search]);

  const latestImport = initialData.imports[0] ?? null;
  const topPosts = [...scopedPosts].sort(comparePostsByMetric).slice(0, 5);
  const sponsoredShare = summary.impressions > 0 ? summary.sponsoredImpressions / summary.impressions : 0;
  const organicShare = summary.impressions > 0 ? 1 - sponsoredShare : 0;
  const mobileShare = audienceSummary.pageViews > 0
    ? audienceSummary.mobileViews / audienceSummary.pageViews
    : 0;
  const desktopShare = audienceSummary.pageViews > 0
    ? audienceSummary.desktopViews / audienceSummary.pageViews
    : 0;
  const demographicItems = initialData.demographics.filter(
    (item) => item.report_type === audienceSource && item.dimension === demographicDimension
  );
  const visitorPageMix = useMemo(() => {
    const totals = scopedVisitors.reduce(
      (current, row) => ({
        overview: current.overview + row.overview_views_total,
        life: current.life + row.life_views_total,
        jobs: current.jobs + row.jobs_views_total,
      }),
      { overview: 0, life: 0, jobs: 0 }
    );
    return [
      { label: "Visão geral", value: totals.overview },
      { label: "Dia a dia", value: totals.life },
      { label: "Vagas", value: totals.jobs },
    ];
  }, [scopedVisitors]);
  const demographicCapturedAt = demographicItems[0]?.captured_at ?? null;

  const handleLink = async (linkedinPostId: string, instagramPostId: string | null) => {
    setSavingPostId(linkedinPostId);
    try {
      const response = await fetch(`/api/linkedin-insights/posts/${linkedinPostId}/link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramPostId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Erro ao atualizar vínculo.");
      router.refresh();
    } catch (error) {
      setFeedback({ error: error instanceof Error ? error.message : "Erro ao atualizar vínculo." });
    } finally {
      setSavingPostId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Métricas orgânicas e patrocinadas com previews reaproveitados do Instagram.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InstagramPeriodPicker value={period} onChange={setPeriod} availableYears={getYears(initialData)} />
          <LinkedinImportButton disabled={Boolean(initialData.unavailableReason)} onFeedback={setFeedback} />
        </div>
      </div>

      {initialData.unavailableReason && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><p className="font-semibold">Banco ainda não preparado</p><p className="mt-0.5 text-xs">{initialData.unavailableReason}</p></div>
        </div>
      )}

      {feedback && (
        <div className={cn(
          "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
          "error" in feedback ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"
        )}>
          {"error" in feedback ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
          <div className="min-w-0">
            {"error" in feedback ? (
              <p>{feedback.error}</p>
            ) : (
              <>
                <p className="font-semibold">
                  {feedback.duplicate ? "Esse arquivo já estava importado." : "Relatório importado com sucesso."}
                </p>
                <p className="mt-0.5 text-xs">
                  {feedback.reportType === "content" ? "Conteúdo" : feedback.reportType === "followers" ? "Seguidores" : "Visitantes"}
                  {" · "}{feedback.dailyRows} dias
                  {feedback.postRows > 0 ? ` · ${feedback.postRows} posts` : ""}
                  {feedback.demographicRows > 0 ? ` · ${feedback.demographicRows} recortes` : ""}
                  {feedback.postRows > 0 ? ` · ${feedback.matchedPosts} previews vinculados` : ""}
                </p>
                {feedback.warnings.map((warning) => <p key={warning} className="mt-1 text-xs">{warning}</p>)}
              </>
            )}
          </div>
        </div>
      )}

      <section className="relative overflow-hidden rounded-[24px] bg-[#07141f] px-5 py-6 text-white shadow-[0_24px_80px_rgba(3,12,20,0.2)] sm:px-7">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#0A66C2]/35 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-64 bg-[#47cdd0]/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#79bdf5]">
              <Linkedin className="h-4 w-4" />
              Bismarchi | Pires
            </div>
            <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
              Uma leitura editorial do desempenho no LinkedIn.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
              Conteúdo, audiência e demografia no mesmo contexto, com publicações reconciliadas ao Instagram.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-widest text-white/45">Vínculos ativos</p>
              <p className="mt-2 font-mono text-2xl font-bold">{matchedCount}<span className="text-sm text-white/35">/{scopedPosts.length}</span></p>
              <p className="mt-1 text-[11px] text-[#79bdf5]">{formatPercent(matchRate)} com preview</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-widest text-white/45">Última carga</p>
              <p className="mt-2 truncate text-sm font-semibold">{latestImport?.filename ?? "Nenhum arquivo"}</p>
              <p className="mt-2 text-[11px] text-white/40">
                {latestImport ? new Date(latestImport.imported_at).toLocaleString("pt-BR") : "Aguardando importação"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Impressões" value={formatNumber(summary.impressions)} sub={`${formatNumber(summary.uniqueImpressions)} únicas (orgânicas)`} icon={<Eye className="h-3.5 w-3.5" />} />
        <KpiCard label="Cliques" value={formatNumber(summary.clicks)} sub={`${formatPercent(summary.ctr)} CTR ponderado`} icon={<MousePointerClick className="h-3.5 w-3.5" />} />
        <KpiCard label="Taxa de engajamento" value={formatPercent(summary.engagementRate)} sub={`${formatNumber(summary.actions)} ações registradas`} icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <KpiCard label="Publicações" value={scopedPosts.length} sub={`${matchedCount} com preview do Instagram`} icon={<Linkedin className="h-3.5 w-3.5" />} />
        <KpiCard label="Novos seguidores" value={formatNumber(audienceSummary.newFollowers)} sub={`${formatNumber(audienceSummary.organicFollowers)} orgânicos`} icon={<Users className="h-3.5 w-3.5" />} />
        <KpiCard label="Visitantes únicos" value={formatNumber(audienceSummary.uniqueVisitors)} sub={`${formatNumber(audienceSummary.pageViews)} visualizações`} icon={<MonitorSmartphone className="h-3.5 w-3.5" />} />
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-border/60" aria-label="Seções do LinkedIn Insights">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 px-3.5 py-3 text-sm font-medium transition-colors",
              activeTab === tab.id ? "text-[#0A66C2]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {activeTab === tab.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#0A66C2]" />}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="space-y-4">
          <SectionCard title="Comparativo de desempenho" description={period.kind === "all" ? "Últimos 30 dias contra os 30 dias anteriores" : "Período selecionado contra janela anterior equivalente"}>
            <div className="grid gap-3 sm:grid-cols-3">
              <ComparisonStat label="Impressões" value={formatNumber(comparison.current.impressions)} delta={percentDelta(comparison.current.impressions, comparison.previous.impressions)} deltaSuffix="%" />
              <ComparisonStat label="Cliques" value={formatNumber(comparison.current.clicks)} delta={percentDelta(comparison.current.clicks, comparison.previous.clicks)} deltaSuffix="%" />
              <ComparisonStat label="Posts publicados" value={String(comparison.currentPosts)} delta={percentDelta(comparison.currentPosts, comparison.previousPosts)} deltaSuffix="%" />
            </div>
          </SectionCard>

          <SectionCard
            title={granularity === "month" ? "Pulso mensal" : "Pulso diário"}
            description="Impressões em azul e taxa de engajamento em ciano"
            action={<GranularityToggle value={granularity} onChange={setGranularity} />}
          >
            <LinkedinPerformanceChart data={trend} />
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Performance por formato" description="Classificação enriquecida pelo vínculo com o Instagram">
              <LinkedinRankingList items={formats} emptyLabel="Sem formatos identificados." />
            </SectionCard>
            <SectionCard title="Orgânico x patrocinado" description="Participação das impressões no período">
              <div className="space-y-6 py-2">
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div><p className="text-xs text-muted-foreground">Orgânico</p><p className="mt-1 font-mono text-3xl font-bold">{formatPercent(organicShare)}</p></div>
                    <p className="text-sm font-semibold">{formatNumber(summary.impressions - summary.sponsoredImpressions)}</p>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0A66C2]" style={{ width: `${organicShare * 100}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div><p className="text-xs text-muted-foreground">Patrocinado</p><p className="mt-1 font-mono text-3xl font-bold">{formatPercent(sponsoredShare)}</p></div>
                    <p className="text-sm font-semibold">{formatNumber(summary.sponsoredImpressions)}</p>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#47cdd0]" style={{ width: `${sponsoredShare * 100}%` }} /></div>
                </div>
                {summary.sponsoredImpressions === 0 && <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><Sparkles className="mt-0.5 h-3.5 w-3.5 text-[#0A66C2]" />O relatório atual contém apenas publicações orgânicas.</div>}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Top publicações" description="Melhor taxa de engajamento dentro do período">
            <div className="divide-y divide-border/40">
              {topPosts.map((post, index) => (
                <a key={post.id} href={post.permalink} target="_blank" rel="noopener noreferrer" className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3.5 hover:bg-slate-50/70">
                  <span className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{getLinkedinPostTitle(post.caption)}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{formatNumber(post.impressions)} impressões · {formatNumber(post.clicks)} cliques</p></div>
                  <Badge variant="outline" className="font-mono text-[#0A66C2]">{formatPercent(post.engagement_rate)}</Badge>
                </a>
              ))}
              {topPosts.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Importe um relatório para ver o ranking.</p>}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "audience" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Crescimento líquido" value={formatNumber(audienceSummary.newFollowers)} sub={`${formatNumber(audienceSummary.organicFollowers)} orgânicos`} icon={<Users className="h-3.5 w-3.5" />} />
            <KpiCard label="Visualizações da página" value={formatNumber(audienceSummary.pageViews)} sub={`${formatPercent(mobileShare)} em dispositivos móveis`} icon={<Eye className="h-3.5 w-3.5" />} />
            <KpiCard label="Visitantes únicos" value={formatNumber(audienceSummary.uniqueVisitors)} sub="Soma dos únicos diários do período" icon={<Users className="h-3.5 w-3.5" />} />
            <KpiCard label="Visitas por visitante" value={audienceSummary.viewsPerVisitor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} sub="Frequência média observada" icon={<Activity className="h-3.5 w-3.5" />} />
            <KpiCard label="Convites automáticos" value={formatNumber(audienceSummary.autoInvitedFollowers)} sub={`${formatNumber(audienceSummary.sponsoredFollowers)} patrocinados`} icon={<Sparkles className="h-3.5 w-3.5" />} />
          </div>

          <SectionCard
            title={granularity === "month" ? "Audiência por mês" : "Audiência por dia"}
            description="Visualizações, visitantes únicos e aquisição líquida de seguidores"
            action={<GranularityToggle value={granularity} onChange={setGranularity} />}
          >
            <LinkedinAudienceChart data={audienceTrend} />
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <SectionCard title="Origem das visitas" description="Distribuição por dispositivo e seção da página">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mobile</p>
                    <p className="mt-2 font-mono text-2xl font-bold">{formatPercent(mobileShare)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatNumber(audienceSummary.mobileViews)} views</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Desktop</p>
                    <p className="mt-2 font-mono text-2xl font-bold">{formatPercent(desktopShare)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatNumber(audienceSummary.desktopViews)} views</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {visitorPageMix.map((item) => {
                    const share = audienceSummary.pageViews > 0 ? item.value / audienceSummary.pageViews : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-600">{item.label}</span>
                          <span className="font-mono text-slate-500">{formatNumber(item.value)} · {formatPercent(share)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#0A66C2]" style={{ width: `${share * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Perfil do público"
              description={demographicCapturedAt
                ? `Fotografia da importação de ${new Date(`${demographicCapturedAt}T12:00:00`).toLocaleDateString("pt-BR")}; não varia com o filtro de período`
                : "Importe seguidores e visitantes para visualizar os recortes"}
            >
              <div className="mb-4 space-y-3">
                <div className="flex w-fit rounded-xl border border-border/60 bg-slate-50 p-1">
                  {(["followers", "visitors"] as const).map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => setAudienceSource(source)}
                      className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", audienceSource === source ? "bg-white text-[#0A66C2] shadow-sm" : "text-muted-foreground")}
                    >
                      {source === "followers" ? "Seguidores" : "Visitantes"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {DEMOGRAPHIC_TABS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDemographicDimension(item.id)}
                      className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium", demographicDimension === item.id ? "bg-[#0A66C2]/10 text-[#0A66C2]" : "text-muted-foreground hover:bg-slate-50")}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <LinkedinDemographicRanking items={demographicItems} emptyLabel="Sem dados demográficos para este recorte." />
            </SectionCard>
          </div>
        </div>
      )}

      {activeTab === "people" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard title="Áreas com melhor resposta" description="Áreas herdadas dos posts correspondentes no Instagram" action={<Activity className="h-4 w-4 text-[#0A66C2]" />}>
            <LinkedinRankingList items={areas} emptyLabel="Vincule os posts ao Instagram para consolidar as áreas." />
          </SectionCard>
          <SectionCard title="Autores em destaque" description="Autores do Instagram, com byline do LinkedIn como fallback" action={<Users className="h-4 w-4 text-[#0A66C2]" />}>
            <LinkedinRankingList items={authors} emptyLabel="Ainda não há autores identificados no período." />
          </SectionCard>
        </div>
      )}

      {activeTab === "posts" && (
        <div className="space-y-4">
          <SectionCard title="Publicações e previews" description={`${filteredPosts.length} de ${scopedPosts.length} publicações no filtro`}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar legenda, autor ou publicador" className="h-9 rounded-xl pl-9" />
              </div>
              <div className="flex rounded-xl border border-border/60 bg-muted/20 p-1">
                {([['all', 'Todos'], ['linked', 'Vinculados'], ['pending', 'Pendentes']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setLinkFilter(value)} className={cn("rounded-lg px-3 py-1 text-xs font-medium transition", linkFilter === value ? "bg-white text-[#0A66C2] shadow-sm" : "text-muted-foreground")}>{label}</button>
                ))}
              </div>
            </div>
          </SectionCard>

          <div className="space-y-3">
            {filteredPosts.slice(0, visiblePosts).map((post) => (
              <LinkedinPostCard key={post.id} post={post} instagramCandidates={initialData.instagramCandidates} saving={savingPostId === post.id} onLink={handleLink} />
            ))}
            {filteredPosts.length === 0 && <div className="rounded-2xl border border-dashed border-border py-16 text-center"><Link2 className="mx-auto h-7 w-7 text-muted-foreground/40" /><p className="mt-3 text-sm text-muted-foreground">Nenhuma publicação encontrada.</p></div>}
            {visiblePosts < filteredPosts.length && <div className="flex justify-center pt-2"><Button variant="outline" className="rounded-xl" onClick={() => setVisiblePosts((value) => value + 20)}>Carregar mais</Button></div>}
          </div>
        </div>
      )}

      {activeTab === "imports" && (
        <SectionCard title="Histórico de importações" description="Arquivos processados, cobertura e qualidade dos vínculos" action={<FileSpreadsheet className="h-4 w-4 text-[#0A66C2]" />} noPadding>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border/50 bg-slate-50/80 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">Arquivo</th><th className="px-4 py-3 font-semibold">Tipo</th><th className="px-4 py-3 font-semibold">Importado em</th><th className="px-4 py-3 font-semibold">Cobertura</th><th className="px-4 py-3 font-semibold">Linhas</th><th className="px-4 py-3 font-semibold">Vínculos</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead>
              <tbody className="divide-y divide-border/40">
                {initialData.imports.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="max-w-[240px] truncate px-5 py-3.5 font-medium">{item.filename}</td>
                    <td className="px-4 py-3.5"><Badge variant="outline" className="bg-white">{item.report_type === "followers" ? "Seguidores" : item.report_type === "visitors" ? "Visitantes" : "Conteúdo"}</Badge></td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{new Date(item.imported_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{item.date_from ? new Date(`${item.date_from}T12:00:00`).toLocaleDateString("pt-BR") : "—"} – {item.date_to ? new Date(`${item.date_to}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{item.daily_rows} dias{item.post_rows > 0 ? ` · ${item.post_rows} posts` : ""}{item.demographic_rows > 0 ? ` · ${item.demographic_rows} recortes` : ""}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{item.post_rows > 0 ? `${item.matched_posts}/${item.post_rows}` : "—"}</td>
                    <td className="px-5 py-3.5"><Badge variant="outline" className={item.status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.status === "failed" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{item.status === "completed" ? "Concluído" : item.status === "failed" ? "Falhou" : "Processando"}</Badge></td>
                  </tr>
                ))}
                {initialData.imports.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-muted-foreground">Nenhum relatório importado.</td></tr>}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
