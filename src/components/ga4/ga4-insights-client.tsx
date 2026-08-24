"use client";

import { useMemo, useState } from "react";
import {
  RefreshCw,
  Users,
  MousePointerClick,
  FileText,
  Clock,
  MapPin,
  Smartphone,
  Sparkles,
  Lightbulb,
  TriangleAlert,
  Target,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Ga4DashboardData } from "@/lib/ga4-server";
import {
  GA4_DATE_RANGES,
  type Ga4DateRangeDays,
  buildGa4Trend,
  buildGa4Insight,
  summarizeGa4,
  summarizeGa4Channels,
  summarizeGa4Devices,
  aggregateGa4Pages,
  aggregateGa4Locations,
  aggregateGa4LandingPages,
  aggregateGa4KeyEvents,
  isLikelySuspectLocation,
  splitLastNDays,
} from "@/lib/ga4-analytics";
import { Ga4TrendChart } from "@/components/ga4/ga4-trend-chart";

interface Ga4InsightsClientProps {
  initialData: Ga4DashboardData;
}

function formatSeconds(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function deltaLabel(current: number, previous: number): { text: string; positive: boolean } | null {
  if (previous <= 0) return null;
  const diff = ((current - previous) / previous) * 100;
  return { text: `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}%`, positive: diff >= 0 };
}

export function Ga4InsightsClient({ initialData }: Ga4InsightsClientProps) {
  const [data, setData] = useState(initialData);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<Ga4DateRangeDays>(30);

  const { current: dailyCurrent, previous: dailyPrevious } = useMemo(
    () => splitLastNDays(data.dailyMetrics, rangeDays),
    [data.dailyMetrics, rangeDays]
  );
  const { current: channelCurrent } = useMemo(
    () => splitLastNDays(data.channelMetrics, rangeDays),
    [data.channelMetrics, rangeDays]
  );
  const { current: pageCurrent } = useMemo(
    () => splitLastNDays(data.pageMetrics, rangeDays),
    [data.pageMetrics, rangeDays]
  );
  const { current: locationCurrent } = useMemo(
    () => splitLastNDays(data.locationMetrics, rangeDays),
    [data.locationMetrics, rangeDays]
  );
  const { current: deviceCurrent } = useMemo(
    () => splitLastNDays(data.deviceMetrics, rangeDays),
    [data.deviceMetrics, rangeDays]
  );
  const { current: landingCurrent } = useMemo(
    () => splitLastNDays(data.landingPageMetrics, rangeDays),
    [data.landingPageMetrics, rangeDays]
  );
  const { current: keyEventCurrent } = useMemo(
    () => splitLastNDays(data.keyEventMetrics, rangeDays),
    [data.keyEventMetrics, rangeDays]
  );

  const trend = useMemo(() => buildGa4Trend(dailyCurrent), [dailyCurrent]);
  const summary = useMemo(() => summarizeGa4(dailyCurrent), [dailyCurrent]);
  const previousSummary = useMemo(() => summarizeGa4(dailyPrevious), [dailyPrevious]);
  const channels = useMemo(() => summarizeGa4Channels(channelCurrent), [channelCurrent]);
  const devices = useMemo(() => summarizeGa4Devices(deviceCurrent), [deviceCurrent]);
  const pages = useMemo(() => aggregateGa4Pages(pageCurrent, 10), [pageCurrent]);
  const locations = useMemo(() => aggregateGa4Locations(locationCurrent, 10), [locationCurrent]);
  const landingPages = useMemo(() => aggregateGa4LandingPages(landingCurrent, 8), [landingCurrent]);
  const keyEvents = useMemo(() => aggregateGa4KeyEvents(keyEventCurrent), [keyEventCurrent]);
  const newVisitorShare = summary.activeUsers > 0 ? (summary.newUsers / summary.activeUsers) * 100 : 0;

  const insight = useMemo(
    () => buildGa4Insight({ summary, previousSummary, channels, locations, devices, landingPages, rangeDays }),
    [summary, previousSummary, channels, locations, devices, landingPages, rangeDays]
  );

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/ga4-insights/sync", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Erro ao sincronizar.");
      }
      const refreshed = await fetch("/api/ga4-insights", { credentials: "include" });
      if (refreshed.ok) {
        const json = (await refreshed.json()) as { data: Ga4DashboardData };
        setData(json.data);
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

  if (data.unavailableReason) {
    return (
      <div className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
        {data.unavailableReason}
      </div>
    );
  }

  const cards = [
    {
      label: "Sessões",
      value: summary.sessions,
      delta: deltaLabel(summary.sessions, previousSummary.sessions),
      icon: MousePointerClick,
      hint: "Visitas ao site no período",
    },
    {
      label: "Usuários ativos",
      value: summary.activeUsers,
      delta: deltaLabel(summary.activeUsers, previousSummary.activeUsers),
      icon: Users,
      hint: "Pessoas diferentes que visitaram",
    },
    {
      label: "Conversões (leads)",
      value: summary.conversions,
      delta: deltaLabel(summary.conversions, previousSummary.conversions),
      icon: Target,
      hint: "Formulários enviados + conversões de anúncio",
    },
    {
      label: "Cliques no WhatsApp",
      value: summary.whatsappClicks,
      delta: deltaLabel(summary.whatsappClicks, previousSummary.whatsappClicks),
      icon: MessageCircle,
      hint: "Pessoas que clicaram no botão do WhatsApp",
    },
    {
      label: "Páginas visualizadas",
      value: summary.screenPageViews,
      delta: deltaLabel(summary.screenPageViews, previousSummary.screenPageViews),
      icon: FileText,
      hint: "Total de páginas abertas",
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Período:</span>
          <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v) as Ga4DateRangeDays)}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GA4_DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={String(r.value)}>
                  Últimos {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {data.lastImport
              ? `Sincronizado: ${new Date(data.lastImport.imported_at).toLocaleString("pt-BR")}`
              : "Ainda não sincronizado."}
          </p>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 rounded-xl border border-[#47cdd0]/30 bg-[#47cdd0]/5 px-4 py-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#04202f]" />
        <p className="text-sm leading-relaxed text-[#04202f]">{insight}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <card.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums">{card.value.toLocaleString("pt-BR")}</p>
              {card.delta && (
                <span
                  className={`text-xs font-medium ${card.delta.positive ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {card.delta.text}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{card.hint}</p>
          </div>
        ))}
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Visitantes novos</p>
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold tabular-nums">{newVisitorShare.toFixed(0)}%</p>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">nunca tinham visitado antes</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Tempo médio no site</p>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold tabular-nums">{formatSeconds(summary.avgEngagementSeconds)}</p>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">por visita, em média</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold">Sessões ao longo do tempo</h3>
        <p className="mb-3 text-xs text-muted-foreground">Volume de visitas dia a dia e % de engajamento (linha)</p>
        <Ga4TrendChart data={trend} />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">De onde vêm os leads</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Página por onde a pessoa entrou no site e taxa de conversão em formulário/lead — mostra o que realmente traz resultado, não só tráfego
        </p>
        {landingPages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem conversões no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Página de entrada</th>
                  <th className="pb-2 text-right font-medium">Sessões</th>
                  <th className="pb-2 text-right font-medium">Conversões</th>
                  <th className="pb-2 text-right font-medium">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {landingPages.map((page) => (
                  <tr key={page.landingPage} className="border-b last:border-0">
                    <td className="max-w-[240px] truncate py-2 font-medium">{page.landingPage}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {page.sessions.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {page.conversions.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <span
                        className={
                          page.conversionRate >= 20
                            ? "font-semibold text-emerald-600"
                            : page.conversionRate > 0
                              ? "text-muted-foreground"
                              : "text-muted-foreground/50"
                        }
                      >
                        {page.conversionRate.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {keyEvents.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4 border-t pt-3">
            {keyEvents.map((event) => (
              <div key={event.eventName} className="text-xs">
                <p className="text-muted-foreground">{event.label}</p>
                <p className="text-sm font-semibold tabular-nums">
                  {event.count.toLocaleString("pt-BR")}{" "}
                  <span className="font-normal text-muted-foreground">({event.share.toFixed(0)}%)</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Por onde as pessoas chegam</h3>
          <p className="mb-3 text-xs text-muted-foreground">Canal de origem da sessão</p>
          {channels.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-2.5">
              {channels.map((channel) => (
                <div key={channel.channel} className="space-y-1" title={channel.hint}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{channel.channel}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {channel.sessions.toLocaleString("pt-BR")} · {channel.share.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#47cdd0]"
                      style={{ width: `${Math.max(channel.share, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Dispositivo</h3>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">De onde as pessoas acessam o site</p>
          {devices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-2.5">
              {devices.map((device) => (
                <div key={device.device} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{device.device}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {device.sessions.toLocaleString("pt-BR")} · {device.share.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#04202f]"
                      style={{ width: `${Math.max(device.share, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Páginas mais visitadas</h3>
          <p className="mb-3 text-xs text-muted-foreground">O que faz as pessoas ficarem no site</p>
          {pages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {pages.map((page, index) => (
                <div key={page.pagePath} className="flex items-center justify-between gap-3 text-xs">
                  <span className="w-4 shrink-0 text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{page.pageTitle || page.pagePath}</p>
                    <p className="truncate text-muted-foreground">{page.pagePath}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular-nums font-medium">{page.screenPageViews.toLocaleString("pt-BR")}</p>
                    <p className="tabular-nums text-[10px] text-muted-foreground">{page.share.toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Onde está o seu público</h3>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Cidade de origem das sessões</p>
          {locations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {locations.map((location, index) => {
                const suspect = isLikelySuspectLocation(location.city);
                return (
                  <div
                    key={`${location.city}-${location.country}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="w-4 shrink-0 text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-medium">{location.city}</p>
                        {suspect && (
                          <span
                            className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                            title="Padrão típico de tráfego automatizado (bot/datacenter), não de público real"
                          >
                            <TriangleAlert className="h-2.5 w-2.5" />
                            atípico
                          </span>
                        )}
                      </div>
                      <p className="truncate text-muted-foreground">{location.country}</p>
                    </div>
                    <span className="shrink-0 tabular-nums font-medium">
                      {location.sessions.toLocaleString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
