"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Info, Loader2, TrendingUp, Wallet2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EventosSubNav } from "@/components/eventos/eventos-sub-nav";
import {
  createEditionsForYear,
  formatBrl,
  type EventsForecast,
  type ForecastBaseSource,
} from "@/lib/eventos";
import { cn } from "@/lib/utils";

const BASE_SOURCE_LABEL: Record<ForecastBaseSource, string> = {
  realizado: "Realizado",
  previsto: "Previsto",
  verba: "Verba aprovada",
};

/**
 * Só o realizado é dinheiro que de fato saiu. Previsto e verba entram como
 * base na falta de coisa melhor, mas o usuário precisa enxergar a diferença.
 */
const BASE_SOURCE_STYLE: Record<ForecastBaseSource, string> = {
  realizado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  previsto: "bg-amber-50 text-amber-800 border-amber-200",
  verba: "bg-slate-100 text-slate-700 border-slate-200",
};

interface PlanejamentoClientProps {
  initialForecast: EventsForecast;
  years: number[];
}

export function PlanejamentoClient({ initialForecast, years }: PlanejamentoClientProps) {
  const [forecast, setForecast] = useState(initialForecast);
  const [adjustment, setAdjustment] = useState("0");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { targetYear, historyYears, rows, unlinkedCount } = forecast;

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const set = new Set([...years, currentYear, currentYear + 1, currentYear + 2, targetYear]);
    return [...set].sort((a, b) => b - a);
  }, [years, targetYear]);

  const adjustmentRate = useMemo(() => {
    const parsed = Number(adjustment.replace(",", "."));
    return Number.isFinite(parsed) ? parsed / 100 : 0;
  }, [adjustment]);

  /** Projeção por série, já com o reajuste aplicado sobre a base. */
  const projected = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of rows) {
      if (row.baseValue == null) continue;
      map[row.seriesId] = row.baseValue * (1 + adjustmentRate);
    }
    return map;
  }, [rows, adjustmentRate]);

  /** Só dá para abrir edição de série que tenha um ano anterior para copiar. */
  const creatable = useMemo(
    () =>
      rows.filter(
        (r) => !r.targetEventId && Object.keys(r.byYear).some((y) => Number(y) < targetYear)
      ),
    [rows, targetYear]
  );

  const totals = useMemo(() => {
    let projectedTotal = 0;
    let withBase = 0;
    const perYear: Record<number, number> = {};
    for (const year of historyYears) perYear[year] = 0;

    for (const row of rows) {
      const p = projected[row.seriesId];
      if (p != null) {
        projectedTotal += p;
        withBase++;
      }
      for (const year of historyYears) {
        const stats = row.byYear[year];
        if (stats) perYear[year] += stats.actualTotal || stats.plannedTotal;
      }
    }
    return { projectedTotal, withBase, perYear };
  }, [rows, historyYears, projected]);

  async function reload(year: number) {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eventos/previsao?year=${year}`);
      if (!res.ok) return;
      const data = await res.json();
      setForecast(data.forecast);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  function toggle(seriesId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === creatable.length ? new Set() : new Set(creatable.map((r) => r.seriesId))
    );
  }

  async function handleCreate() {
    const chosen = creatable.filter((r) => selected.has(r.seriesId));
    if (chosen.length === 0) return;

    setCreating(true);
    setFeedback(null);
    try {
      const results = await createEditionsForYear(chosen, targetYear);
      const ok = results.filter((r) => !r.error && r.newEventId).length;
      const failed = results.filter((r) => r.error);
      setFeedback(
        failed.length === 0
          ? `${ok} ${ok === 1 ? "edição criada" : "edições criadas"} em ${targetYear}.`
          : `${ok} criada(s). Falhas: ${failed.map((f) => `${f.seriesName} (${f.error})`).join("; ")}`
      );
      await reload(targetYear);
    } finally {
      setCreating(false);
    }
  }

  const selectedCount = creatable.filter((r) => selected.has(r.seriesId)).length;
  const lastHistoryYear = historyYears.at(-1) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Planejamento e previsão
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico de cada série ano a ano e a projeção de custo para o próximo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Planejar</span>
          <Select
            value={String(targetYear)}
            onValueChange={(v) => reload(Number(v))}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <EventosSubNav />

      <section className="rounded-lg border border-border/60 bg-gradient-to-br from-muted/40 to-muted/10 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<Wallet2 className="h-4 w-4" />}
            label={`Previsão ${targetYear}`}
            value={totals.projectedTotal > 0 ? formatBrl(totals.projectedTotal) : "—"}
            sub={`${totals.withBase} de ${rows.length} séries com base histórica`}
          />
          <SummaryCard
            icon={<TrendingUp className="h-4 w-4" />}
            label={lastHistoryYear ? `Base ${lastHistoryYear}` : "Base histórica"}
            value={
              lastHistoryYear && totals.perYear[lastHistoryYear] > 0
                ? formatBrl(totals.perYear[lastHistoryYear])
                : "—"
            }
            sub="Soma do último ano com dado"
          />
          <SummaryCard
            icon={<CalendarPlus className="h-4 w-4" />}
            label={`Séries sem edição em ${targetYear}`}
            value={String(creatable.length)}
            sub="Podem ser abertas a partir do ano anterior"
          />
          <SummaryCard
            icon={<Info className="h-4 w-4" />}
            label="Reajuste aplicado"
            value={`${adjustment || 0}%`}
            sub="Incide sobre a base de cada série"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div className="w-[160px]">
            <label htmlFor="reajuste" className="text-xs font-medium text-muted-foreground">
              Reajuste (%)
            </label>
            <Input
              id="reajuste"
              value={adjustment}
              inputMode="decimal"
              onChange={(e) => setAdjustment(e.target.value.replace(/[^\d.,-]/g, ""))}
              className="mt-1 tabular-nums"
              placeholder="0"
            />
          </div>
          <p className="text-xs text-muted-foreground flex-1 min-w-[240px] pb-2">
            A base de cada série é o valor mais recente disponível — realizado quando
            existe, senão previsto ou verba aprovada. Séries sem nenhum valor lançado não
            entram na soma.
          </p>
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma série cadastrada ainda. As séries são criadas junto com os eventos.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} série(s) selecionada(s)`
                : `${rows.length} séries`}
              {unlinkedCount > 0 && (
                <span className="ml-2 text-xs">
                  · {unlinkedCount} evento(s) avulso(s) fora da comparação
                </span>
              )}
            </div>
            <Button onClick={handleCreate} disabled={selectedCount === 0 || creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4 mr-1" />
              )}
              Abrir {selectedCount > 0 ? selectedCount : ""} edição(ões) em {targetYear}
            </Button>
          </div>

          {feedback && (
            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
              {feedback}
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas"
                      checked={creatable.length > 0 && selectedCount === creatable.length}
                      onChange={toggleAll}
                      disabled={creatable.length === 0}
                      className="h-4 w-4 rounded border-input"
                    />
                  </TableHead>
                  <TableHead>Série</TableHead>
                  {historyYears.map((y) => (
                    <TableHead key={y} className="text-right">
                      {y}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">R$/pessoa</TableHead>
                  <TableHead className="text-right">Previsão {targetYear}</TableHead>
                  <TableHead>Situação em {targetYear}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const rowProjection = projected[row.seriesId];
                  const canCreate = creatable.some((c) => c.seriesId === row.seriesId);
                  return (
                    <TableRow key={row.seriesId}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${row.seriesName}`}
                          checked={selected.has(row.seriesId)}
                          onChange={() => toggle(row.seriesId)}
                          disabled={!canCreate}
                          className="h-4 w-4 rounded border-input disabled:opacity-40"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{row.seriesName}</span>
                          {row.kind === "campanha" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-sky-50 text-sky-700 border-sky-200"
                            >
                              Campanha
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {historyYears.map((y) => {
                        const stats = row.byYear[y];
                        const value = stats ? stats.actualTotal || stats.plannedTotal : 0;
                        return (
                          <TableCell key={y} className="text-right text-sm tabular-nums">
                            {!stats ? (
                              <span className="text-muted-foreground/50">—</span>
                            ) : value > 0 ? (
                              <Link
                                href={`/eventos/${stats.eventId}`}
                                className="hover:underline hover:text-violet-700"
                              >
                                {formatBrl(value)}
                              </Link>
                            ) : (
                              <Link
                                href={`/eventos/${stats.eventId}`}
                                className="text-muted-foreground hover:underline"
                                title="Edição cadastrada, sem valor lançado"
                              >
                                sem valor
                              </Link>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        {row.baseValue != null && row.baseSource ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm tabular-nums">{formatBrl(row.baseValue)}</span>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px]", BASE_SOURCE_STYLE[row.baseSource])}
                            >
                              {BASE_SOURCE_LABEL[row.baseSource]} {row.baseYear}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {row.costPerParticipant != null ? formatBrl(row.costPerParticipant) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {rowProjection != null ? formatBrl(rowProjection) : "—"}
                      </TableCell>
                      <TableCell>
                        {row.targetEventId ? (
                          <Link
                            href={`/eventos/${row.targetEventId}`}
                            className="text-xs text-violet-700 hover:underline"
                          >
                            Edição aberta
                          </Link>
                        ) : canCreate ? (
                          <span className="text-xs text-muted-foreground">Não cadastrada</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">Sem histórico</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <tfoot className="border-t border-border/60 bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableCell />
                  <TableCell className="text-sm font-semibold">Total</TableCell>
                  {historyYears.map((y) => (
                    <TableCell key={y} className="text-right text-sm font-semibold tabular-nums">
                      {totals.perYear[y] > 0 ? formatBrl(totals.perYear[y]) : "—"}
                    </TableCell>
                  ))}
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right text-sm font-bold tabular-nums">
                    {totals.projectedTotal > 0 ? formatBrl(totals.projectedTotal) : "—"}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </tfoot>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
