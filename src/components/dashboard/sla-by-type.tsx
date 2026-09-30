"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { fetchSlaSources } from "@/lib/sla-data";
import {
  BATCH_THRESHOLD,
  computeArrivalStats,
  computeSlaReport,
  computeWeeklyLoad,
  evaluateSlaPolicy,
  formatHours,
  type SlaHitRate,
  type SlaPolicyResult,
  type SlaStageChange,
  type SlaTimeEntry,
  weekKey,
} from "@/lib/sla-metrics";
import { SLA_CONDITIONS, SLA_POLICIES, SLA_TIERS } from "@/lib/sla-policy";

interface SlaByTypeProps {
  requests: MarketingRequest[];
  periodLabel: string;
}

/** Abaixo disso o tipo é marcado como amostra pequena. */
const SMALL_SAMPLE = 7;

function pct(rate: SlaHitRate): number | null {
  return rate.total > 0 ? Math.round((rate.hit / rate.total) * 100) : null;
}

function hitClass(value: number | null) {
  if (value == null) return "text-muted-foreground";
  if (value >= 85) return "text-emerald-700 dark:text-emerald-400";
  if (value >= 70) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

/** "mesmo dia", "1 dia", "4,4 dias". */
function formatDays(days: number | null): string {
  if (days == null) return "—";
  const rounded = Math.round(days * 10) / 10;
  if (rounded === 0) return "mesmo dia";
  return rounded === 1 ? "1 dia" : `${rounded.toLocaleString("pt-BR")} dias`;
}

function formatWeekHours(hours: number | null): string {
  if (hours == null) return "—";
  return `${(Math.round(hours * 10) / 10).toLocaleString("pt-BR")}h`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#347796] dark:text-[#47cdd0]">{eyebrow}</span>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {children && <p className="max-w-3xl text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

function LoadBar({ label, hours, max, tone }: { label: string; hours: number | null; max: number; tone: "demand" | "logged" }) {
  const width = hours != null && max > 0 ? Math.min((hours / max) * 100, 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-x-3 gap-y-1 sm:grid-cols-[180px_minmax(0,1fr)_56px]">
      <span className="col-span-2 text-sm text-foreground sm:col-span-1">{label}</span>
      <div className="relative h-3 bg-[#e6f1f2] dark:bg-white/10" aria-hidden>
        <div
          className={cn(
            "absolute inset-y-0 left-0",
            tone === "demand" ? "bg-[#347796] dark:bg-[#47cdd0]" : "bg-[#48466e]/70 dark:bg-[#a9a6d8]"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-right text-sm font-semibold tabular-nums">{formatWeekHours(hours)}</span>
    </div>
  );
}

function PolicyRow({ row }: { row: SlaPolicyResult }) {
  const all = pct(row.all);
  const busy = pct(row.busy);
  const small = row.stats.concluidas < SMALL_SAMPLE;
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-medium text-foreground">
        {row.type}
        {small && (
          <span className="ml-2 rounded border border-border px-1.5 py-px text-[11px] font-medium text-muted-foreground">
            {row.stats.concluidas} {row.stats.concluidas === 1 ? "peça" : "peças"}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatHours(row.stats.esforcoHoras.mediana)}</TableCell>
      <TableCell className="whitespace-nowrap text-right tabular-nums">
        {formatDays(row.stats.primeiraVersaoDias.p80)} <span className="text-muted-foreground">· {formatDays(row.busyFirstVersionP80)}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right tabular-nums">
        {row.policy ? formatDays(row.policy.adjustmentDays) : "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right tabular-nums">
        {row.policy ? (
          <>
            <span className={cn("font-semibold", hitClass(all))}>{all == null ? "—" : `${all}%`}</span>{" "}
            <span className="text-muted-foreground">· {busy == null ? "—" : `${busy}%`}</span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="min-w-[200px] whitespace-normal text-xs text-muted-foreground">{row.policy?.note ?? ""}</TableCell>
    </TableRow>
  );
}

export function SlaByType({ requests, periodLabel }: SlaByTypeProps) {
  const [sources, setSources] = useState<{ timeEntries: SlaTimeEntry[]; stageChanges: SlaStageChange[] } | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSlaSources()
      .then((data) => {
        if (!cancelled) setSources(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => {
    if (!sources) return null;
    const report = computeSlaReport(requests, sources.timeEntries, sources.stageChanges);
    const load = computeWeeklyLoad(requests, report, sources.timeEntries, sources.stageChanges);
    const evaluation = evaluateSlaPolicy(report, load?.busyWeeks ?? new Set(), SLA_POLICIES);
    const byType = new Map(evaluation.rows.map((r) => [r.type, r]));
    const tiers = SLA_TIERS.map((tier) => ({
      ...tier,
      rows: tier.policies.flatMap((p) => {
        const row = byType.get(p.type);
        return row ? [row] : [];
      }),
    })).filter((tier) => tier.rows.length > 0);
    const unplanned = evaluation.rows.filter((r) => !r.policy);
    return { report, load, evaluation, tiers, unplanned, arrivals: computeArrivalStats(requests) };
  }, [requests, sources]);

  const handleExport = () => {
    if (!data) return;
    const { report, load, evaluation, tiers, unplanned } = data;

    const slaRows = [
      ...tiers.flatMap((tier) => tier.rows.map((r) => ({ faixa: `${tier.days} ${tier.days === 1 ? "dia útil" : "dias úteis"} (${tier.label})`, r }))),
      ...unplanned.map((r) => ({ faixa: "Sem SLA definido", r })),
    ].map(({ faixa, r }) => ({
      Faixa: faixa,
      Tipo: r.type,
      "SLA 1ª versão (dias úteis)": r.policy?.firstVersionDays ?? "",
      "Rodada de ajuste (dias úteis)": r.policy?.adjustmentDays ?? "",
      "Produção típica (h)": r.stats.esforcoHoras.mediana == null ? "" : Math.round(r.stats.esforcoHoras.mediana * 100) / 100,
      "Hoje: 80% saem em (dias úteis)": r.stats.primeiraVersaoDias.p80 == null ? "" : Math.round(r.stats.primeiraVersaoDias.p80 * 10) / 10,
      "Semana cheia: 80% saem em (dias úteis)": r.busyFirstVersionP80 == null ? "" : Math.round(r.busyFirstVersionP80 * 10) / 10,
      "Cumpriria – geral (%)": pct(r.all) ?? "",
      "Cumpriria – semana cheia (%)": pct(r.busy) ?? "",
      "Peças concluídas": r.stats.concluidas,
      Observação: r.policy?.note ?? "",
    }));

    const buildRows = report.rows.map((r) => ({
      Tipo: r.type,
      "Típico (h)": r.esforcoHoras.mediana == null ? "" : Math.round(r.esforcoHoras.mediana * 100) / 100,
      "80% levam até (h)": r.esforcoHoras.p80 == null ? "" : Math.round(r.esforcoHoras.p80 * 100) / 100,
      "Maior registro (h)": r.esforcoHoras.maximo == null ? "" : Math.round(r.esforcoHoras.maximo * 100) / 100,
      "Peças medidas": r.esforcoHoras.amostra,
      "Voltam para ajuste (%)": r.pctComAjuste == null ? "" : Math.round(r.pctComAjuste * 100),
    }));

    const weekRows = load
      ? [
          { Indicador: "Semanas analisadas", Valor: load.weeks },
          { Indicador: "Semanas cheias (25% mais pesadas)", Valor: load.busyWeeks.size },
          { Indicador: "Pedidos numa semana típica", Valor: load.typicalRequests },
          { Indicador: "Horas de produção pedidas numa semana típica", Valor: Math.round(load.typicalHours * 10) / 10 },
          { Indicador: "Semana cheia começa em (h pedidas)", Valor: Math.round(load.busyThresholdHours * 10) / 10 },
          { Indicador: "Semana mais pesada (h pedidas)", Valor: Math.round(load.maxHours * 10) / 10 },
          { Indicador: "Pedidos numa semana cheia (mín–máx)", Valor: `${load.busyRequestsMin}–${load.busyRequestsMax}` },
          { Indicador: "Horas apontadas numa semana típica", Valor: load.loggedTypical == null ? "" : Math.round(load.loggedTypical * 10) / 10 },
          { Indicador: "Horas apontadas numa semana forte (80%)", Valor: load.loggedStrong == null ? "" : Math.round(load.loggedStrong * 10) / 10 },
          { Indicador: "Maior semana apontada (h)", Valor: load.loggedMax == null ? "" : Math.round(load.loggedMax * 10) / 10 },
          { Indicador: "Cumpririam o SLA – geral (%)", Valor: pct(evaluation.all) ?? "" },
          { Indicador: "Cumpririam o SLA – semanas cheias (%)", Valor: pct(evaluation.busy) ?? "" },
          ...load.busyMix.map((m) => ({ Indicador: `Semana cheia: ${m.type} por semana`, Valor: Math.round(m.perWeek * 10) / 10 })),
        ]
      : [];

    const detailRows = report.details.map((d) => ({
      ID: d.id,
      Título: d.title,
      Tipo: d.type,
      "Solicitado em": formatDate(d.requestedAt),
      "1ª versão em": formatDate(d.firstVersionAt),
      "Até 1ª versão (dias úteis)": d.firstVersionBusinessDays ?? "",
      "Semana cheia": load?.busyWeeks.has(weekKey(d.requestedAt)) ? "Sim" : "Não",
      "Tempo de produção (h)": d.effortHours == null ? "" : Math.round(d.effortHours * 100) / 100,
      "Rodadas de ajuste": d.adjustmentRounds,
    }));

    const guideRows = [
      { Campo: "Período", Explicação: periodLabel },
      { Campo: "SLA", Explicação: "Prazo da 1ª versão em dias úteis, a partir do pedido completo. Cada rodada de ajuste tem prazo próprio." },
      { Campo: "1ª versão", Explicação: "Momento em que a peça saiu de produção pela primeira vez (revisão, aprovada, envio ou concluída)." },
      { Campo: "Semana cheia", Explicação: "As 25% semanas com mais horas de produção pedidas no período." },
      { Campo: "Cumpriria", Explicação: "Percentual das peças do período que saíram dentro do SLA proposto." },
      { Campo: "Produção", Explicação: "Horas apontadas no timesheet da peça. Típico = metade das peças levou até isso." },
      { Campo: "Dias úteis", Explicação: "Segunda a sexta, horário de Brasília, sem descontar feriados." },
      { Campo: "Base", Explicação: "Só o que passou pelo fluxo do sistema; o histórico da planilha antiga fica de fora." },
      ...SLA_CONDITIONS.map((c) => ({ Campo: c.title, Explicação: c.text })),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(slaRows), "SLA proposto");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildRows), "Tempo de producao");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weekRows), "Semana cheia");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Base por solicitacao");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guideRows), "Como ler");
    const stamp = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    XLSX.writeFile(wb, `sla-producao-${stamp}.xlsx`);
  };

  const load = data?.load ?? null;
  const allPct = data ? pct(data.evaluation.all) : null;
  const busyPct = data ? pct(data.evaluation.busy) : null;
  const barMax = load ? Math.max(load.maxHours, load.loggedMax ?? 0) : 0;

  return (
    <div className="rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(3,32,47,0.04),0_10px_30px_-26px_rgba(62,132,168,0.55)] dark:border-border/50 dark:bg-card/80">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#47cdd0]/12 text-[#347796] dark:bg-white/10 dark:text-white/50">
              <Timer className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-base font-semibold text-foreground">SLA de produção</h3>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Prazo proposto por tipo, dimensionado para semana cheia · {periodLabel}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 self-start whitespace-nowrap"
          onClick={handleExport}
          disabled={!data || data.report.rows.length === 0}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Exportar SLA
        </Button>
      </div>

      {loadError ? (
        <p className="px-5 pb-8 text-center text-sm text-destructive">Não foi possível carregar o timesheet e o histórico de etapas.</p>
      ) : !data ? (
        <p className="px-5 pb-8 text-center text-sm text-muted-foreground">Calculando prazos…</p>
      ) : data.report.rows.length === 0 ? (
        <p className="px-5 pb-8 text-center text-sm text-muted-foreground">Nenhuma solicitação concluída no período.</p>
      ) : (
        <div className="divide-y divide-[#dce9eb] dark:divide-border/50">
          <div className="grid grid-cols-2 border-t border-[#dce9eb] dark:border-border/50 lg:grid-cols-4">
            {[
              { value: allPct == null ? "—" : `${allPct}%`, label: "das peças do período cumpririam o SLA", tone: hitClass(allPct) },
              { value: busyPct == null ? "—" : `${busyPct}%`, label: "nas semanas cheias", tone: hitClass(busyPct) },
              {
                value: load ? `${load.typicalRequests} pedidos` : "—",
                label: load ? `numa semana típica, cerca de ${formatWeekHours(load.typicalHours)} de produção` : "numa semana típica",
                tone: "text-foreground",
              },
              {
                value: load ? `${load.busyRequestsMin} a ${load.busyRequestsMax}` : "—",
                label: load
                  ? `pedidos numa semana cheia, de ${formatWeekHours(load.busyThresholdHours)} a ${formatWeekHours(load.maxHours)} de produção`
                  : "pedidos numa semana cheia",
                tone: "text-foreground",
              },
            ].map((figure, i) => (
              <div
                key={figure.label}
                className={cn(
                  "space-y-1 p-5",
                  i % 2 === 1 && "border-l border-[#dce9eb] dark:border-border/50",
                  i >= 2 && "border-t border-[#dce9eb] dark:border-border/50 lg:border-t-0",
                  i === 2 && "lg:border-l"
                )}
              >
                <p className={cn("text-2xl font-bold tabular-nums leading-tight", figure.tone)}>{figure.value}</p>
                <p className="text-xs text-muted-foreground">{figure.label}</p>
              </div>
            ))}
          </div>

          <section className="space-y-4 p-5">
            <SectionTitle eyebrow="Proposta" title="Prazo por tipo de solicitação">
              Prazo da 1ª versão em dias úteis, a partir do pedido completo. &ldquo;Hoje&rdquo; mostra em quanto tempo 80% das peças saíram,
              no geral e nas semanas cheias; &ldquo;Cumpriria&rdquo; mostra quanto do período ficou dentro do prazo proposto.
            </SectionTitle>
            <div className="-mx-5 overflow-x-auto px-5">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Produção típica</TableHead>
                    <TableHead className="text-right">Hoje: 80% saem em</TableHead>
                    <TableHead className="text-right">Rodada de ajuste</TableHead>
                    <TableHead className="text-right">Cumpriria</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tiers.map((tier) => (
                    <Fragment key={tier.days}>
                      <TableRow className="bg-[#f3f9f9] hover:bg-[#f3f9f9] dark:bg-white/[0.04] dark:hover:bg-white/[0.04]">
                        <TableCell colSpan={6} className="py-2">
                          <span className="text-sm font-bold tabular-nums text-foreground">
                            {tier.days} {tier.days === 1 ? "dia útil" : "dias úteis"}
                          </span>
                          <span className="ml-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tier.label}</span>
                        </TableCell>
                      </TableRow>
                      {tier.rows.map((row) => (
                        <PolicyRow key={row.type} row={row} />
                      ))}
                    </Fragment>
                  ))}
                  {data.unplanned.length > 0 && (
                    <>
                      <TableRow className="bg-[#f3f9f9] hover:bg-[#f3f9f9] dark:bg-white/[0.04] dark:hover:bg-white/[0.04]">
                        <TableCell colSpan={6} className="py-2">
                          <span className="text-sm font-bold text-foreground">Sem SLA definido</span>
                        </TableCell>
                      </TableRow>
                      {data.unplanned.map((row) => (
                        <PolicyRow key={row.type} row={row} />
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Em &ldquo;Cumpriria&rdquo;, o primeiro número é o geral e o segundo só as semanas cheias. Verde a partir de 85%, âmbar de 70% a 84%,
              vermelho abaixo de 70%.
            </p>
          </section>

          <section className="space-y-4 p-5">
            <SectionTitle eyebrow="Dados" title="Quanto leva para construir cada peça">
              Horas de produção apontadas no timesheet, por peça. Típico é o tempo que metade das peças levou.
            </SectionTitle>
            <div className="-mx-5 overflow-x-auto px-5">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Típico</TableHead>
                    <TableHead className="text-right">80% levam até</TableHead>
                    <TableHead className="text-right">Maior registro</TableHead>
                    <TableHead className="text-right">Peças medidas</TableHead>
                    <TableHead className="text-right">Voltam para ajuste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.report.rows
                    .filter((r) => r.esforcoHoras.amostra > 0)
                    .map((r) => (
                      <TableRow key={r.type}>
                        <TableCell className="whitespace-nowrap font-medium text-foreground">{r.type}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatHours(r.esforcoHoras.mediana)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatHours(r.esforcoHoras.p80)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatHours(r.esforcoHoras.maximo)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.esforcoHoras.amostra}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.pctComAjuste == null ? "—" : `${Math.round(r.pctComAjuste * 100)}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {load && (
            <section className="space-y-5 p-5">
              <SectionTitle eyebrow="Carga" title="O que é uma semana cheia">
                {data.arrivals.pctBatchDays != null &&
                  `Em ${Math.round(data.arrivals.pctBatchDays * 100)}% dos dias chegam ${BATCH_THRESHOLD} ou mais pedidos de uma vez, com pico de ${data.arrivals.peak} num único dia. `}
                Semana cheia são as 25% semanas mais pesadas do período ({load.busyWeeks.size} de {load.weeks}), a partir de{" "}
                {formatWeekHours(load.busyThresholdHours)} de produção pedida.
              </SectionTitle>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Horas de produção pedidas na semana</span>
                  <LoadBar label="Semana típica" hours={load.typicalHours} max={barMax} tone="demand" />
                  <LoadBar label="Semana cheia começa em" hours={load.busyThresholdHours} max={barMax} tone="demand" />
                  <LoadBar label="Semana mais pesada" hours={load.maxHours} max={barMax} tone="demand" />
                </div>
                <div className="space-y-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Horas apontadas no timesheet na semana</span>
                  <LoadBar label="Semana típica" hours={load.loggedTypical} max={barMax} tone="logged" />
                  <LoadBar label="Semana forte (80%)" hours={load.loggedStrong} max={barMax} tone="logged" />
                  <LoadBar label="Maior semana" hours={load.loggedMax} max={barMax} tone="logged" />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">O que chega, em média, numa semana cheia</span>
                <div className="flex flex-wrap gap-2">
                  {load.busyMix
                    .filter((m) => m.perWeek >= 0.5)
                    .map((m) => (
                      <span key={m.type} className="rounded-md border border-[#dce9eb] px-2.5 py-1 text-xs tabular-nums dark:border-border/50">
                        <b className="text-foreground">{m.perWeek.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</b> {m.type}
                      </span>
                    ))}
                </div>
              </div>
            </section>
          )}

          <section className="space-y-3 p-5">
            <SectionTitle eyebrow="Condições" title="Para o SLA valer" />
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {SLA_CONDITIONS.map((c) => (
                <div key={c.title}>
                  <p className="text-sm font-medium text-foreground">{c.title}</p>
                  <p className="text-sm text-muted-foreground">{c.text}</p>
                </div>
              ))}
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Base: solicitações concluídas que passaram pelo fluxo do sistema; o histórico da planilha antiga fica de fora. Dias úteis
              sem descontar feriados.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

