"use client";

import { LoaderCircle, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROTULO_ETIQUETA, type EtiquetaAgendamento } from "@/lib/vistagem/agendamento";
import { ROTULO_CONTAGEM } from "@/lib/vistagem/dias-uteis";
import { TAREFA_ESOCIAL, pedeTarefaEsocial } from "@/lib/vistagem/esocial";
import { fatalSugerida, type ConfiancaSugestao, type SugestaoIa, type TarefaSugerida } from "@/lib/vistagem/sugestao-ia";
import { formatarData } from "./publicacao-ui";

export type EstadoSugestao = "carregando" | "pronta" | "usada" | "ignorada" | "erro";

const COR_CLASSE: Record<EtiquetaAgendamento, string> = {
  PRAZO: "bg-red-50 text-red-800",
  PROVIDENCIA: "bg-emerald-50 text-emerald-800",
  COMPROMISSO: "bg-amber-50 text-amber-900",
};

const COR_CONFIANCA: Record<ConfiancaSugestao, string> = {
  alta: "bg-emerald-50 text-emerald-800",
  media: "bg-amber-50 text-amber-900",
  baixa: "bg-red-50 text-red-800",
};

const ROTULO_CONFIANCA: Record<ConfiancaSugestao, string> = { alta: "alta", media: "média", baixa: "baixa" };

/** Marca das tarefas que vieram da sugestão. */
export function SeloIa() {
  return (
    <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-violet-800">
      <Sparkles className="size-3" aria-hidden />
      IA
    </span>
  );
}

function detalheDaTarefa(tarefa: TarefaSugerida, dataPublicacao: string | null, contaPrazo: (iso: string) => boolean): string | null {
  if (tarefa.classe === "COMPROMISSO") return tarefa.data ? `${formatarData(tarefa.data)}${tarefa.hora ? ` às ${tarefa.hora}` : ""}` : null;
  if (tarefa.classe !== "PRAZO") return null;
  const fatal = fatalSugerida(tarefa, dataPublicacao, contaPrazo);
  const prazo = tarefa.dias ? `${tarefa.dias} ${ROTULO_CONTAGEM[tarefa.contagem ?? "uteis"]}` : "data fixada";
  return fatal ? `${prazo} · fatal ${formatarData(fatal)}` : prazo;
}

/** Cartão no topo da vistagem: o jurídico usa a sugestão (preenche as tarefas e o eSocial) ou ignora. */
export function CartaoSugestaoIa({
  estado,
  sugestao,
  erro,
  nomeDaTarefa,
  dataPublicacao,
  contaPrazo,
  comEsocial,
  onUsar,
  onIgnorar,
  onDesfazer,
  onMostrar,
}: {
  estado: EstadoSugestao;
  sugestao: SugestaoIa | null;
  erro: string;
  /** Nome da tarefa como está na lista da tela. */
  nomeDaTarefa: (tarefa: TarefaSugerida) => string;
  dataPublicacao: string | null;
  contaPrazo: (iso: string) => boolean;
  /** A pasta pede a classificação eSocial. */
  comEsocial: boolean;
  onUsar: () => void;
  onIgnorar: () => void;
  onDesfazer: () => void;
  onMostrar: () => void;
}) {
  if (estado === "carregando") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-4 py-3 text-sm text-violet-900 shadow-sm">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Gerando a sugestão da IA…
      </div>
    );
  }
  if (estado === "erro" || !sugestao) {
    return (
      <p className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <TriangleAlert className="size-3.5" aria-hidden />
        Sugestão da IA indisponível{erro ? `: ${erro}` : "."} Faça a vistagem normalmente.
      </p>
    );
  }
  if (estado === "usada") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-900" role="status">
        <Sparkles className="size-4" aria-hidden />
        <span className="flex-1">Sugestão aplicada. Confira responsável, revisor e datas antes de enviar.</span>
        <Button type="button" size="sm" variant="ghost" className="text-violet-900" onClick={onDesfazer}>
          <Undo2 />
          Desfazer
        </Button>
      </div>
    );
  }
  if (estado === "ignorada") {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Sparkles className="size-3.5 text-violet-700" aria-hidden />
        Sugestão da IA ignorada.
        <Button type="button" size="xs" variant="ghost" className="text-violet-800" onClick={onMostrar}>
          Ver sugestão
        </Button>
      </div>
    );
  }

  const comTarefaEsocial = comEsocial && pedeTarefaEsocial(sugestao.esocial);
  return (
    <section aria-labelledby="sugestao-ia-titulo" className="space-y-2 rounded-lg border border-violet-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-violet-700" aria-hidden />
        <h3 id="sugestao-ia-titulo" className="text-sm font-semibold text-slate-900">
          Sugestão da IA
        </h3>
        <span className={cn("rounded-full px-2 py-0.5 text-xs", COR_CONFIANCA[sugestao.confianca])}>confiança {ROTULO_CONFIANCA[sugestao.confianca]}</span>
      </div>
      <p className="text-sm text-slate-800">{sugestao.resumo}</p>
      <ul className="divide-y divide-[#dce9eb] border-t border-[#dce9eb]">
        {sugestao.tarefas.map((tarefa, indice) => {
          const detalhe = detalheDaTarefa(tarefa, dataPublicacao, contaPrazo);
          return (
            <li key={`${tarefa.tarefaId}-${indice}`} className="flex items-start gap-2 py-2">
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", COR_CLASSE[tarefa.classe])}>{ROTULO_ETIQUETA[tarefa.classe]}</span>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">
                  {nomeDaTarefa(tarefa)}
                  {detalhe ? <span className="font-normal text-slate-600"> · {detalhe}</span> : null}
                </p>
                <p className="text-xs text-slate-500">Por quê: {tarefa.motivo}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#dce9eb] pt-2">
        <span className="flex-1 text-xs text-slate-600">
          {comEsocial ? `eSocial: ${sugestao.esocial}${comTarefaEsocial ? ` · + ${TAREFA_ESOCIAL}` : ""}` : null}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={onIgnorar}>
          Ignorar
        </Button>
        <Button type="button" size="sm" className="bg-violet-700 text-white hover:bg-violet-800" onClick={onUsar} disabled={!sugestao.tarefas.length}>
          <Sparkles />
          Usar sugestão
        </Button>
      </div>
    </section>
  );
}
