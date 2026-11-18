import { HORA_LIMITE_DO_DIA, chaveDoCaminho, chaveNome, escritorioDaArea } from "./agendamento";
import { somarDiasUteis } from "./dias-uteis";
import type { FluxoDaTarefa, TarefaDoFluxo } from "./fluxo-vios";

/**
 * "1. CIÊNCIA DOS AGENDAMENTOS" em todo agendamento: quando nenhuma tarefa agendada para a publicação é a Ciência
 * e o fluxo automático do VIOS de nenhuma delas a cria, o Orquestra acrescenta uma (o robô lança junto).
 * Vai para quem faz o Enviar da primeira tarefa; na Reestruturação, estagiário (cargo no RH do Orquestra) dá
 * lugar ao revisor. CIÊNCIA NF, VERIFICAR RENÚNCIA e SESSÃO DE JULGAMENTO ficam de fora: vistagem só com elas não
 * leva a Ciência dos Agendamentos (nem contam como primeira tarefa para escolher o responsável).
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

/**
 * Data da Ciência dos Agendamentos que o Orquestra cria, na hora da vistagem: o próprio dia; às 18h ou depois (ou num
 * dia sem expediente), o dia útil seguinte, porque a Conferência só manda ao robô no próximo dia de trabalho
 * (pedido de 13/11/2026). Sem isso, a Conferência via a data da vistagem, já passada, e ajustava à mão pelo lápis.
 */
export function dataDaCienciaNaVistagem(hoje: string, hora: number, ehDiaUtil: (iso: string) => boolean): string {
  return hora >= HORA_LIMITE_DO_DIA || !ehDiaUtil(hoje) ? somarDiasUteis(hoje, 1, ehDiaUtil) : hoje;
}

/**
 * Data com que a tarefa vai ao VIOS no envio ao robô: a Ciência dos Agendamentos é para o dia do lançamento, então,
 * se a data gravada já passou (vistada num dia, conferida noutro), vai com a do envio. As outras tarefas não mudam.
 */
export function dataDaCienciaNoEnvio(tarefa: string, data: string, hoje: string): string {
  return ehCienciaDosAgendamentos(tarefa) && data < hoje ? hoje : data;
}

/** CIÊNCIA NF não pede Ciência dos Agendamentos (nem conta como primeira tarefa para escolher o responsável). */
export function ehCienciaNf(nome: string | null | undefined): boolean {
  return chaveNome(nome) === "CIENCIA NF";
}

/** VERIFICAR RENÚNCIA (Providência): segue a CIÊNCIA NF, sem a Ciência dos Agendamentos e com o check automático (pedido de 10/11/2026). */
export function ehVerificarRenuncia(nome: string | null | undefined): boolean {
  return chaveNome(nome) === "VERIFICAR RENUNCIA";
}

/**
 * Tarefas que não pedem a Ciência dos Agendamentos: CIÊNCIA NF e SESSÃO DE JULGAMENTO (pedido de 06/11/2026) e
 * VERIFICAR RENÚNCIA (pedido de 10/11/2026).
 */
export function naoPedeCiencia(nome: string | null | undefined): boolean {
  return ehCienciaNf(nome) || ehVerificarRenuncia(nome) || chaveNome(nome) === "SESSAO DE JULGAMENTO";
}

/** O fluxo automático do VIOS (em qualquer nível do que cria junto) já cria a Ciência dos Agendamentos? */
export function fluxoCriaCiencia(fluxo: FluxoDaTarefa | null | undefined): boolean {
  const cria = (tarefas: TarefaDoFluxo[]): boolean => tarefas.some((tarefa) => ehCienciaDosAgendamentos(tarefa.nome) || cria(tarefa.filhas));
  return Boolean(fluxo && cria(fluxo.criacao));
}

/** "EMBARGOS DE DECLARAÇÃO" (19, 450 e 462 no VIOS), e não a RESPOSTA AOS EMBARGOS DE DECLARAÇÃO. */
export function ehEmbargosDeDeclaracao(nome: string | null | undefined): boolean {
  return chaveNome(nome).replace(/^\d+\s*\.\s*/, "") === "EMBARGOS DE DECLARACAO";
}

/** Uma tarefa da vistagem com o fluxo do VIOS dela, na ordem em que foi incluída. */
export interface TarefaComFluxo<T> {
  chave: T;
  nome: string;
  fluxo: FluxoDaTarefa | null | undefined;
}

/** Qual fica: a própria tarefa (caminho null) ou o caminho no fluxo dela; null quando nenhuma tem. */
export type QualFica<T> = { chave: T; caminho: string[] | null } | null;

/**
 * A primeira na ordem das tarefas: a própria tarefa ou, no fluxo dela, a mais perto (menor nível; no empate, a
 * primeira do fluxo). `fora` tira um ramo do fluxo (o Embargos repetido, com o que ele cria).
 */
function primeiraNaOrdem<T>(
  tarefas: TarefaComFluxo<T>[],
  procurada: (nome: string) => boolean,
  fora: (chave: T, caminho: string[]) => boolean = () => false
): QualFica<T> {
  for (const tarefa of tarefas) {
    if (procurada(tarefa.nome)) return { chave: tarefa.chave, caminho: null };
    const dentro = (itens: { tarefa: TarefaDoFluxo; caminho: string[] }[]) => itens.filter((item) => !fora(tarefa.chave, item.caminho));
    let nivel = dentro((tarefa.fluxo?.criacao ?? []).map((filha) => ({ tarefa: filha, caminho: [filha.nome] })));
    for (let profundidade = 0; nivel.length && profundidade < 10; profundidade++) {
      const achada = nivel.find((item) => procurada(item.tarefa.nome));
      if (achada) return { chave: tarefa.chave, caminho: achada.caminho };
      nivel = dentro(nivel.flatMap((item) => item.tarefa.filhas.map((filha) => ({ tarefa: filha, caminho: [...item.caminho, filha.nome] }))));
    }
  }
  return null;
}

