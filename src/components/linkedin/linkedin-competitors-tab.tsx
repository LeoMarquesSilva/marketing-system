"use client";

import * as React from "react";
import { CalendarRange, Crown, FileUp, MessageCircle, Newspaper, Swords, ThumbsUp, Trophy, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FilterChip, MetricsEmpty, MetricsSection } from "@/components/social-metrics/metrics-ui";
import { BarList, CHART_COLORS } from "@/components/social-metrics/metrics-charts";
import { formatImportDate } from "@/components/linkedin/linkedin-import-dialog";
import { formatInt } from "@/lib/social-metrics/format";
import { formatFullDate } from "@/lib/social-metrics/period";
import type { LinkedinCompetitorSnapshot, LinkedinDashboardData } from "@/lib/linkedin-types";

type Metric = "new_followers" | "reactions" | "publications" | "comments" | "reactions_per_post";

const METRICS: { key: Metric; label: string; icon: LucideIcon; color: string }[] = [
  { key: "new_followers", label: "Novos seguidores", icon: UserPlus, color: CHART_COLORS.purple },
  { key: "reactions", label: "Reações", icon: ThumbsUp, color: CHART_COLORS.ochre },
  { key: "publications", label: "Publicações", icon: Newspaper, color: CHART_COLORS.blue },
  { key: "comments", label: "Comentários", icon: MessageCircle, color: CHART_COLORS.teal },
  { key: "reactions_per_post", label: "Reações por publicação", icon: Trophy, color: CHART_COLORS.blue },
];

function isOwnPage(pageName: string): boolean {
  const normalized = pageName.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return normalized.includes("bismarchi") && normalized.includes("pires");
}

function metricValue(row: LinkedinCompetitorSnapshot, metric: Metric): number {
  if (metric === "reactions_per_post") return row.publications > 0 ? row.reactions / row.publications : 0;
  return row[metric];
}

