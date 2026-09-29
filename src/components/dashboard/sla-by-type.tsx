"use client";

import { useEffect, useMemo, useState } from "react";
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
import { TypeIcon } from "@/lib/type-icons";
import { cn } from "@/lib/utils";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { fetchSlaSources } from "@/lib/sla-data";
import {
  computeSlaReport,
  formatBusinessDays,
  formatHours,
  type SlaConfidence,
  type SlaStageChange,
  type SlaTimeEntry,
} from "@/lib/sla-metrics";

interface SlaByTypeProps {
  requests: MarketingRequest[];
  periodLabel: string;
}

const CONFIDENCE_LABEL: Record<SlaConfidence, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const CONFIDENCE_CLASS: Record<SlaConfidence, string> = {
  alta: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  media: "bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  baixa: "bg-muted text-muted-foreground",
};

function round(value: number | null, digits = 2) {
  if (value == null) return "";
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
}

function StatCell({ median, p80, format }: { median: number | null; p80: number | null; format: (v: number | null) => string }) {
  if (median == null) return <span className="text-muted-foreground/60">—</span>;
  return (
    <div className="leading-tight">
      <div className="font-medium tabular-nums text-foreground">{format(median)}</div>
      <div className="text-xs tabular-nums text-muted-foreground">até {format(p80)}</div>
    </div>
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

  const report = useMemo(
    () => (sources ? computeSlaReport(requests, sources.timeEntries, sources.stageChanges) : null),
    [requests, sources]
  );

  const handleExport = () => {
    if (!report) return;

    const slaRows = report.rows.map((r) => ({
      "Tipo de solicitação": r.type,
      "Concluídas": r.concluidas,
      "Confiabilidade": CONFIDENCE_LABEL[r.confianca],
      "SLA sugerido – esforço (h)": r.sugestao.esforcoHoras ?? "",
      "SLA sugerido – 1ª versão (dias úteis)": r.sugestao.primeiraVersaoDias ?? "",
      "SLA sugerido – conclusão (dias úteis)": r.sugestao.conclusaoDias ?? "",
      "Esforço – amostra": r.esforcoHoras.amostra,
      "Esforço – mediana (h)": round(r.esforcoHoras.mediana),
      "Esforço – P80 (h)": round(r.esforcoHoras.p80),
      "Esforço – média (h)": round(r.esforcoHoras.media),
      "1ª versão – amostra": r.primeiraVersaoDias.amostra,
      "1ª versão – mediana (dias úteis)": round(r.primeiraVersaoDias.mediana, 1),
      "1ª versão – P80 (dias úteis)": round(r.primeiraVersaoDias.p80, 1),
      "Conclusão – amostra": r.conclusaoDias.amostra,
      "Conclusão – mediana (dias úteis)": round(r.conclusaoDias.mediana, 1),
      "Conclusão – P80 (dias úteis)": round(r.conclusaoDias.p80, 1),
      "Rodadas de ajuste (média)": round(r.ajustesMedia),
      "% com ajuste": r.pctComAjuste == null ? "" : round(r.pctComAjuste * 100, 1),
      "Com prazo definido": r.comPrazo,
      "Entregues no prazo": r.noPrazo,
      "% no prazo": r.comPrazo ? round((r.noPrazo / r.comPrazo) * 100, 1) : "",
    }));

    const detailRows = report.details.map((d) => ({
      ID: d.id,
      Título: d.title,
      Tipo: d.type,
      "Solicitado em": formatDate(d.requestedAt),
      "1ª versão em": formatDate(d.firstVersionAt),
      "Concluído em": formatDate(d.doneAt),
      "Até 1ª versão (dias úteis)": d.firstVersionBusinessDays ?? "",
      "Até conclusão (dias úteis)": d.doneBusinessDays ?? "",
      "Esforço (h)": round(d.effortHours),
      "Rodadas de ajuste": d.adjustmentRounds,
      Prazo: d.deadline ? d.deadline.split("-").reverse().join("/") : "",
      "No prazo": d.onTime == null ? "" : d.onTime ? "Sim" : "Não",
    }));

    const guideRows = [
      { Campo: "Período", Explicação: periodLabel },
      { Campo: "Base", Explicação: "Só solicitações concluídas que passaram pelo fluxo do sistema (horas apontadas ou mudança de etapa). O histórico importado da planilha antiga fica de fora: a data de entrega lá era, na maioria, o pedido + 7 dias." },
      { Campo: "Esforço", Explicação: "Soma das horas apontadas no timesheet da solicitação." },
      { Campo: "1ª versão", Explicação: "Dias úteis do pedido até a peça sair de produção pela primeira vez (revisão, aprovada ou envio)." },
      { Campo: "Conclusão", Explicação: "Dias úteis do pedido até 'Concluído'. Em posts inclui a espera pela data de publicação." },
      { Campo: "Mediana", Explicação: "Metade das peças levou até esse tempo." },
      { Campo: "P80", Explicação: "80% das peças levaram até esse tempo. É a base do SLA sugerido." },
      { Campo: "SLA sugerido", Explicação: "P80 arredondado para cima (esforço em blocos de 15 min, prazos em dias úteis inteiros)." },
      { Campo: "Dias úteis", Explicação: "Segunda a sexta, horário de São Paulo. Feriados não são descontados. 0 = entregue no mesmo dia." },
      { Campo: "Confiabilidade", Explicação: "Pela menor amostra entre esforço e 1ª versão. Alta: 15+ peças. Média: 5–14. Baixa: menos de 5 — usar com cautela." },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(slaRows), "SLA por tipo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Base por solicitacao");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guideRows), "Como ler");
    const stamp = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    XLSX.writeFile(wb, `sla-por-tipo-${stamp}.xlsx`);
  };

  const measured = report?.details.length ?? 0;

  return (
    <div className="rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(3,32,47,0.04),0_10px_30px_-26px_rgba(62,132,168,0.55)] dark:border-border/50 dark:bg-card/80">
      <div className="flex flex-col gap-3 p-5 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#47cdd0]/12 text-[#347796] dark:bg-white/10 dark:text-white/50">
              <Timer className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-base font-semibold text-foreground">Tempo por tipo de solicitação</h3>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Base para SLA · {measured} concluídas medidas · {periodLabel}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 self-start whitespace-nowrap"
          onClick={handleExport}
          disabled={!report || report.rows.length === 0}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Exportar SLA
        </Button>
      </div>

      <div className="px-5 pb-5">
        {loadError ? (
          <p className="py-8 text-center text-sm text-destructive">Não foi possível carregar o timesheet e o histórico de etapas.</p>
        ) : !report ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Calculando tempos…</p>
        ) : report.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma solicitação concluída no período.</p>
        ) : (
          <>
            <div className="-mx-5 overflow-x-auto px-5">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Concluídas</TableHead>
                    <TableHead>Esforço</TableHead>
                    <TableHead>1ª versão</TableHead>
                    <TableHead>Conclusão</TableHead>
                    <TableHead>Ajustes</TableHead>
                    <TableHead>No prazo</TableHead>
                    <TableHead className="bg-[#47cdd0]/8 dark:bg-white/5">SLA sugerido</TableHead>
                    <TableHead>Confiab.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow key={row.type}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <TypeIcon type={row.type} className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-medium text-foreground">{row.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.concluidas}</TableCell>
                      <TableCell>
                        <StatCell median={row.esforcoHoras.mediana} p80={row.esforcoHoras.p80} format={formatHours} />
                      </TableCell>
                      <TableCell>
                        <StatCell median={row.primeiraVersaoDias.mediana} p80={row.primeiraVersaoDias.p80} format={formatBusinessDays} />
                      </TableCell>
                      <TableCell>
                        <StatCell median={row.conclusaoDias.mediana} p80={row.conclusaoDias.p80} format={formatBusinessDays} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.pctComAjuste == null ? (
                          <span className="text-muted-foreground/60">—</span>
                        ) : (
                          <span>{Math.round(row.pctComAjuste * 100)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.comPrazo === 0 ? (
                          <span className="text-muted-foreground/60">—</span>
                        ) : (
                          <div className="leading-tight">
                            <div>{Math.round((row.noPrazo / row.comPrazo) * 100)}%</div>
                            <div className="text-xs text-muted-foreground">{row.noPrazo} de {row.comPrazo}</div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="bg-[#47cdd0]/8 dark:bg-white/5">
                        <div className="leading-tight">
                          <div className="font-semibold tabular-nums text-foreground">
                            {formatHours(row.sugestao.esforcoHoras)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            1ª versão em {formatBusinessDays(row.sugestao.primeiraVersaoDias)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", CONFIDENCE_CLASS[row.confianca])}>
                          {CONFIDENCE_LABEL[row.confianca]}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Valor de cima = mediana (metade das peças levou até isso); &ldquo;até&rdquo; = P80 (80% das peças). O SLA sugerido é o P80
              arredondado para cima. Esforço vem do timesheet; prazos em dias úteis desde o pedido, sem descontar feriados.
              Ajustes = % das peças que voltaram com ajustes do solicitante. Confiabilidade baixa = menos de 5 peças medidas.
              Entra só o que passou pelo fluxo do sistema; o histórico da planilha antiga fica de fora.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
