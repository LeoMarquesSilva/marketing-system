import { chaveNome, escritorioDaArea } from "./agendamento";
import type { FluxoDaTarefa, TarefaDoFluxo } from "./fluxo-vios";

/**
 * "1. CIÊNCIA DOS AGENDAMENTOS" em todo agendamento: quando nenhuma tarefa agendada para a publicação é a Ciência
 * e o fluxo automático do VIOS de nenhuma delas a cria, o Orquestra acrescenta uma (o robô lança junto).
 * Vai para quem faz o Enviar da primeira tarefa; na Reestruturação, estagiário (cargo no RH do Orquestra) dá
 * lugar ao revisor. CIÊNCIA NF e SESSÃO DE JULGAMENTO ficam de fora: vistagem só com elas não leva a Ciência dos
 * Agendamentos (nem contam como primeira tarefa para escolher o responsável).
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

/** CIÊNCIA NF não pede Ciência dos Agendamentos (nem conta como primeira tarefa para escolher o responsável). */
export function ehCienciaNf(nome: string | null | undefined): boolean {
  return chaveNome(nome) === "CIENCIA NF";
}

/** Tarefas que não pedem a Ciência dos Agendamentos: CIÊNCIA NF e SESSÃO DE JULGAMENTO (pedido de 06/11/2026). */
export function naoPedeCiencia(nome: string | null | undefined): boolean {
  return ehCienciaNf(nome) || chaveNome(nome) === "SESSAO DE JULGAMENTO";
}

/** O fluxo automático do VIOS (em qualquer nível do que cria junto) já cria a Ciência dos Agendamentos? */
export function fluxoCriaCiencia(fluxo: FluxoDaTarefa | null | undefined): boolean {
  const cria = (tarefas: TarefaDoFluxo[]): boolean => tarefas.some((tarefa) => ehCienciaDosAgendamentos(tarefa.nome) || cria(tarefa.filhas));
  return Boolean(fluxo && cria(fluxo.criacao));
}

/**
 * Uma Ciência dos Agendamentos só por vistagem: quando o fluxo do VIOS cria mais de uma (a Apelação cria a dela e
 * um Embargos de Declaração que cria outra; ou duas tarefas pedidas, cada uma com a sua), fica a da primeira tarefa
 * incluída e o robô cancela as outras no VIOS (tipo Duplicidade). Dentro do fluxo de uma tarefa, fica a mais perto
 * dela (menor nível; no empate, a primeira do fluxo). Devolve qual fica: a própria tarefa (caminho null, quando ela
 * é a Ciência) ou o caminho no fluxo dela; null quando nenhuma cria Ciência.
 * O robô segue a mesma regra no lançamento (sama-rpa).
 */
export function cienciaQueFica<T>(
  tarefas: { chave: T; nome: string; fluxo: FluxoDaTarefa | null | undefined }[]
): { chave: T; caminho: string[] | null } | null {
  for (const tarefa of tarefas) {
    if (ehCienciaDosAgendamentos(tarefa.nome)) return { chave: tarefa.chave, caminho: null };
    let nivel: { tarefa: TarefaDoFluxo; caminho: string[] }[] = (tarefa.fluxo?.criacao ?? []).map((filha) => ({ tarefa: filha, caminho: [filha.nome] }));
    for (let profundidade = 0; nivel.length && profundidade < 10; profundidade++) {
      const achada = nivel.find((item) => ehCienciaDosAgendamentos(item.tarefa.nome));
      if (achada) return { chave: tarefa.chave, caminho: achada.caminho };
      nivel = nivel.flatMap((item) => item.tarefa.filhas.map((filha) => ({ tarefa: filha, caminho: [...item.caminho, filha.nome] })));
    }
  }
  return null;
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
  // Vistagem só com CIÊNCIA NF ou SESSÃO DE JULGAMENTO não leva Ciência dos Agendamentos; com outras tarefas,
  // vale a primeira delas.
  const pedem = escolhidas.filter((tarefa) => !naoPedeCiencia(tarefa.tarefa));
  if (!pedem.length) return null;

  const [primeira] = pedem;
  let responsaveis = primeira.responsaveis.filter((pessoa) => pessoa.nome.trim());
  const revisorNoLugarDe: string[] = [];
  if (ehReestruturacao(opcoes.area)) {
    const revisor = primeira.revisor ?? pedem.find((tarefa) => tarefa.revisor)?.revisor ?? null;
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