function formatMetric(value: number, metric: Metric): string {
  return metric === "reactions_per_post" ? value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : formatInt(value);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function initials(name: string): string {
  return name
    .replace(/sociedade de advogados|advogados associados|advogados/gi, "")
    .split(/[\s|]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StatTile({ icon: Icon, label, value, sub, highlight }: { icon: LucideIcon; label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 rounded-lg border bg-white p-4", highlight ? "border-[#347796] shadow-[0_0_0_1px_#347796]" : "border-[#dce9eb]")}>
      <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#4a6470]">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#eef6f8] text-[#285f7a]">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <p className="font-mono text-[26px] font-semibold leading-none text-[#10232d]">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export function LinkedinCompetitorsTab({ data, onImport }: { data: LinkedinDashboardData; onImport: () => void }) {
  const [metric, setMetric] = React.useState<Metric>("new_followers");

  const latestImport = data.imports.find((item) => item.status === "completed" && item.report_type === "competitors");
  const rows = React.useMemo(
    () => (latestImport ? data.competitorSnapshots.filter((row) => row.import_id === latestImport.id) : []),
    [data.competitorSnapshots, latestImport]
  );

  if (!latestImport || rows.length === 0) {
    return (
      <div className="space-y-3">
        <MetricsEmpty
          icon={Swords}
          title="Sem relatório de concorrentes"
          description="Na página da empresa no LinkedIn, abra Análises › Concorrentes, exporte a planilha e importe aqui."
        />
        <div className="flex justify-center">
          <Button variant="outline" onClick={onImport}>
            <FileUp className="size-4" aria-hidden />
            Importar planilhas
          </Button>
        </div>
      </div>
    );
  }

  const own = rows.find((row) => isOwnPage(row.page_name)) ?? null;
  const rankOf = (key: Metric) =>
    own ? [...rows].sort((a, b) => metricValue(b, key) - metricValue(a, key)).findIndex((row) => row.id === own.id) + 1 : null;
  const selected = METRICS.find((item) => item.key === metric) ?? METRICS[0];
  const ranking = [...rows].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  const medianOf = (key: Metric) => median(rows.map((row) => metricValue(row, key)));
  const periodText =
    latestImport.date_from && latestImport.date_to
      ? `${formatFullDate(latestImport.date_from)} a ${formatFullDate(latestImport.date_to)}`
      : "período informado pelo LinkedIn";

  const tile = (key: Metric, icon: LucideIcon, label: string) => {
    const rank = rankOf(key);
    const med = medianOf(key);
    return (
      <StatTile
        icon={icon}
        label={label}
        value={rank ? `${rank}º de ${rows.length}` : "—"}
        sub={own ? `Nós: ${formatMetric(metricValue(own, key), key)} · mediana das páginas: ${med === null ? "—" : formatMetric(med, key)}` : "Nossa página não está no relatório."}
        highlight={rank === 1}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-[#dce9eb] bg-[#f6fafb] px-4 py-3 text-xs text-[#36505c]">
        <span className="inline-flex items-center gap-1.5 font-medium text-[#10232d]">
          <CalendarRange className="size-4 text-[#347796]" aria-hidden />
          Relatório de {periodText}
        </span>
        <span>Importado em {formatImportDate(latestImport.imported_at)}.</span>
        <span>O período escolhido acima não muda este relatório: o LinkedIn entrega a comparação já fechada.</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tile("new_followers", UserPlus, "Posição em novos seguidores")}
        {tile("reactions", ThumbsUp, "Posição em reações")}
        {tile("publications", Newspaper, "Posição em publicações")}
        {tile("reactions_per_post", Trophy, "Posição em reações por publicação")}
      </div>

      <MetricsSection
        title={`${selected.label} por página`}
        icon={selected.icon}
        description={`${rows.length} páginas no relatório. A nossa aparece em negrito.`}
        action={
          <div className="flex flex-wrap gap-2">
            {METRICS.map((item) => (
              <FilterChip key={item.key} selected={metric === item.key} onClick={() => setMetric(item.key)} icon={item.icon}>
                {item.label}
              </FilterChip>
            ))}
          </div>
        }
      >
        <BarList
          items={ranking.map((row) => {
            const mine = isOwnPage(row.page_name);
            return {
              key: row.id,
              label: (
                <span className={cn("inline-flex items-center gap-1.5", mine && "font-semibold text-[#10232d]")}>
                  {mine && <Crown className="size-3.5 text-[#c47f2a]" aria-label="Nossa página" />}
                  {row.page_name}
                </span>
              ),
              value: metricValue(row, metric),
            };
          })}
          color={selected.color}
          format={(value) => formatMetric(value, metric)}
        />
      </MetricsSection>

      <MetricsSection title="Quadro completo" icon={Swords} description={`Todos os números do relatório de ${periodText}, na ordem de ${selected.label.toLowerCase()}.`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#edf3f5] text-left text-xs text-[#6b8591]">
                <th className="py-2 pr-3 font-medium">Página</th>
                {METRICS.map((item) => (
                  <th key={item.key} className={cn("px-3 py-2 text-right font-medium", item.key === metric && "text-[#10232d]")}>
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((row, index) => {
                const mine = isOwnPage(row.page_name);
                return (
                  <tr key={row.id} className={cn("border-b border-[#f1f5f7] last:border-0", mine && "bg-[#f5fafc]")}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-center font-mono text-xs font-semibold text-[#6b8591]">{index + 1}</span>
                        <Avatar className="size-8 ring-1 ring-[#dce9eb]">
                          <AvatarFallback className={cn("text-xs font-semibold", mine ? "bg-[#347796] text-white" : "bg-[#e8f1f5] text-[#315f73]")}>
                            {initials(row.page_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className={cn("block truncate", mine ? "font-semibold text-[#10232d]" : "text-[#1d3440]")}>{row.page_name}</span>
                          {mine && <span className="rounded-full bg-[#347796] px-1.5 text-xs text-white">nós</span>}
                        </span>
                      </div>
                    </td>
                    {METRICS.map((item) => (
                      <td
                        key={item.key}
                        className={cn("px-3 py-2.5 text-right font-mono", item.key === metric ? "font-semibold text-[#10232d]" : "text-[#36505c]")}
                      >
                        {formatMetric(metricValue(row, item.key), item.key)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </MetricsSection>
    </div>
  );
}
