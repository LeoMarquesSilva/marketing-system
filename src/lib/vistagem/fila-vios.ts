import { montarObservacaoVios, paraDataVios } from "./agendamento";

/**
 * Onde o robô do SAMA agenda: na publicação (Intimações › Lançamento, ligada à
 * intimação pelo ID de comunicação do DJEN) ou dentro da pasta (como o SAMA/ECOA).
 */
export type ModoAgendamento = "intimacao" | "pasta";

/** Uma tarefa do lançamento pela intimação (coluna `lancamento` da fila do SAMA). */
export interface TarefaDoLancamento {
  /** Id do agendamento no Orquestra; o robô devolve o CI de cada uma por esta chave. */
  chave: string;
  tarefa_id: string | null;
  tarefa: string;
  etiqueta_id: string;
  /** DD/MM/AAAA */
  data: string;
  responsavel: string;
  revisor: string | null;
  observacao: string;
}

export interface LancamentoFila {
  comunicacao_id: string | null;
  /** DD/MM/AAAA; usada pelo robô quando não há ID de comunicação. */
  data_publicacao: string | null;
  tarefas: TarefaDoLancamento[];
}

/** Linha da fila vios_agendamentos do SAMA. */
export interface LinhaFilaSama {
  tipo: string;
  tarefa: string;
  tarefa_id: string | null;
  etiqueta_id: string;
  observacao: string;
  passo_texto: string;
  data: string;
  pasta: string;
  pasta_tipo: "Processo";
  ci_pasta: string | null;
  responsavel: string;
  revisor: string | null;
  simular: boolean;
  lancamento?: LancamentoFila;
}

export interface PublicacaoParaFila {
  data_publicacao: string | null;
  tribunal: string | null;
  numero_processo: string | null;
  djen_id_comunicacao: number | null;
  teor: string | null;
  pasta_ci: string | null;
}

export interface AgendamentoParaFila {
  id: string;
  etiqueta: "PRAZO" | "PROVIDENCIA";
  tarefa: string;
  tarefa_id: string | null;
  /** AAAA-MM-DD */
  data: string;
  responsavel: string;
  revisor: string | null;
  observacao: string | null;
}

const etiquetaVios = (item: AgendamentoParaFila) => (item.etiqueta === "PRAZO" ? "1" : "204");

/**
 * Linhas da fila do robô para as tarefas de uma publicação, com os agendamentos de cada uma.
 * - pasta: uma linha por tarefa, com o teor da publicação na descrição.
 * - intimação: uma linha com todas as tarefas (depois de lançada, a intimação sai da lista do
 *   VIOS); a descrição leva só o cabeçalho e a observação, porque o VIOS insere o texto da intimação.
 */
export function linhasParaFila(
  publicacao: PublicacaoParaFila,
  itens: AgendamentoParaFila[],
  opcoes: { simular: boolean; modo: ModoAgendamento }
): { linha: LinhaFilaSama; agendamentos: string[] }[] {
  const referencia = {
    dataPublicacao: publicacao.data_publicacao,
    tribunal: publicacao.tribunal,
    numeroProcesso: publicacao.numero_processo,
    djenIdComunicacao: publicacao.djen_id_comunicacao,
  };
  const base = (item: AgendamentoParaFila, observacao: string): LinhaFilaSama => ({
    tipo: item.etiqueta === "PRAZO" ? "Prazo" : "Providências",
    tarefa: item.tarefa,
    tarefa_id: item.tarefa_id,
    etiqueta_id: etiquetaVios(item),
    observacao,
    passo_texto: observacao,
    data: paraDataVios(item.data),
    pasta: publicacao.numero_processo as string,
    pasta_tipo: "Processo",
    ci_pasta: publicacao.pasta_ci,
    responsavel: item.responsavel,
    revisor: item.revisor,
    simular: opcoes.simular,
  });

  if (opcoes.modo === "pasta") {
    return itens.map((item) => ({
      linha: base(item, montarObservacaoVios({ ...referencia, teor: publicacao.teor }, item.observacao)),
      agendamentos: [item.id],
    }));
  }

  if (!itens.length) return [];
  const cabecalho = montarObservacaoVios(referencia, null);
  return [
    {
      linha: {
        ...base(itens[0], cabecalho),
        lancamento: {
          comunicacao_id: publicacao.djen_id_comunicacao ? String(publicacao.djen_id_comunicacao) : null,
          data_publicacao: publicacao.data_publicacao ? paraDataVios(publicacao.data_publicacao) : null,
          tarefas: itens.map((item) => ({
            chave: item.id,
            tarefa_id: item.tarefa_id,
            tarefa: item.tarefa,
            etiqueta_id: etiquetaVios(item),
            data: paraDataVios(item.data),
            responsavel: item.responsavel,
            revisor: item.revisor,
            observacao: montarObservacaoVios(referencia, item.observacao),
          })),
        },
      },
      agendamentos: itens.map((item) => item.id),
    },
  ];
}

/** CI de cada tarefa lançada (resultado.tarefas[] do robô), por chave do agendamento. */
export function cisDoResultado(resultado: unknown): Map<string, string> {
  const mapa = new Map<string, string>();
  const tarefas = (resultado as { tarefas?: { chave?: unknown; ci_vios?: unknown }[] } | null)?.tarefas;
  if (!Array.isArray(tarefas)) return mapa;
  for (const tarefa of tarefas) {
    if (typeof tarefa?.chave === "string" && tarefa.ci_vios != null && String(tarefa.ci_vios) !== "") {
      mapa.set(tarefa.chave, String(tarefa.ci_vios));
    }
  }
  return mapa;
}
