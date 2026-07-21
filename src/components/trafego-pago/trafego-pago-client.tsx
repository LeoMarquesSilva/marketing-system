"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Megaphone,
  RefreshCw,
  Loader2,
  Eye,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  Users,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  ChevronDown,
  Info,
  Radio,
  Clock,
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
import {
  META_DATE_PRESETS,
  META_ADS_REFRESH_MS,
  formatMetaCurrency,
  formatMetaPercent,
  isAdsEntityActive,
  type MetaAdsDashboard,
  type MetaAdPerformance,
  type MetaCampaignGroup,
  type MetaAdSetGroup,
  type MetaDatePreset,
  type MetaMessagingMetrics,
} from "@/lib/meta-ads";
import { AdMediaPlayer } from "@/components/trafego-pago/ad-media-player";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins === 1) return "há 1 min";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  return hours === 1 ? "há 1 h" : `há ${hours} h`;
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border backdrop-blur-sm p-5 flex flex-col gap-3 transition-shadow",
        accent
          ? "border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/30"
          : "border-border/50 bg-background/50 dark:bg-card/50 shadow-sm hover:bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            accent ? "bg-emerald-500/10 text-emerald-700" : "bg-[#04202f]/8 text-[#04202f]/60"
          )}
        >
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

function statusBadge(status: string, small = false) {
  const active = isAdsEntityActive(status);
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    PAUSED: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    CAMPAIGN_PAUSED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    ADSET_PAUSED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  };
  const cls =
    map[status] ??
    (active
      ? "bg-emerald-100 text-emerald-800"
      : "bg-muted text-muted-foreground");
  const label = active ? "Ativa" : status.replace(/_/g, " ").toLowerCase();
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium capitalize",
        small ? "text-[10px]" : "text-xs",
        cls
      )}
    >
      {active && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {label}
    </Badge>
  );
}

type StatusFilter = "all" | "ACTIVE" | "PAUSED";
type SortKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "reach" | "conversations";

function sortAds(ads: MetaAdPerformance[], sortBy: SortKey): MetaAdPerformance[] {
  return [...ads].sort((a, b) => {
    if (sortBy === "conversations") {
      return b.messaging.conversations_started - a.messaging.conversations_started;
    }
    if (sortBy === "cpc") {
      const aValue = a.cpc > 0 ? a.cpc : Number.POSITIVE_INFINITY;
      const bValue = b.cpc > 0 ? b.cpc : Number.POSITIVE_INFINITY;
      return aValue - bValue;
    }
    const av = a[sortBy as keyof MetaAdPerformance] as number;
    const bv = b[sortBy as keyof MetaAdPerformance] as number;
    return bv - av;
  });
}

function hasMessaging(m: MetaMessagingMetrics) {
  return (
    m.conversations_started > 0 ||
    m.messaging_connections > 0 ||
    m.first_replies > 0
  );
}

function inactiveStyles(active: boolean) {
  return !active
    ? "opacity-55 grayscale-[0.35] saturate-50 border-dashed"
    : "";
}

