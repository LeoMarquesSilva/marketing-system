import "server-only";

import { fonteJusbr, iaConfigurada, roboDosAutos } from "./autos-server";
import { montarPainelDoRobo, type DocumentoDoPainel, type PainelDoRobo, type PedidoDoPainel, type ProcessoDoPainel } from "./painel-robo";
import { db, falhou } from "./server";

const PAGINA = 1000;

/** Todas as linhas de uma tabela (o PostgREST corta em 1000 por consulta). */
async function todas<T>(tabela: string, colunas: string, ordem: string, filtro?: { coluna: string; valor: string }): Promise<T[]> {
  const linhas: T[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    let consulta = db().from(tabela).select(colunas);
    if (filtro) consulta = consulta.eq(filtro.coluna, filtro.valor);
    const { data, error } = await consulta.order(ordem).range(inicio, inicio + PAGINA - 1);
    if (error) falhou("montar o painel do robô", error);
    linhas.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < PAGINA) break;
  }
  return linhas;
}

async function contarSugestoes(situacao: string): Promise<number> {
  const { count, error } = await db().from("proc_sugestoes").select("id", { count: "exact", head: true }).eq("situacao", situacao);
  if (error) falhou("contar as sugestões", error);
  return count ?? 0;
}

export interface RespostaDoPainel extends PainelDoRobo {
  /** Os pedidos vão primeiro ao Jus.br (um robô para todos os tribunais) ou ao robô de cada tribunal. */
  fonte: "jusbr" | "tribunal";
  iaConfigurada: boolean;
}

/** Gestão do robô de autos: fila, projeção, downloads, leitura pela IA e o estado dos autos de cada processo. */
export async function painelDoRobo(agoraMs = Date.now()): Promise<RespostaDoPainel> {
  const [processos, pedidos, documentos, pendentes, aprovadas, recusadas, comPendentes] = await Promise.all([
    todas<{ id: string; ci: string | null; cnj: string | null; situacao: string | null; data_encerramento: string | null; sistema_tribunal: string | null; grupo_cliente: string | null }>(
      "proc_processos",
      "id, ci, cnj, situacao, data_encerramento, sistema_tribunal, grupo_cliente",
      "ci"
    ),
    todas<PedidoDoPainel>(
      "proc_autos_pedidos",
      "id, processo_id, cnj, sistema, tribunal, status, motivo_espera, erro, tentativas, robo, criado_em, atualizado_em, iniciado_em, concluido_em",
      "criado_em"
    ),
    todas<DocumentoDoPainel>("proc_documentos", "processo_id, origem, leitura_status, paginas, paginas_lidas, paginas_sem_texto, leitura_custo_us, criado_em", "criado_em"),
    contarSugestoes("pendente"),
    contarSugestoes("aprovada"),
    contarSugestoes("recusada"),
    todas<{ processo_id: string }>("proc_sugestoes", "processo_id", "id", { coluna: "situacao", valor: "pendente" }),
  ]);

  const doPainel: ProcessoDoPainel[] = processos.map((processo) => {
    const robo = roboDosAutos(processo.cnj, processo.sistema_tribunal);
    return {
      id: processo.id,
      ci: processo.ci,
      cnj: robo.cnj ?? processo.cnj,
      situacao: processo.situacao,
      dataEncerramento: processo.data_encerramento,
      tribunal: robo.tribunal,
      sistema: robo.sistema,
      temRobo: robo.disponivel,
      grupoCliente: processo.grupo_cliente,
    };
  });

  return {
    ...montarPainelDoRobo({
      processos: doPainel,
      pedidos,
      documentos,
      sugestoes: { pendentes, aprovadas, recusadas, pendentesPorProcesso: comPendentes.map((linha) => linha.processo_id) },
      agoraMs,
    }),
    fonte: fonteJusbr() ? "jusbr" : "tribunal",
    iaConfigurada: iaConfigurada(),
  };
}
