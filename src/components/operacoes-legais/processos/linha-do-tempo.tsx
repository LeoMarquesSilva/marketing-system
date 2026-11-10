"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Gavel, Landmark, LoaderCircle, NotebookPen, RefreshCw, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutosDoProcesso } from "@/lib/processos/autos-types";
import { FONTES_ANDAMENTO, porMes, rotuloDoGrau, type Andamento, type FonteAndamento, type LinhaDoTempo as Linha } from "@/lib/processos/andamentos";
import { cn } from "@/lib/utils";
import { formatarDataHora, mensagemDeErro, processosApi } from "./processos-api";

const PASSO = 20;

const VISUAL: Record<FonteAndamento, { icone: LucideIcon; ponto: string; selo: string; rotulo: string }> = {
  datajud: { icone: Gavel, ponto: "bg-[#347796]", selo: "bg-[#e8f3f8] text-[#285f7a] ring-[#b9d3dd]", rotulo: "Tribunal" },
  vios: { icone: ScrollText, ponto: "bg-[#183f50]", selo: "bg-[#eef1f3] text-[#183f50] ring-[#c9d3d9]", rotulo: "VIOS" },
  prazo: { icone: CalendarClock, ponto: "bg-amber-500", selo: "bg-amber-50 text-amber-900 ring-amber-200", rotulo: "Prazo" },
  providencia: { icone: Landmark, ponto: "bg-emerald-600", selo: "bg-emerald-50 text-emerald-900 ring-emerald-200", rotulo: "Providência" },
  manual: { icone: NotebookPen, ponto: "bg-slate-500", selo: "bg-slate-50 text-slate-800 ring-slate-200", rotulo: "Anotação" },
};

export interface CapaConsultada {
  capa: { achou: boolean; sugestoes: number; andamentos?: number; aviso: string | null };
  autos: AutosDoProcesso;
}

function dataDoAndamento(andamento: Andamento): { dia: string; hora: string | null } {
  const data = new Date(andamento.quando);
  const dia = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  // Andamento do VIOS só tem a data; DataJud sem hora chega à meia-noite.
  return { dia, hora: andamento.fonte === "vios" || hora === "00:00" ? null : hora };
}

/**
 * Linha do tempo do processo, na capa: os movimentos do tribunal (DataJud) e o último andamento do VIOS, do mais novo
 * para o mais antigo, agrupados por mês. Prazos e providências da equipe entram aqui quando esses módulos chegarem.
 * "Atualizar pelo DataJud" consulta o tribunal (até um minuto) e também refaz as sugestões de capa.
 */