function mesmaTarefa<T>(fica: QualFica<T>, chave: T, caminho: string[] | null): boolean {
  if (!fica || fica.chave !== chave) return false;
  return caminho === null ? fica.caminho === null : fica.caminho !== null && chaveDoCaminho(fica.caminho) === chaveDoCaminho(caminho);
}

/**
 * Um Embargos de Declaração só por vistagem (pedido de 17/11/2026): o AIRR e o AGRAVO INTERNO (e o Recurso de
 * Revista, o Agravo de Petição…) criam cada um o seu no fluxo do VIOS. Fica o da primeira tarefa incluída (o mais
 * perto dela no fluxo) e o robô cancela os outros no VIOS (tipo Duplicidade), com o 2. REVISAR e o 3. PROTOCOLAR
 * que cada um cria. Quando o jurídico pede o Embargos como tarefa, fica o pedido (com a data que ele escolheu) e os
 * do fluxo são cancelados; o pedido nunca é cancelado. O robô segue a mesma regra no lançamento (sama-rpa).
 */
export function embargosQueFica<T>(tarefas: TarefaComFluxo<T>[]): QualFica<T> {
  const pedido = tarefas.find((tarefa) => ehEmbargosDeDeclaracao(tarefa.nome));
  return pedido ? { chave: pedido.chave, caminho: null } : primeiraNaOrdem(tarefas, ehEmbargosDeDeclaracao);
}

/** O caminho passa por um Embargos de Declaração do fluxo que não é o que fica (o robô cancela o ramo inteiro)? */
function noEmbargosRepetido<T>(embargos: QualFica<T>, chave: T, caminho: string[]): boolean {
  return caminho.some((nome, indice) => ehEmbargosDeDeclaracao(nome) && !mesmaTarefa(embargos, chave, caminho.slice(0, indice + 1)));
}

/**
 * Uma Ciência dos Agendamentos só por vistagem: quando o fluxo do VIOS cria mais de uma (a Apelação cria a dela e
 * um Embargos de Declaração que cria outra; ou duas tarefas pedidas, cada uma com a sua), fica a da primeira tarefa
 * incluída e o robô cancela as outras no VIOS (tipo Duplicidade). Dentro do fluxo de uma tarefa, fica a mais perto
 * dela (menor nível; no empate, a primeira do fluxo). A que está num Embargos repetido não conta: sai com ele.
 * Devolve qual fica: a própria tarefa (caminho null, quando ela é a Ciência) ou o caminho no fluxo dela; null
 * quando nenhuma cria Ciência. O robô segue a mesma regra no lançamento (sama-rpa).
 */
export function cienciaQueFica<T>(tarefas: TarefaComFluxo<T>[]): QualFica<T> {
  const embargos = embargosQueFica(tarefas);
  return primeiraNaOrdem(tarefas, ehCienciaDosAgendamentos, (chave, caminho) => noEmbargosRepetido(embargos, chave, caminho));
}

/**
 * O que o robô cancela no VIOS depois de lançar (tipo Duplicidade): a Ciência dos Agendamentos e o Embargos de
 * Declaração repetidos (`cienciaQueFica`, `embargosQueFica`), este com tudo o que ele cria. Diz, para a tarefa
 * pedida (caminho null) ou para uma do fluxo dela, se fica repetida.
 */
export function repetidasNaVistagem<T>(tarefas: TarefaComFluxo<T>[]): (chave: T, caminho: string[] | null) => boolean {
  const embargos = embargosQueFica(tarefas);
  const ciencia = cienciaQueFica(tarefas);
  return (chave, caminho) => {
    if (caminho === null) {
      const pedida = tarefas.find((tarefa) => tarefa.chave === chave);
      return Boolean(pedida && ehCienciaDosAgendamentos(pedida.nome) && !mesmaTarefa(ciencia, chave, null));
    }
    if (noEmbargosRepetido(embargos, chave, caminho)) return true;
    return ehCienciaDosAgendamentos(caminho[caminho.length - 1]) && !mesmaTarefa(ciencia, chave, caminho);
  };
}

/** Por que a tarefa do fluxo sai: é a Ciência repetida, o Embargos repetido ou uma que o Embargos repetido cria. */
export type Repetida = "ciencia" | "embargos" | "do_embargos";

/** Qual repetida é a tarefa do fluxo neste caminho (já marcada como repetida). */
export function repetidaDoCaminho(caminho: string[]): Repetida {
  if (ehEmbargosDeDeclaracao(caminho[caminho.length - 1])) return "embargos";
  return caminho.some(ehEmbargosDeDeclaracao) ? "do_embargos" : "ciencia";
}

/** O que a tela diz da tarefa repetida (o robô cancela no VIOS depois de lançar). */
export const TEXTO_DA_REPETIDA: Record<Repetida, string> = {
  ciencia: "repetida: o robô cancela no VIOS (Duplicidade); fica a da primeira tarefa",
  embargos: "repetido: o robô cancela no VIOS (Duplicidade), com o que ele cria; fica o da primeira tarefa",
  do_embargos: "do Embargos repetido: o robô cancela no VIOS (Duplicidade)",
};

export function textoDaRepetida(caminho: string[]): string {
  return TEXTO_DA_REPETIDA[repetidaDoCaminho(caminho)];
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