export function TrafegoPagoClient() {
  const [datePreset, setDatePreset] = useState<MetaDatePreset>("maximum");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("spend");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<MetaAdsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const loadIdRef = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const currentLoadId = ++loadIdRef.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ datePreset });
        if (statusFilter !== "all") params.set("status", statusFilter);
        const res = await authFetch(`/api/meta-ads/insights?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar dados.");
        const dashboard = json as MetaAdsDashboard;
        if (currentLoadId !== loadIdRef.current) return;
        setData(dashboard);
        setLastUpdated(dashboard.fetchedAt ?? new Date().toISOString());
        setExpanded((prev) => {
          const open = { ...prev };
          for (const c of dashboard.campaigns) {
            if (open[`campaign:${c.campaign_id}`] === undefined) {
              open[`campaign:${c.campaign_id}`] = isAdsEntityActive(c.effective_status);
            }
            for (const a of c.adsets) {
              if (open[`adset:${a.adset_id}`] === undefined) {
                open[`adset:${a.adset_id}`] = isAdsEntityActive(a.effective_status);
              }
            }
          }
          return open;
        });
      } catch (err) {
        if (currentLoadId !== loadIdRef.current) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar.");
        if (!silent) setData(null);
      } finally {
        if (currentLoadId !== loadIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [datePreset, statusFilter]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(true), META_ADS_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const currency = data?.account.currency ?? "BRL";

  const campaignGroups = useMemo(() => {
    if (!data?.campaigns) return [];
    return data.campaigns.map((group) => ({
      ...group,
      adsets: group.adsets.map((adset) => ({
        ...adset,
        ads: sortAds(adset.ads, sortBy),
      })),
    }));
  }, [data?.campaigns, sortBy]);

  const activeCampaignGroups = useMemo(
    () => campaignGroups.filter((c) => isAdsEntityActive(c.effective_status)),
    [campaignGroups]
  );

  const totalLinkClicks = useMemo(
    () =>
      activeCampaignGroups.reduce(
        (s, g) =>
          s +
          g.adsets.reduce(
            (a, adset) => a + adset.ads.reduce((b, ad) => b + ad.link_clicks, 0),
            0
          ),
        0
      ),
    [activeCampaignGroups]
  );

  const messaging = data?.accountInsights.messaging;
  const showMessaging = messaging && hasMessaging(messaging);
  const activeCampaigns = campaignGroups.filter((c) =>
    isAdsEntityActive(c.effective_status)
  ).length;

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="rounded-lg border bg-card/60 backdrop-blur-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={datePreset}
            onValueChange={(v) => setDatePreset(v as MetaDatePreset)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {META_DATE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="PAUSED">Pausados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Ordenar anúncios por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spend">Maior investimento</SelectItem>
              <SelectItem value="impressions">Mais impressões</SelectItem>
              <SelectItem value="clicks">Mais cliques</SelectItem>
              <SelectItem value="conversations">Mais conversas WPP</SelectItem>
              <SelectItem value="ctr">Melhor CTR</SelectItem>
              <SelectItem value="cpc">Menor CPC</SelectItem>
              <SelectItem value="reach">Maior alcance</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="gap-2"
          >
            {loading || refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar
          </Button>

          {data?.account && (
            <span className="text-sm text-muted-foreground ml-auto hidden sm:inline">
              Conta: <strong>{data.account.name}</strong>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-border/50">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[#04202f]"
            />
            <span className="text-sm">Auto-atualizar (3 min)</span>
          </label>

          {lastUpdated && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {autoRefresh ? (
                <Radio className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
              Atualizado {formatRelativeTime(lastUpdated)}
              {refreshing && " · sincronizando…"}
            </span>
          )}

          {data?.dataLatencyNote && (
            <span className="text-xs text-muted-foreground hidden lg:inline">
              {data.dataLatencyNote}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-red-800 dark:text-red-300">
              Não foi possível carregar os anúncios
            </p>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando métricas da Meta…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              label="Investimento"
              value={formatMetaCurrency(data.accountInsights.spend, currency)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KpiCard
              label="Impressões"
              value={formatNumber(data.accountInsights.impressions)}
              icon={<Eye className="h-4 w-4" />}
            />
            <KpiCard
              label="Cliques"
              value={formatNumber(data.accountInsights.clicks)}
              sub={
                totalLinkClicks > 0
                  ? `${formatNumber(totalLinkClicks)} em links`
                  : undefined
              }
              icon={<MousePointerClick className="h-4 w-4" />}
            />
            <KpiCard
              label="CTR"
              value={formatMetaPercent(data.accountInsights.ctr)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              label="CPC médio"
              value={formatMetaCurrency(data.accountInsights.cpc, currency)}
              icon={<Megaphone className="h-4 w-4" />}
            />
            <KpiCard
              label="Alcance"
              value={formatNumber(data.accountInsights.reach)}
              sub={
                data.accountInsights.frequency > 0
                  ? `Freq. ${data.accountInsights.frequency.toFixed(2).replace(".", ",")}`
                  : undefined
              }
              icon={<Users className="h-4 w-4" />}
            />
          </div>

          {showMessaging && messaging && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp / Mensagens
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  label="Conversas iniciadas"
                  value={formatNumber(messaging.conversations_started)}
                  sub="Clique no anúncio → abriu chat"
                  icon={<MessageCircle className="h-4 w-4" />}
                  accent
                />
                <KpiCard
                  label="Conexões de mensagem"
                  value={formatNumber(messaging.messaging_connections)}
                  icon={<MessageCircle className="h-4 w-4" />}
                />
                <KpiCard
                  label="Primeiras respostas"
                  value={formatNumber(messaging.first_replies)}
                  sub={`${formatNumber(messaging.conversations_replied)} com reply em 7d`}
                  icon={<MessageCircle className="h-4 w-4" />}
                />
                <KpiCard
                  label="Custo por conversa"
                  value={
                    messaging.cost_per_conversation
                      ? formatMetaCurrency(messaging.cost_per_conversation, currency)
                      : "—"
                  }
                  icon={<DollarSign className="h-4 w-4" />}
                />
              </div>
              <div className="rounded-xl border border-blue-200/60 bg-blue-50/80 dark:bg-blue-950/20 dark:border-blue-900/50 p-4 flex gap-3 text-sm text-blue-900 dark:text-blue-200">
                <Info className="h-5 w-5 shrink-0 mt-0.5 opacity-70" />
                <p>
                  A Meta reporta <strong>quantas conversas</strong> cada anúncio gerou. Para ler os
                  chats, use a{" "}
                  <a
                    href="https://business.facebook.com/latest/inbox"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Caixa de Entrada do Meta Business
                  </a>
                  .
                </p>
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Campanhas ({campaignGroups.length})
              </h3>
              <span className="text-xs text-muted-foreground">
                {activeCampaigns} ativa{activeCampaigns !== 1 ? "s" : ""} · ativas primeiro
              </span>
            </div>

            {campaignGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 flex flex-col items-center justify-center text-center space-y-3 bg-muted/20">
                <Megaphone className="h-10 w-10 text-muted-foreground opacity-50" />
                <div>
                  <p className="font-medium text-foreground">Nenhuma campanha encontrada</p>
                  <p className="text-sm text-muted-foreground">Tente alterar o período ou os filtros selecionados acima.</p>
                </div>
              </div>
            ) : (
              campaignGroups.map((group) => (
                <CampaignSection
                  key={group.campaign_id}
                  group={group}
                  currency={currency}
                  campaignExpanded={expanded[`campaign:${group.campaign_id}`] ?? false}
                  adsetExpanded={expanded}
                  onToggleCampaign={() => toggleExpanded(`campaign:${group.campaign_id}`)}
                  onToggleAdset={(adsetId) => toggleExpanded(`adset:${adsetId}`)}
                />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CampaignSection({
  group,
  currency,
  campaignExpanded,
  adsetExpanded,
  onToggleCampaign,
  onToggleAdset,
}: {
  group: MetaCampaignGroup;
  currency: string;
  campaignExpanded: boolean;
  adsetExpanded: Record<string, boolean>;
  onToggleCampaign: () => void;
  onToggleAdset: (adsetId: string) => void;
}) {
  const isActive = isAdsEntityActive(group.effective_status);
  const totalAds = group.adsets.reduce((s, a) => s + a.ads.length, 0);
  const activeAds = group.adsets.reduce(
    (s, a) => s + a.ads.filter((ad) => ad.effective_status === "ACTIVE").length,
    0
  );
  const hasWpp = hasMessaging(group.messaging);

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden shadow-sm transition-all",
        isActive
          ? "bg-card border-emerald-200/60 dark:border-emerald-900/40 ring-1 ring-emerald-500/10"
          : "bg-muted/20 border-border/60",
        inactiveStyles(isActive)
      )}
    >
      <button
        type="button"
        onClick={onToggleCampaign}
        aria-expanded={campaignExpanded}
        aria-label={`${campaignExpanded ? "Recolher" : "Expandir"} campanha ${group.campaign_name}`}
        className={cn(
          "w-full text-left px-5 py-4 flex flex-wrap items-center gap-4 transition-colors",
          isActive ? "hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10" : "hover:bg-muted/30"
        )}
      >
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            !campaignExpanded && "-rotate-90"
          )}
        />
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-semibold text-base", !isActive && "text-muted-foreground")}>
              {group.campaign_name}
            </p>
            {statusBadge(group.effective_status)}
          </div>
          <p className="text-xs text-muted-foreground">
            {group.adsets.length} conjunto{group.adsets.length !== 1 ? "s" : ""} · {totalAds}{" "}
            anúncio{totalAds !== 1 ? "s" : ""}
            {activeAds > 0 && ` · ${activeAds} ativo${activeAds !== 1 ? "s" : ""}`}
          </p>
        </div>

      <div className="flex flex-col flex-wrap gap-x-6 gap-y-1 text-sm md:items-end">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <CampaignStat label="Investido" value={formatMetaCurrency(group.spend, currency)} muted={!isActive} />
          <CampaignStat label="Impressões" value={formatNumber(group.impressions)} muted={!isActive} />
          <CampaignStat label="Cliques" value={formatNumber(group.clicks)} muted={!isActive} />
          <CampaignStat label="CTR" value={formatMetaPercent(group.ctr)} muted={!isActive} />
        </div>
        {hasWpp && (
          <CampaignStat
            label="Conversas WPP"
            value={formatNumber(group.messaging.conversations_started)}
            highlight
          />
        )}
      </div>
      </button>

      {campaignExpanded && (
        <div className="border-t px-4 py-4 space-y-3 bg-muted/5">
          {group.adsets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum conjunto de anúncios nesta campanha.
            </p>
          ) : (
            group.adsets.map((adset) => (
              <AdSetSection
                key={adset.adset_id}
                adset={adset}
                currency={currency}
                expanded={adsetExpanded[`adset:${adset.adset_id}`] ?? false}
                onToggle={() => onToggleAdset(adset.adset_id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AdSetSection({
  adset,
  currency,
  expanded,
  onToggle,
}: {
  adset: MetaAdSetGroup;
  currency: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isActive = isAdsEntityActive(adset.effective_status);
  const activeAds = adset.ads.filter((a) => a.effective_status === "ACTIVE").length;
  const hasWpp = hasMessaging(adset.messaging);

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden ml-1 md:ml-3",
        isActive ? "bg-background/90 border-border/80" : "bg-muted/30 border-border/50",
        inactiveStyles(isActive)
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Recolher" : "Expandir"} conjunto ${adset.adset_name}`}
        className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-muted/30 transition-colors"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            !expanded && "-rotate-90"
          )}
        />
        <div className="flex-1 min-w-[160px] space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-medium text-sm", !isActive && "text-muted-foreground")}>
              {adset.adset_name}
            </p>
            {statusBadge(adset.effective_status, true)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {adset.ads.length} anúncio{adset.ads.length !== 1 ? "s" : ""}
            {activeAds > 0 && ` · ${activeAds} ativo${activeAds !== 1 ? "s" : ""}`}
          </p>
        </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <CampaignStat label="Investido" value={formatMetaCurrency(adset.spend, currency)} muted={!isActive} />
        <CampaignStat label="Imp." value={formatNumber(adset.impressions)} muted={!isActive} />
        {hasWpp && (
          <CampaignStat
            label="WPP"
            value={formatNumber(adset.messaging.conversations_started)}
            highlight
          />
        )}
      </div>
      </button>

      {expanded && (
        <div className="border-t px-3 py-3 space-y-3 bg-muted/5">
          {adset.ads.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum anúncio neste conjunto.
            </p>
          ) : (
            adset.ads.map((ad) => (
              <AdCard
                key={ad.ad_id}
                ad={ad}
                currency={currency}
                inactive={!isAdsEntityActive(ad.effective_status)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CampaignStat({
  label,
  value,
  highlight = false,
  muted = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        highlight && "text-emerald-700 dark:text-emerald-400",
        muted && !highlight && "opacity-70"
      )}
    >
      <span className="text-muted-foreground text-xs">{label}: </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function AdCard({
  ad,
  currency,
  inactive = false,
}: {
  ad: MetaAdPerformance;
  currency: string;
  inactive?: boolean;
}) {
  const hasWpp = hasMessaging(ad.messaging);
  const isActive = isAdsEntityActive(ad.effective_status);

  return (
    <article
      className={cn(
        "rounded-xl border bg-card flex flex-col sm:flex-row gap-4 p-4 transition-all",
        isActive ? "border-border/80 shadow-sm" : "border-dashed opacity-70 grayscale-[0.2]",
        inactive && "opacity-60"
      )}
    >
      <AdMediaPlayer
        videoId={ad.video_id}
        thumbnailUrl={ad.thumbnail_url}
        imageUrl={ad.image_url}
        mediaType={ad.media_type}
        adName={ad.ad_name}
        inactive={!isActive}
      />

      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-wrap items-start gap-2 justify-between">
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">{ad.ad_name}</p>
            {ad.creative_message && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {ad.creative_message.split("\n")[0]}
              </p>
            )}
          </div>
          {statusBadge(ad.effective_status, true)}
        </div>

        <div className="flex flex-wrap gap-2">
          <MetricPill label="Investido" value={formatMetaCurrency(ad.spend, currency)} />
          <MetricPill label="Imp." value={formatNumber(ad.impressions)} />
          <MetricPill label="Cliques" value={formatNumber(ad.clicks)} />
          <MetricPill label="CTR" value={formatMetaPercent(ad.ctr)} />
          <MetricPill label="CPC" value={formatMetaCurrency(ad.cpc, currency)} />
          <MetricPill label="Alcance" value={formatNumber(ad.reach)} />
          {hasWpp && (
            <MetricPill
              label="WPP"
              value={String(ad.messaging.conversations_started)}
              accent
            />
          )}
        </div>

        <a
          href={`https://www.facebook.com/ads/manager/account/ads?selected_ad_ids=${ad.ad_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors"
        >
          Abrir no Ads Manager
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}

function MetricPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs border",
        accent
          ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900"
          : "bg-muted/40 border-border/60"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}
