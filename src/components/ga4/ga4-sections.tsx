"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bot,
  Compass,
  DoorOpen,
  FileText,
  Flame,
  Hand,
  MapPin,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  MousePointerClick,
  Send,
  Share2,
  Target,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChip, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { CHANNEL_COLORS, CHART_COLORS, ShareBar, TrendChart } from "@/components/social-metrics/metrics-charts";
import { DeltaChip, RankRow, SuspectBadge, ga4ChannelIcon, ga4PageKindOf } from "@/components/ga4/ga4-pieces";
import { formatInt, formatPercent } from "@/lib/social-metrics/format";
import type { ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import {
  aggregateGa4KeyEvents,
  aggregateGa4LandingPages,
  aggregateGa4Locations,
  aggregateGa4Pages,
  ga4ChannelBreakdown,
  ga4KeyEventTotals,
  ga4RowsInRange,
  ga4SocialSeries,
  ga4SocialTraffic,
  ga4SuspectTraffic,
  isGa4SocialChannel,
  isGa4UnknownPath,
  isSuspectGa4Location,
  summarizeGa4Devices,
  translateGa4City,
  translateGa4Country,
  type Ga4PeriodTotals,
} from "@/lib/ga4-analytics";
import type {
  Ga4ChannelMetricRow,
  Ga4DailyMetricRow,
  Ga4DeviceMetricRow,
  Ga4KeyEventMetricRow,
  Ga4LandingPageMetricRow,
  Ga4LocationMetricRow,
  Ga4PageMetricRow,
} from "@/lib/ga4-server";

function periodShortLabel(period: ResolvedMetricsPeriod): string {
  return period.label.split("·").pop()?.trim() ?? period.label;
}

/* ------------------------------------------------ por onde as pessoas chegam */

export function Ga4ChannelsSection({
  period,
  channelRows,
  className,
}: {
  period: ResolvedMetricsPeriod;
  channelRows: Ga4ChannelMetricRow[];
  className?: string;
}) {
  const channels = React.useMemo(() => ga4ChannelBreakdown(channelRows, period), [channelRows, period]);
  const top = Math.max(1, ...channels.map((channel) => channel.sessions));
  const hasSocial = channels.some((channel) => isGa4SocialChannel(channel.channelGroup));

  return (
    <MetricsSection
      className={className}
      title="Por onde as pessoas chegam"
      icon={Compass}
      description={`Canal de origem das sessões no período e a variação contra ${period.compareLabel}.`}
    >
      {channels.length ? (
        <>
          <ul className="-mx-2 space-y-0.5">
            {channels.map((channel) => {
              const social = isGa4SocialChannel(channel.channelGroup);
              return (
                <RankRow
                  key={channel.label}
                  icon={ga4ChannelIcon(channel.channelGroup)}
                  iconLabel={channel.label}
                  title={channel.label}
                  subtitle={channel.hint}
                  value={formatInt(channel.sessions)}
                  valueSub={
                    <>
                      <span>{formatPercent(channel.share, 0)}</span>
                      <DeltaChip
                        current={channel.sessions}
                        previous={channel.previousSessions}
                        previousText={`${formatInt(channel.previousSessions)} sessões`}
                        compareLabel={period.compareLabel}
                      />
                    </>
                  }
                  ratio={channel.sessions / top}
                  color={social ? CHANNEL_COLORS.site : CHART_COLORS.blue}
                />
              );
            })}
          </ul>
          {hasSocial && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-1.5 w-4 rounded-full" style={{ background: CHANNEL_COLORS.site }} aria-hidden />
              Redes sociais, detalhadas em “Das redes para o site”.
            </p>
          )}
        </>
      ) : (
        <MetricsEmpty icon={Compass} title="Sem canais neste período" description="O GA4 não tem sessões por canal para as datas escolhidas." />
      )}
    </MetricsSection>
  );
}

/* ----------------------------------------------------- das redes para o site */

