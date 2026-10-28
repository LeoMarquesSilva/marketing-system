"use client";

import { Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROTULO_ETIQUETA } from "@/lib/vistagem/agendamento";
import { ROTULO_CONTAGEM } from "@/lib/vistagem/dias-uteis";
import { TAREFA_ESOCIAL, pedeTarefaEsocial } from "@/lib/vistagem/esocial";
import { fatalSugerida, type ConfiancaSugestao, type SugestaoIa, type TarefaSugerida } from "@/lib/vistagem/sugestao-ia";
import { formatarData } from "./publicacao-ui";
import { Aviso, Carregando, Painel, Selo, TOM_CLASSE, type TomSelo } from "./ui";

export type EstadoSugestao = "carregando" | "pronta" | "usada" | "ignorada" | "erro";

const TOM_CONFIANCA: Record<ConfiancaSugestao, TomSelo> = { alta: "sucesso", media: "alerta", baixa: "perigo" };

const ROTULO_CONFIANCA: Record<ConfiancaSugestao, string> = { alta: "alta", media: "média", baixa: "baixa" };

/** Marca das tarefas que vieram da sugestão. */
export function SeloIa() {
  return (
    <Selo tom="ia" icone={Sparkles}>
      IA
    </Selo>
  );
}

function detalheDaTarefa(tarefa: TarefaSugerida, dataPublicacao: string | null, contaPrazo: (iso: string) => boolean): string | null {
  if (tarefa.classe === "COMPROMISSO") return tarefa.data ? `${formatarData(tarefa.data)}${tarefa.hora ? ` às ${tarefa.hora}` : ""}` : null;
  if (tarefa.classe !== "PRAZO") return null;
  const fatal = fatalSugerida(tarefa, dataPublicacao, contaPrazo);
  const prazo = tarefa.dias ? `${tarefa.dias} ${ROTULO_CONTAGEM[tarefa.contagem ?? "uteis"]}` : "data fixada";
  return fatal ? `${prazo} · fatal ${formatarData(fatal)}` : prazo;
}

function TituloIa({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#48466e]/10 bg-[#f6f6fa] px-4 py-2.5">
      <Sparkles className="size-4 text-[#48466e]" aria-hidden />
      <h2 id="sugestao-ia-titulo" className="text-sm font-semibold text-[#2f2d4d]">
        Sugestão da IA
      </h2>
      {children}
    </div>
  );
}

/** Cartão acima da vistagem: o jurídico usa a sugestão (preenche as tarefas e o eSocial) ou ignora. */
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
      <Painel aria-labelledby="sugestao-ia-titulo" className="border-[#48466e]/20">
        <TituloIa />
        <Carregando rotulo="Lendo a publicação" className="p-6" />
      </Painel>
    );
  }
  if (estado === "erro" || !sugestao) {
    return <Aviso tom="alerta" titulo="Sugestão da IA indisponível">{erro ? `${erro} ` : ""}Faça a vistagem normalmente.</Aviso>;
  }
  if (estado === "usada") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#48466e]/20 bg-[#f6f6fa] px-3 py-2 text-sm text-[#2f2d4d]" role="status">
        <Sparkles className="size-4 shrink-0 text-[#48466e]" aria-hidden />
        <span className="min-w-0 flex-1">Sugestão aplicada. Confira responsável, revisor e datas antes de enviar.</span>
        <Button type="button" size="sm" variant="ghost" onClick={onDesfazer}>
          <Undo2 />
          Desfazer
        </Button>
      </div>
    );
  }
  if (estado === "ignorada") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-[#48466e]" aria-hidden />
        Sugestão da IA ignorada.
        <Button type="button" size="xs" variant="ghost" onClick={onMostrar}>
          Ver sugestão
        </Button>
      </div>
    );
  }

  const comTarefaEsocial = comEsocial && pedeTarefaEsocial(sugestao.esocial);
  return (
    <Painel aria-labelledby="sugestao-ia-titulo" className="border-[#48466e]/20">
      <TituloIa>
        <Selo tom={TOM_CONFIANCA[sugestao.confianca]} className="ml-auto">
          confiança {ROTULO_CONFIANCA[sugestao.confianca]}
        </Selo>
      </TituloIa>
      <p className="px-4 pt-3 text-sm text-foreground">{sugestao.resumo}</p>
      <ul className="mt-2 divide-y divide-[#eef3f5] border-t border-[#eef3f5]">
        {sugestao.tarefas.map((tarefa, indice) => {
          const detalhe = detalheDaTarefa(tarefa, dataPublicacao, contaPrazo);
          return (
            <li key={`${tarefa.tarefaId}-${indice}`} className="flex items-start gap-3 px-4 py-2.5">
              <Selo tom={TOM_CLASSE[tarefa.classe]} className="mt-0.5 shrink-0">
                {ROTULO_ETIQUETA[tarefa.classe]}
              </Selo>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">
                  {nomeDaTarefa(tarefa)}
                  {detalhe ? <span className="font-normal text-muted-foreground"> · {detalhe}</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Por quê: {tarefa.motivo}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#eef3f5] bg-[#fbfcfd] px-4 py-2.5">
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">
          {comEsocial ? (
            <>
              eSocial: <span className="font-medium text-foreground">{sugestao.esocial}</span>
              {comTarefaEsocial ? ` · + ${TAREFA_ESOCIAL}` : ""}
            </>
          ) : null}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={onIgnorar}>
          Ignorar
        </Button>
        <Button type="button" size="sm" onClick={onUsar} disabled={!sugestao.tarefas.length}>
          <Sparkles />
          Usar sugestão
        </Button>
      </div>
    </Painel>
  );
}
