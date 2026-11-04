import { chaveNome, escritorioDaArea } from "./agendamento";
import type { FluxoDaTarefa, TarefaDoFluxo } from "./fluxo-vios";

/**
 * "1. CIÊNCIA DOS AGENDAMENTOS" em todo agendamento: quando nenhuma tarefa agendada para a publicação é a Ciência
 * e o fluxo automático do VIOS de nenhuma delas a cria, o Orquestra acrescenta uma (o robô lança junto).
 * Vai para quem faz o Enviar da primeira tarefa; na Reestruturação, estagiário (cargo no RH do Orquestra) dá
 * lugar ao revisor.
 */

export interface PessoaDaTarefa {
  /** Id do usuário no VIOS; null na tela do jurídico, que trabalha com o nome. */
  id: string | null;
  nome: string;
}

export interface TarefaParaCiencia {
  tarefa: string;
  tarefaId: string | null;
  responsaveis: PessoaDaTarefa[];
  revisor: PessoaDaTarefa | null;
}

/** "1. CIÊNCIA DOS AGENDAMENTOS" (Trabalhista, Cível… é o tipo 321; Insolvência, o 619). */
export function ehCienciaDosAgendamentos(nome: string | null | undefined): boolean {
  return chaveNome(nome).replace(/^\d+\s*\.\s*/, "") === "CIENCIA DOS AGENDAMENTOS";
}

/** O fluxo automático do VIOS (em qualquer nível do que cria junto) já cria a Ciência dos Agendamentos? */
export function fluxoCriaCiencia(fluxo: FluxoDaTarefa | null | undefined): boolean {
  const cria = (tarefas: TarefaDoFluxo[]): boolean => tarefas.some((tarefa) => ehCienciaDosAgendamentos(tarefa.nome) || cria(tarefa.filhas));
  return Boolean(fluxo && cria(fluxo.criacao));
}

export function ehReestruturacao(area: string | null | undefined): boolean {
  return escritorioDaArea(area) === "Reestruturação";
}

/**
 * Quem recebe a Ciência que o Orquestra cria, ou null quando não precisa criar (alguma tarefa já é a Ciência,
 * o fluxo do VIOS de alguma a cria, ou ainda não há tarefa com responsável).
 */
export function cienciaDosAgendamentos(
  tarefas: TarefaParaCiencia[],
  opcoes: {
    fluxoDe: (tarefaId: string) => FluxoDaTarefa | null | undefined;
    /** Escritório/área da publicação ("Insolvência" e "Cível | Insolvência" são Reestruturação). */
    area: string | null | undefined;
    ehEstagiario: (pessoa: PessoaDaTarefa) => boolean;
  }
): { responsaveis: PessoaDaTarefa[]; revisorNoLugarDe: string[] } | null {
  const escolhidas = tarefas.filter((tarefa) => tarefa.tarefa.trim());
  if (!escolhidas.length) return null;
  const jaTem = escolhidas.some(
    (tarefa) => ehCienciaDosAgendamentos(tarefa.tarefa) || (tarefa.tarefaId !== null && fluxoCriaCiencia(opcoes.fluxoDe(tarefa.tarefaId)))
  );
  if (jaTem) return null;

  const [primeira] = escolhidas;
  let responsaveis = primeira.responsaveis.filter((pessoa) => pessoa.nome.trim());
  const revisorNoLugarDe: string[] = [];
  if (ehReestruturacao(opcoes.area)) {
    const revisor = primeira.revisor ?? escolhidas.find((tarefa) => tarefa.revisor)?.revisor ?? null;
    if (revisor) {
      responsaveis = responsaveis.map((pessoa) => {
        if (!opcoes.ehEstagiario(pessoa) || chaveNome(pessoa.nome) === chaveNome(revisor.nome)) return pessoa;
        revisorNoLugarDe.push(pessoa.nome);
        return revisor;
      });
    }
  }
  const unicos = responsaveis.filter(
    (pessoa, indice) => responsaveis.findIndex((outra) => chaveNome(outra.nome) === chaveNome(pessoa.nome)) === indice
  );
  return unicos.length ? { responsaveis: unicos, revisorNoLugarDe } : null;
}
