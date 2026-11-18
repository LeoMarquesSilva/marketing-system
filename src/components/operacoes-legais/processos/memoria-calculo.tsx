"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CRITERIO_DA_MEMORIA, formatarData, formatarReal, type MemoriaDoCalculo } from "@/lib/processos/rec-credito";
import { cn } from "@/lib/utils";
import { Aviso } from "../vistagem/ui";

const percentual = (valor: number) => `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
const fator = (valor: number) => valor.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });

/**
 * O valor da ação atualizado (cálculo do TJSP, com guias e levantamentos) como botão: ao clicar, abre a memória
 * do cálculo, linha a linha. `rotulo` é o texto antes do valor ("Atualizado:"); `vios`, o número do VIOS.
 */
export function ValorAtualizado({ memoria, vios, rotulo, className }: { memoria: MemoriaDoCalculo; vios?: string | null; rotulo?: string; className?: string }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        title="Ver a memória do cálculo"
        className={cn("inline-flex max-w-full items-center gap-1 truncate text-left underline decoration-dotted underline-offset-4 hover:text-[#285f7a]", className)}
      >
        <Calculator className="size-3 shrink-0" aria-hidden />
        <span className="truncate tabular-nums">
          {rotulo ? `${rotulo} ` : ""}
          {formatarReal(memoria.total)}
        </span>
      </button>
      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-[#e6eef0] px-5 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4 text-[#3e84a8]" aria-hidden /> Memória do cálculo
            </DialogTitle>
            <DialogDescription>
              Valor da ação atualizado pelo cálculo do TJSP até {formatarData(memoria.ate)}, abatidos os valores levantados, com multa, honorários e guias pagas.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="overflow-x-auto rounded-md border border-[#e6eef0]">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-[#f7fbfc] text-xs text-muted-foreground">
                  <tr>
                    {["Item", "Desde", "Valor", "Fator de correção", "Corrigido", "Juros", "Total"].map((titulo, indice) => (
                      <th key={titulo} scope="col" className={cn("px-3 py-2 font-medium", indice >= 2 ? "text-right" : "text-left")}>
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6eef0]">
                  {memoria.linhas.map((linha, indice) => (
                    <tr key={indice} className={linha.sinal < 0 ? "text-emerald-800" : undefined}>
                      <td className="px-3 py-2">
                        {linha.sinal < 0 ? "(−) " : linha.tipo === "acao" ? "" : "(+) "}
                        {linha.descricao}
                        {linha.percentual !== undefined ? <span className="block text-[11px] text-muted-foreground">sobre a dívida atualizada de {formatarReal(linha.valor)}</span> : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{linha.percentual !== undefined ? "—" : formatarData(linha.data)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatarReal(linha.valor)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{linha.percentual !== undefined ? "—" : fator(linha.fatorCorrecao)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{linha.percentual !== undefined ? "—" : formatarReal(linha.corrigido)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {linha.jurosPercentual ? (
                          <>
                            {formatarReal(linha.juros)}
                            <span className="block text-[11px] text-muted-foreground">{percentual(linha.jurosPercentual)}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {linha.sinal < 0 ? "− " : ""}
                        {formatarReal(linha.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[#c9dde6] bg-[#f7fbfc]">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right font-semibold">
                      Valor atualizado em {formatarData(memoria.ate)}
                    </td>
                    <td className="px-3 py-2 text-right text-base font-semibold tabular-nums text-[#10293a]">{formatarReal(memoria.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {memoria.avisos.length ? <Aviso tom="alerta">{memoria.avisos.join("\n")}</Aviso> : null}
            <p className="text-xs text-muted-foreground">
              Honorários de {memoria.encargos.honorarios.toLocaleString("pt-BR")}% e multa de {memoria.encargos.multa.toLocaleString("pt-BR")}%: {memoria.encargos.origem}. Se o devedor pagou no prazo ou o juiz fixou outro percentual, a conta ainda não tem onde ajustar.
            </p>
            {vios ? <p className="text-xs text-muted-foreground">No VIOS, o valor da ação atualizado está em {vios}.</p> : null}
            <div>
              <p className="text-xs font-semibold uppercase text-[#285f7a]">Critério</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {CRITERIO_DA_MEMORIA.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
