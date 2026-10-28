import { chaveNome, type AgendamentoValidado, type OpcaoTarefa } from "./agendamento";

/**
 * Classificação "PUBLICAÇÃO - ESOCIAL" das publicações trabalhistas. Não vai para o VIOS: fica na
 * publicação e, quando a BKP for ligada, em SIOE sp_publicacoes.publicacao_esocial (mesmos valores).
 */
export const CLASSIFICACOES_ESOCIAL = [
  "Não Identificado",
  "Sentença – Conhecimento",
  "Acordo homologado",
  "Homologação de cálculo",
  "Acórdão – Conhecimento",
  "Trânsito em julgado",
  "Deferimento de tutela",
] as const;

export type ClassificacaoEsocial = (typeof CLASSIFICACOES_ESOCIAL)[number];

/** Já vem marcada; o jurídico troca quando a publicação é uma das outras. */
export const ESOCIAL_PADRAO: ClassificacaoEsocial = "Não Identificado";

/** Classificações que pedem, além das tarefas do prazo, a tarefa Inserir E-social no VIOS. */
export const ESOCIAL_COM_TAREFA: readonly ClassificacaoEsocial[] = ["Acordo homologado", "Homologação de cálculo"];

/** Tipo de tarefa do VIOS (Providência) e quem a recebe por padrão. */
export const TAREFA_ESOCIAL = "INSERIR E-SOCIAL";
export const RESPONSAVEL_ESOCIAL = "Larissa de Oliveira Pereira";

/** A classificação eSocial só é pedida nas pastas da área Trabalhista do VIOS. */
export function pedeEsocial(areaDoCatalogo: string | null | undefined): boolean {
  return chaveNome(areaDoCatalogo) === "TRABALHISTA";
}

export function classificacaoEsocial(valor: unknown): ClassificacaoEsocial | null {
  return CLASSIFICACOES_ESOCIAL.find((classificacao) => classificacao === valor) ?? null;
}

export function pedeTarefaEsocial(classificacao: string | null | undefined): boolean {
  return ESOCIAL_COM_TAREFA.some((item) => item === classificacao);
}

/** "INSERIR E-SOCIAL", "Inserir eSocial", "INSERIR ESOCIAL"… são o mesmo tipo. */
function chaveTarefa(nome: string | null | undefined): string {
  return chaveNome(nome).replace(/[^A-Z0-9]/g, "");
}

/** A tarefa Inserir E-social na lista de Providências da área; null se o VIOS ainda não tem o tipo. */
export function tarefaEsocialDaLista(providencias: OpcaoTarefa[]): OpcaoTarefa | null {
  const alvo = chaveTarefa(TAREFA_ESOCIAL);
  return providencias.find((opcao) => chaveTarefa(opcao.nomeVios ?? opcao.nome) === alvo) ?? null;
}

/**
 * Confere a classificação ao gravar a vistagem: obrigatória no Trabalhista (fora dele grava null) e,
 * em Acordo homologado ou Homologação de cálculo, exige a tarefa Inserir E-social entre as tarefas.
 */
export function validarEsocial(entrada: {
  areaDoCatalogo: string | null;
  classificacao: unknown;
  providencias: OpcaoTarefa[];
  itens: Pick<AgendamentoValidado, "tarefaId">[];
}): { ok: true; valor: ClassificacaoEsocial | null } | { ok: false; erro: string } {
  if (!pedeEsocial(entrada.areaDoCatalogo)) return { ok: true, valor: null };
  const classificacao = classificacaoEsocial(entrada.classificacao);
  if (!classificacao) return { ok: false, erro: "Escolha a classificação eSocial da publicação." };
  if (!pedeTarefaEsocial(classificacao)) return { ok: true, valor: classificacao };
  const tarefa = tarefaEsocialDaLista(entrada.providencias);
  if (!tarefa) {
    return {
      ok: false,
      erro: `${classificacao} pede a tarefa ${TAREFA_ESOCIAL}, mas esse tipo de tarefa não está na lista do VIOS para Trabalhista. Avise a controladoria.`,
    };
  }
  if (!entrada.itens.some((item) => item.tarefaId === tarefa.id)) {
    return { ok: false, erro: `${classificacao}: agende também a tarefa ${TAREFA_ESOCIAL}.` };
  }
  return { ok: true, valor: classificacao };
}