export function Ga4SocialSection({
  period,
  channelRows,
  dailyRows,
  className,
}: {
  period: ResolvedMetricsPeriod;
  channelRows: Ga4ChannelMetricRow[];
  dailyRows: Ga4DailyMetricRow[];
  className?: string;
}) {
  const current = React.useMemo(() => ga4SocialTraffic(channelRows, dailyRows, period.from, period.to), [channelRows, dailyRows, period]);
  const previous = React.useMemo(
    () => ga4SocialTraffic(channelRows, dailyRows, period.compareFrom, period.compareTo),
    [channelRows, dailyRows, period]
  );
  const trend = React.useMemo(() => {
    const now = ga4SocialSeries(channelRows, dailyRows, period.from, period.to);
    const before = ga4SocialSeries(channelRows, dailyRows, period.compareFrom, period.compareTo);
    return now.map((point, index) => ({
      date: point.date,
      value: point.value,
      previous: before[index]?.value ?? null,
      previousDate: before[index]?.date,
    }));
  }, [channelRows, dailyRows, period]);

  return (
    <MetricsSection
      className={className}
      title="Das redes para o site"
      icon={Share2}
      description="Sessões que chegaram pelo Instagram, LinkedIn e outras redes, orgânico e pago."
    >
      {current.sessions === null ? (
        <MetricsEmpty icon={Waypoints} title="Sem dados do site neste período" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[26px] font-semibold leading-none text-[#10232d]">{formatInt(current.sessions)}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">sessões vindas das redes</p>
            </div>
            <DeltaChip
              current={current.sessions}
              previous={previous.sessions}
              previousText={`${formatInt(previous.sessions)} sessões`}
              compareLabel={period.compareLabel}
            />
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t border-[#edf3f5] pt-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Parte das sessões do site</dt>
              <dd className="mt-0.5 font-mono text-base font-semibold text-[#10232d]">{formatPercent(current.share, 1)}</dd>
              <dd className="text-muted-foreground">antes {formatPercent(previous.share, 1)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Orgânico · pago</dt>
              <dd className="mt-0.5 font-mono text-base font-semibold text-[#10232d]">
                {formatInt(current.organic)} · {formatInt(current.paid)}
              </dd>
              <dd className="text-muted-foreground">sessões</dd>
            </div>
          </dl>
          {trend.some((point) => point.value !== null) && (
            <TrendChart
              data={trend}
              label={`Sessões vindas das redes (${periodShortLabel(period)})`}
              previousLabel={period.compareLabel}
              color={CHANNEL_COLORS.site}
              height={160}
            />
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Cliques em links sem UTM (por exemplo, o da bio) podem aparecer como “Acesso direto”.
          </p>
        </div>
      )}
    </MetricsSection>
  );
}

/* ------------------------------------------------------ da visita ao contato */

interface FunnelStage {
  key: string;
  label: string;
  icon: LucideIcon;
  value: number | null;
  previous: number | null;
  color: string;
  detail?: string;
}

function keyEventIcon(eventName: string): LucideIcon {
  if (eventName === "form_submit") return Send;
  if (eventName.startsWith("ads_conversion")) return Megaphone;
  return Target;
}

export function Ga4FunnelSection({
  period,
  totals,
  previousTotals,
  keyEventRows,
  className,
}: {
  period: ResolvedMetricsPeriod;
  totals: Ga4PeriodTotals;
  previousTotals: Ga4PeriodTotals;
  keyEventRows: Ga4KeyEventMetricRow[];
  className?: string;
}) {
  const contacts = (t: Ga4PeriodTotals) => (t.sessions === null ? null : (t.conversions ?? 0) + (t.whatsappClicks ?? 0));
  const stages: FunnelStage[] = [
    { key: "sessoes", label: "Sessões", icon: MousePointerClick, value: totals.sessions, previous: previousTotals.sessions, color: CHART_COLORS.blue },
    {
      key: "engajadas",
      label: "Sessões engajadas",
      icon: Hand,
      value: totals.engagedSessions,
      previous: previousTotals.engagedSessions,
      color: CHART_COLORS.blue,
      detail: "ficaram mais de 10 s, viram 2 páginas ou mais, ou geraram um evento-chave",
    },
    {
      key: "contatos",
      label: "Contatos",
      icon: MessageCircle,
      value: contacts(totals),
      previous: contacts(previousTotals),
      color: CHART_COLORS.teal,
      detail: `${formatInt(totals.conversions)} leads + ${formatInt(totals.whatsappClicks)} cliques no WhatsApp`,
    },
  ];
  const base = totals.sessions ?? 0;
  const rateBetween = (from: number | null, to: number | null) => (from && from > 0 && to !== null ? (to / from) * 100 : null);
  const steps = [
    { label: "engajaram", rate: rateBetween(stages[0].value, stages[1].value) },
    { label: "das sessões engajadas viraram contato", rate: rateBetween(stages[1].value, stages[2].value) },
  ];

  const keyEvents = React.useMemo(() => aggregateGa4KeyEvents(ga4RowsInRange(keyEventRows, period.from, period.to)), [keyEventRows, period]);
  const previousKeyEvents = React.useMemo(
    () => ga4KeyEventTotals(keyEventRows, period.compareFrom, period.compareTo),
    [keyEventRows, period]
  );

  return (
    <MetricsSection
      className={className}
      title="Da visita ao contato"
      icon={Target}
      description="Quantas visitas viram conversa: sessões, as que engajaram e os contatos gerados no período."
    >
      {totals.sessions === null ? (
        <MetricsEmpty icon={Target} title="Sem dados do site neste período" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ol className="space-y-1">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const ratio = base > 0 && stage.value !== null ? stage.value / base : 0;
              return (
                <React.Fragment key={stage.key}>
                  <li>
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#eef6f8] text-[#285f7a]">
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-[#10232d]">{stage.label}</span>
                          {stage.detail && <span className="block text-xs text-muted-foreground">{stage.detail}</span>}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-base font-semibold text-[#10232d]">{formatInt(stage.value)}</span>
                        <DeltaChip
                          current={stage.value}
                          previous={stage.previous}
                          previousText={formatInt(stage.previous)}
                          compareLabel={period.compareLabel}
                        />
                      </span>
                    </div>
                    <div className="mt-2 h-3 rounded-full bg-[#eef3f5]" aria-hidden>
                      <div className="h-3 rounded-full" style={{ width: `${Math.max(1.5, Math.min(100, ratio * 100))}%`, background: stage.color }} />
                    </div>
                  </li>
                  {index < steps.length && (
                    <li className="py-1.5 pl-9">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dce9eb] bg-white px-2 py-0.5 text-xs text-[#4a6470]">
                        <span className="font-mono font-semibold text-[#10232d]">{formatPercent(steps[index].rate, 1)}</span>
                        {steps[index].label}
                      </span>
                    </li>
                  )}
                </React.Fragment>
              );
            })}
          </ol>

          <div className="min-w-0 border-t border-[#edf3f5] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <p className="text-xs font-semibold text-[#4a6470]">O que conta como lead (eventos-chave)</p>
            {keyEvents.length ? (
              <ul className="mt-3 space-y-3">
                {keyEvents.map((event) => {
                  const Icon = keyEventIcon(event.eventName);
                  const previous = previousKeyEvents.get(event.eventName) ?? 0;
                  return (
                    <li key={event.eventName} className="flex items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#eef6f8] text-[#285f7a]">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-[#10232d]">{event.label}</span>
                        <span className="block text-xs text-muted-foreground">{formatPercent(event.share, 0)} dos eventos-chave</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-sm font-semibold text-[#10232d]">{formatInt(event.count)}</span>
                        <DeltaChip current={event.count} previous={previous} previousText={formatInt(previous)} compareLabel={period.compareLabel} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Nenhum evento-chave registrado no período.</p>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              O mesmo envio do formulário pode disparar os dois eventos.
            </p>
          </div>
        </div>
      )}
    </MetricsSection>
  );
}

/* --------------------------------------------------- páginas que geram contato */

type LandingSort = "leads" | "entradas";

export function Ga4LandingSection({
  period,
  landingRows,
  titles,
  onOpenPage,
  className,
}: {
  period: ResolvedMetricsPeriod;
  landingRows: Ga4LandingPageMetricRow[];
  titles: Map<string, string>;
  onOpenPage: (path: string) => void;
  className?: string;
}) {
  const [sort, setSort] = React.useState<LandingSort>("leads");
  const all = React.useMemo(() => aggregateGa4LandingPages(ga4RowsInRange(landingRows, period.from, period.to), 200), [landingRows, period]);
  const rows = React.useMemo(() => {
    const sorted = [...all];
    if (sort === "entradas") sorted.sort((a, b) => b.sessions - a.sessions || b.conversions - a.conversions);
    return sorted.slice(0, 8);
  }, [all, sort]);
  const best = all
    .filter((page) => page.sessions >= 10 && page.conversions > 0 && !isGa4UnknownPath(page.landingPage))
    .sort((a, b) => b.conversionRate - a.conversionRate)[0]?.landingPage;

  return (
    <MetricsSection
      className={className}
      title="Páginas que geram contato"
      icon={DoorOpen}
      description="Página por onde a pessoa entrou no site e quantos leads saíram dessas visitas. Clique para ver o detalhe."
      action={
        all.length > 0 ? (
          <div className="flex gap-1.5" role="group" aria-label="Ordenar páginas de entrada">
            <FilterChip selected={sort === "leads"} onClick={() => setSort("leads")}>
              Mais leads
            </FilterChip>
            <FilterChip selected={sort === "entradas"} onClick={() => setSort("entradas")}>
              Mais entradas
            </FilterChip>
          </div>
        ) : undefined
      }
    >
      {rows.length ? (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-2 pb-2 font-medium">Página de entrada</th>
                <th className="px-2 pb-2 text-right font-medium">Entradas</th>
                <th className="px-2 pb-2 text-right font-medium">Leads</th>
                <th className="px-2 pb-2 text-right font-medium">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf3f5]">
              {rows.map((page) => {
                const unknown = isGa4UnknownPath(page.landingPage);
                const kind = ga4PageKindOf(page.landingPage);
                const KindIcon = kind.icon;
                const title = unknown ? "Página não identificada" : titles.get(page.landingPage) ?? page.landingPage;
                return (
                  <tr key={page.landingPage} className="transition-colors hover:bg-[#f4fafb]">
                    <td className="max-w-0 px-2 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenPage(page.landingPage)}
                        className="flex w-full min-w-0 items-center gap-2.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#eef6f8] text-[#285f7a]" title={kind.label}>
                          <KindIcon className="size-4" aria-hidden />
                          <span className="sr-only">{kind.label}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium text-[#10232d]">{title}</span>
                            {page.landingPage === best && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#347796] px-2 py-0.5 text-xs font-medium text-white">
                                <Flame className="size-3" aria-hidden />
                                melhor taxa
                              </span>
                            )}
                          </span>
                          {!unknown && title !== page.landingPage && (
                            <span className="block truncate font-mono text-xs text-muted-foreground">{page.landingPage}</span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[#36505c]">{formatInt(page.sessions)}</td>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-[#10232d]">{formatInt(page.conversions)}</td>
                    <td className={cn("px-2 py-2 text-right font-mono", page.conversions > 0 ? "text-[#10232d]" : "text-[#8aa0aa]")}>
                      {formatPercent(page.conversionRate, 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <MetricsEmpty icon={DoorOpen} title="Sem páginas de entrada neste período" />
      )}
    </MetricsSection>
  );
}

/* --------------------------------------------------- páginas mais visitadas */

export function Ga4TopPagesSection({
  period,
  pageRows,
  titles,
  onOpenPage,
  className,
}: {
  period: ResolvedMetricsPeriod;
  pageRows: Ga4PageMetricRow[];
  titles: Map<string, string>;
  onOpenPage: (path: string) => void;
  className?: string;
}) {
  const pages = React.useMemo(() => aggregateGa4Pages(ga4RowsInRange(pageRows, period.from, period.to), 10), [pageRows, period]);
  const top = Math.max(1, ...pages.map((page) => page.screenPageViews));

  return (
    <MetricsSection
      className={className}
      title="Páginas mais visitadas"
      icon={FileText}
      description="Visualizações no período. O ícone indica o tipo de página, pelo endereço."
    >
      {pages.length ? (
        <ul className="-mx-2 space-y-0.5">
          {pages.map((page) => {
            const kind = ga4PageKindOf(page.pagePath);
            const title = titles.get(page.pagePath) ?? page.pagePath;
            return (
              <RankRow
                key={page.pagePath}
                icon={kind.icon}
                iconLabel={kind.label}
                title={title}
                subtitle={title !== page.pagePath ? <span className="font-mono">{page.pagePath}</span> : undefined}
                value={formatInt(page.screenPageViews)}
                valueSub={<span>{formatPercent(page.share, 0)}</span>}
                ratio={page.screenPageViews / top}
                color={CHART_COLORS.blue}
                onOpen={() => onOpenPage(page.pagePath)}
              />
            );
          })}
        </ul>
      ) : (
        <MetricsEmpty icon={FileText} title="Sem páginas neste período" />
      )}
    </MetricsSection>
  );
}

/* ------------------------------------------------------------------ cidades */

export function Ga4CitiesSection({
  period,
  locationRows,
  dailyRows,
  className,
}: {
  period: ResolvedMetricsPeriod;
  locationRows: Ga4LocationMetricRow[];
  dailyRows: Ga4DailyMetricRow[];
  className?: string;
}) {
  const [hideSuspect, setHideSuspect] = React.useState(false);
  const locations = React.useMemo(() => aggregateGa4Locations(ga4RowsInRange(locationRows, period.from, period.to), 60), [locationRows, period]);
  const suspect = React.useMemo(() => ga4SuspectTraffic(locationRows, dailyRows, period.from, period.to), [locationRows, dailyRows, period]);
  const visible = locations.filter((location) => !hideSuspect || !isSuspectGa4Location(location.city, location.country)).slice(0, 10);
  const top = Math.max(1, ...visible.map((location) => location.sessions));
  const suspectCount = locations.filter((location) => isSuspectGa4Location(location.city, location.country)).length;

  return (
    <MetricsSection
      className={className}
      title="Onde está o público"
      icon={MapPin}
      description="Cidades com mais sessões no período (o GA4 manda só as mais frequentes)."
      action={
        suspectCount > 0 ? (
          <FilterChip selected={hideSuspect} onClick={() => setHideSuspect((value) => !value)} icon={Bot} count={hideSuspect ? suspectCount : undefined}>
            Esconder atípicos
          </FilterChip>
        ) : undefined
      }
    >
      {suspect.share !== null && suspect.share >= 5 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            Ao menos <strong className="font-semibold">{formatPercent(suspect.share, 0)}</strong> das sessões do período ({formatInt(suspect.suspectSessions)} de{" "}
            {formatInt(suspect.totalSessions)}) vieram de locais típicos de robô ou data center. Elas inflam as sessões e derrubam a taxa de engajamento.
          </p>
        </div>
      )}
      {visible.length ? (
        <ul className="-mx-2 space-y-0.5">
          {visible.map((location) => {
            const flagged = isSuspectGa4Location(location.city, location.country);
            return (
              <RankRow
                key={`${location.city}-${location.country}`}
                icon={flagged ? Bot : MapPin}
                iconLabel={flagged ? "Local atípico" : "Cidade"}
                iconTone={flagged ? "warning" : "default"}
                title={translateGa4City(location.city)}
                subtitle={translateGa4Country(location.country)}
                badge={flagged ? <SuspectBadge /> : undefined}
                value={formatInt(location.sessions)}
                valueSub={<span>{formatPercent(location.share, 0)}</span>}
                ratio={location.sessions / top}
                color={flagged ? CHART_COLORS.previous : CHART_COLORS.blue}
              />
            );
          })}
        </ul>
      ) : (
        <MetricsEmpty icon={MapPin} title="Sem cidades neste período" />
      )}
    </MetricsSection>
  );
}

/* -------------------------------------------------------------- dispositivos */

const DEVICE_COLORS: Record<string, string> = {
  Computador: CHART_COLORS.blue,
  Celular: CHART_COLORS.ochre,
  Tablet: CHART_COLORS.purple,
};

export function Ga4DevicesSection({
  period,
  deviceRows,
  className,
}: {
  period: ResolvedMetricsPeriod;
  deviceRows: Ga4DeviceMetricRow[];
  className?: string;
}) {
  const devices = React.useMemo(() => summarizeGa4Devices(ga4RowsInRange(deviceRows, period.from, period.to)), [deviceRows, period]);
  const previous = React.useMemo(
    () => summarizeGa4Devices(ga4RowsInRange(deviceRows, period.compareFrom, period.compareTo)),
    [deviceRows, period]
  );
  const mobile = devices.find((device) => device.device === "Celular");
  const previousMobile = previous.find((device) => device.device === "Celular");

  return (
    <MetricsSection className={className} title="Dispositivos" icon={MonitorSmartphone} description="Por onde as pessoas acessam o site.">
      {devices.length ? (
        <div className="space-y-4">
          <ShareBar
            segments={devices.map((device) => ({
              key: device.device,
              label: device.device,
              value: device.sessions,
              color: DEVICE_COLORS[device.device] ?? CHART_COLORS.teal,
            }))}
          />
          {mobile && (
            <p className="border-t border-[#edf3f5] pt-3 text-xs leading-relaxed text-muted-foreground">
              O celular respondeu por <span className="font-medium text-[#10232d]">{formatPercent(mobile.share, 0)}</span> das sessões
              {previousMobile ? ` (antes ${formatPercent(previousMobile.share, 0)}, em ${period.compareLabel})` : ""}.
            </p>
          )}
        </div>
      ) : (
        <MetricsEmpty icon={MonitorSmartphone} title="Sem dispositivos neste período" />
      )}
    </MetricsSection>
  );
}
