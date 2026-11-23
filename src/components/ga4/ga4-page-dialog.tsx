"use client";

import * as React from "react";
import { ExternalLink, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MetricsEmpty } from "@/components/social-metrics/metrics-ui";
import { CHART_COLORS, TrendChart } from "@/components/social-metrics/metrics-charts";
import { DeltaChip, ga4PageKindOf } from "@/components/ga4/ga4-pieces";
import { formatInt, formatPercent } from "@/lib/social-metrics/format";
import type { ResolvedMetricsPeriod } from "@/lib/social-metrics/period";
import { ga4PageDetail, ga4PageViewsSeries, isGa4UnknownPath } from "@/lib/ga4-analytics";
import type { Ga4DailyMetricRow, Ga4LandingPageMetricRow, Ga4PageMetricRow } from "@/lib/ga4-server";

const SITE_URL = "https://www.bismarchipires.com.br";

function Stat({
  label,
  value,
  current,
  previous,
  previousText,
  compareLabel,
  sub,
}: {
  label: string;
  value: string;
  current: number | null;
  previous: number | null;
  previousText: string;
  compareLabel: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-md bg-[#f6fafb] px-3 py-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold leading-none text-[#10232d]">{value}</dd>
      <dd className="mt-2">
        <DeltaChip current={current} previous={previous} previousText={previousText} compareLabel={compareLabel} />
      </dd>
      {sub && <dd className="mt-1.5 text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

/** Detalhe de uma página do site: visualizações dia a dia e o que ela trouxe como página de entrada. */
export function Ga4PageDialog({
  path,
  title,
  onOpenChange,
  period,
  pageRows,
  landingRows,
  dailyRows,
}: {
  path: string | null;
  title: string | null;
  onOpenChange: (open: boolean) => void;
  period: ResolvedMetricsPeriod;
  pageRows: Ga4PageMetricRow[];
  landingRows: Ga4LandingPageMetricRow[];
  dailyRows: Ga4DailyMetricRow[];
}) {
  const detail = React.useMemo(
    () => (path ? ga4PageDetail(path, pageRows, landingRows, period) : null),
    [path, pageRows, landingRows, period]
  );
  const trend = React.useMemo(() => {
    if (!path) return [];
    const now = ga4PageViewsSeries(path, pageRows, dailyRows, period.from, period.to);
    const before = ga4PageViewsSeries(path, pageRows, dailyRows, period.compareFrom, period.compareTo);
    return now.map((point, index) => ({
      date: point.date,
      value: point.value,
      previous: before[index]?.value ?? null,
      previousDate: before[index]?.date,
    }));
  }, [path, pageRows, dailyRows, period]);

  if (!path || !detail) return null;
  const kind = ga4PageKindOf(path);
  const KindIcon = kind.icon;
  const unknown = isGa4UnknownPath(path);
  const compareLabel = period.compareLabel;
  const rate = detail.entrances > 0 ? (detail.leads / detail.entrances) * 100 : null;
  const previousRate = detail.previousEntrances > 0 ? (detail.previousLeads / detail.previousEntrances) * 100 : null;
  const hasViews = detail.views > 0 || detail.previousViews > 0;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[#dce9eb] px-6 py-4 text-left">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-[#eef6f8] text-[#285f7a]" title={kind.label}>
              <KindIcon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base leading-snug">{unknown ? "Página não identificada" : title ?? path}</DialogTitle>
              <DialogDescription className="mt-0.5 truncate font-mono text-xs">
                {unknown ? "O GA4 não registrou o endereço dessa entrada." : path}
              </DialogDescription>
              <p className="mt-1 text-xs text-muted-foreground">{kind.label} · {period.label}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Visualizações"
              value={formatInt(detail.views)}
              current={detail.views}
              previous={detail.previousViews}
              previousText={formatInt(detail.previousViews)}
              compareLabel={compareLabel}
            />
            <Stat
              label="Sessões com a página"
              value={formatInt(detail.sessions)}
              current={detail.sessions}
              previous={detail.previousSessions}
              previousText={formatInt(detail.previousSessions)}
              compareLabel={compareLabel}
            />
            <Stat
              label="Entradas por ela"
              value={formatInt(detail.entrances)}
              current={detail.entrances}
              previous={detail.previousEntrances}
              previousText={formatInt(detail.previousEntrances)}
              compareLabel={compareLabel}
              sub="sessões que começaram aqui"
            />
            <Stat
              label="Leads dessas entradas"
              value={formatInt(detail.leads)}
              current={detail.leads}
              previous={detail.previousLeads}
              previousText={formatInt(detail.previousLeads)}
              compareLabel={compareLabel}
              sub={rate === null ? undefined : `taxa ${formatPercent(rate, 1)}${previousRate === null ? "" : ` (antes ${formatPercent(previousRate, 1)})`}`}
            />
          </dl>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-[#10232d]">Visualizações dia a dia</h4>
            {hasViews ? (
              <TrendChart
                data={trend}
                label={`Visualizações (${period.label.split("·").pop()?.trim()})`}
                previousLabel={compareLabel}
                color={CHART_COLORS.blue}
                height={200}
              />
            ) : (
              <MetricsEmpty
                icon={Eye}
                title="Sem visualizações registradas"
                description="O GA4 só manda o detalhe das páginas mais visitadas; esta não entrou na lista no período."
              />
            )}
            {hasViews && (
              <p className="mt-2 text-xs text-muted-foreground">
                O GA4 não manda dia sem visita: dia com dado do site e sem linha desta página aparece como zero.
              </p>
            )}
          </section>
        </div>

        {!unknown && path.startsWith("/") && (
          <div className="flex justify-end border-t border-[#dce9eb] px-6 py-3">
            <a
              href={`${SITE_URL}${path}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-[#347796] hover:text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
            >
              <ExternalLink className="size-4" aria-hidden />
              Abrir no site
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