export function LinhaDoTempo({ processoId, onConsultado }: { processoId: string; onConsultado?: (resultado: CapaConsultada) => void }) {
  const [linha, setLinha] = useState<Linha | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState<FonteAndamento | "">("");
  const [visiveis, setVisiveis] = useState(PASSO);
  const [consultando, setConsultando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const resposta = await processosApi.get<{ linha: Linha }>(`/${processoId}/andamentos`);
      setLinha(resposta.linha);
      setErro("");
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    }
  }, [processoId]);

  useEffect(() => {
    let vivo = true;
    processosApi.get<{ linha: Linha }>(`/${processoId}/andamentos`).then(
      (resposta) => vivo && setLinha(resposta.linha),
      (falha: unknown) => vivo && setErro(mensagemDeErro(falha)),
    );
    return () => {
      vivo = false;
    };
  }, [processoId]);

  async function consultar() {
    setConsultando(true);
    setErro("");
    setAviso("");
    try {
      const resposta = await processosApi.post<CapaConsultada>(`/${processoId}/capa`);
      const novos = resposta.capa.andamentos ?? 0;
      setAviso(
        resposta.capa.achou
          ? `${novos ? `${novos} andamento${novos === 1 ? " novo" : "s novos"} do tribunal.` : "Nenhum andamento novo no DataJud."}${resposta.capa.sugestoes ? ` ${resposta.capa.sugestoes} sugest${resposta.capa.sugestoes === 1 ? "ão" : "ões"} de capa para conferir.` : ""}`
          : (resposta.capa.aviso ?? "O DataJud não trouxe este processo."),
      );
      onConsultado?.(resposta);
      await carregar();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setConsultando(false);
    }
  }

  const andamentos = useMemo(() => linha?.andamentos ?? [], [linha]);
  const contagem = useMemo(() => {
    const mapa = new Map<FonteAndamento, number>();
    for (const andamento of andamentos) mapa.set(andamento.fonte, (mapa.get(andamento.fonte) ?? 0) + 1);
    return mapa;
  }, [andamentos]);
  const filtrados = filtro ? andamentos.filter((andamento) => andamento.fonte === filtro) : andamentos;
  const meses = porMes(filtrados.slice(0, visiveis));
  // Prazos e providências aparecem no filtro (com zero) para a equipe saber que vão entrar aqui.
  const fontes = FONTES_ANDAMENTO.filter((fonte) => fonte.valor !== "manual" || contagem.has("manual"));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar a linha do tempo">
          <Filtro ativo={!filtro} onClick={() => setFiltro("")} rotulo="Tudo" contagem={andamentos.length} />
          {fontes.map((fonte) => (
            <Filtro
              key={fonte.valor}
              ativo={filtro === fonte.valor}
              onClick={() => setFiltro(filtro === fonte.valor ? "" : fonte.valor)}
              rotulo={fonte.rotulo}
              contagem={contagem.get(fonte.valor) ?? 0}
              titulo={fonte.descricao}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{linha?.consultadoEm ? `DataJud consultado em ${formatarDataHora(linha.consultadoEm)}` : "DataJud ainda não consultado"}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-[#b9d3dd] bg-white font-semibold text-[#285f7a] hover:border-[#47cdd0] hover:bg-[#e8f8f8] [&_svg]:text-[#347796]"
            onClick={() => void consultar()}
            disabled={consultando}
            title="Consulta o tribunal pelo DataJud (pode levar até um minuto) e traz os andamentos novos"
          >
            {consultando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            {consultando ? "Consultando o tribunal…" : "Atualizar pelo DataJud"}
          </Button>
        </div>
      </div>

      {aviso ? <p className="rounded-md border border-[#47cdd0]/30 bg-white px-3 py-2 text-xs text-[#285f7a]">{aviso}</p> : null}
      {erro ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{erro}</p> : null}

      {!linha && !erro ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden /> Carregando a linha do tempo…
        </p>
      ) : !filtrados.length ? (
        <div className="rounded-md border border-dashed border-[#b9d3dd] bg-white/60 px-4 py-6 text-center text-sm text-muted-foreground">
          {filtro === "prazo" || filtro === "providencia"
            ? "Os prazos e as providências entram nesta linha do tempo quando esses módulos chegarem ao ORQESTRAI."
            : linha?.erroDataJud
              ? `Nada na linha do tempo ainda. Última consulta ao DataJud: ${linha.erroDataJud}`
              : "Nada na linha do tempo ainda. Use “Atualizar pelo DataJud” para trazer os andamentos do tribunal."}
        </div>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto rounded-md border border-[#c9dde6] bg-white px-4 py-3">
          {meses.map((grupo) => (
            <section key={grupo.mes} className="mb-3 last:mb-0">
              <h4 className="sticky top-0 z-10 -mx-1 mb-2 bg-white/95 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#285f7a] backdrop-blur">{grupo.mes}</h4>
              <ol className="relative ml-2 border-l border-[#d7e6ec]">
                {grupo.itens.map((andamento) => {
                  const visual = VISUAL[andamento.fonte];
                  const { dia, hora } = dataDoAndamento(andamento);
                  const grau = rotuloDoGrau(andamento.grau);
                  return (
                    <li key={andamento.id} className="relative pb-3 pl-5 last:pb-0">
                      <span className={cn("absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-2 ring-white", visual.ponto)} aria-hidden />
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <time dateTime={andamento.quando} className="text-xs font-semibold tabular-nums text-foreground">
                          {dia}
                          {hora ? <span className="font-normal text-muted-foreground"> · {hora}</span> : null}
                        </time>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ring-inset", visual.selo)}>
                          <visual.icone className="size-3" aria-hidden />
                          {visual.rotulo}
                          {grau ? ` · ${grau}` : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words text-sm font-medium text-foreground">{andamento.titulo}</p>
                      {andamento.detalhe ? <p className="break-words text-xs text-muted-foreground">{andamento.detalhe}</p> : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {filtrados.length > visiveis ? (
            <div className="pt-1 text-center">
              <Button type="button" size="sm" variant="ghost" className="text-[#347796]" onClick={() => setVisiveis((atual) => atual + PASSO)}>
                Mostrar mais antigos ({filtrados.length - visiveis})
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Filtro({ ativo, onClick, rotulo, contagem, titulo }: { ativo: boolean; onClick: () => void; rotulo: string; contagem: number; titulo?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      title={titulo}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
        ativo ? "border-[#183f50] bg-[#183f50] text-white" : "border-[#c9dde6] bg-white text-[#285f7a] hover:border-[#47cdd0] hover:bg-[#e8f8f8]",
        !ativo && !contagem && "text-muted-foreground",
      )}
    >
      {rotulo}
      <span className={cn("tabular-nums", ativo ? "text-white/80" : "text-muted-foreground")}>{contagem}</span>
    </button>
  );
}
