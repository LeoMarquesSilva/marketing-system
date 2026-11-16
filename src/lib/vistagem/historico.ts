import { esperandoOVios } from "./situacao-robo";
import type { Pendencia } from "./triagem";
import type { AjusteNaTarefa, DuplicidadeResultado, EnvioStatus, InconsistenciaResumo, PublicacaoStatus } from "./types";

/**
 * Histórico da publicação (botão "Histórico" da Conferência, pedido de 09/11/2026): o que aconteceu com ela, em ordem.
 * Não há uma tabela de eventos; a linha do tempo sai das colunas de quem fez e quando (triagem, transferência,
 * vistagem, devolução, conferência, check, Central), das tarefas (ajustes e robô) e das inconsistências.
 * Transferência e devolução guardam só a última vez.
 */
export type TipoEvento =
  | "chegada"
  | "triagem"
  | "pendencia"
  | "duplicidade"
  | "transferencia"
  | "vistagem"
  | "devolucao"
  | "revistagem"
  | "reabertura"
  | "inconsistencia"
  | "ajuste"
  | "conferencia"
  | "central"
  | "central_erro"
  | "robo_envio"
  | "robo_andamento"
  | "robo_espera"
  | "robo_ok"
  | "robo_simulado"
  | "robo_erro"
  | "check";

export interface EventoHistorico {
  tipo: TipoEvento;
  /** Momento (ISO). */
  em: string;
  titulo: string;
  /** Quem fez; null quando foi automático (captura, robô) ou não ficou registrado. */
  por: string | null;
  /** Motivo, observação, mensagem do robô: uma linha cada. */
  detalhes: string[];
  /** Área, para mostrar com o ícone: a da triagem (triagem e pendência) ou a de destino (transferência). */
  area?: string | null;
  /** Transferência: a área de antes. */
  areaDe?: string | null;
  /** Pasta do VIOS achada na triagem. */
  pasta?: { ci: string; vinculo: string | null } | null;
  /** Vistagem: as tarefas como ficaram, com a data e o responsável (para a foto). */
  tarefas?: TarefaResumida[];
  /** Ajuste na conferência: cada campo, de → para. */
  mudancas?: { campo: string; de: string; para: string }[];
}

export interface TarefaResumida {
  tarefa: string;
  /** AAAA-MM-DD. */
  data: string | null;
  responsavel: string | null;
}

/** De quem é a publicação, para o topo do histórico. */
export interface ContextoDoHistorico {
  grupo: string | null;
  cliente: string | null;
  area: string | null;
  risco: boolean;
}

export interface HistoricoPublicacao {
  status: PublicacaoStatus;
  eventos: EventoHistorico[];
  /** Foto de quem aparece (quem fez e responsáveis das tarefas), pela chave do nome (chaveNome). */
  fotos?: Record<string, string>;
  contexto?: ContextoDoHistorico | null;
}

/** Onde a publicação está agora, no topo do histórico. */
export const SITUACAO_ATUAL: Record<PublicacaoStatus, string> = {
  captada: "Captada, esperando a triagem",
  duplicidade: "Marcada como duplicidade",
  descartada: "Descartada",
  triagem_pendente: "Pendente na triagem",
  juridico_vistar: "No jurídico, para vistar",
  controladoria_vistar: "Na conferência da controladoria",
  pronto_para_agendar: "Com o robô",
  agendado: "Agendada no VIOS",
  checado: "Checada",
  revisar: "Em revisão",
  abertura_pasta: "Na Central do SharePoint (abertura de pasta)",
};

const PENDENCIA: Record<Pendencia, string> = {
  sem_pasta: "sem pasta no VIOS",
  varias_pastas: "mais de uma pasta para o processo",
  ex_cliente: "ex-cliente",
  sem_area: "sem área definida",
  sem_grupo: "sem grupo do cliente",
};

type Marca = { por: string | null; em: string };

export interface TarefaNoHistorico {
  tarefa: string;
  data: string | null;
  responsavel: string | null;
  ajustes: AjusteNaTarefa[];
  envioStatus: EnvioStatus;
  envioSimulado: boolean | null;
  envioErro: string | null;
  enviadoEm: string | null;
  envioAtualizadoEm: string | null;
}

export interface DadosDoHistorico {
  status: PublicacaoStatus;
  capturadaEm: string;
  /** Colada na vistagem (e-mail, Teams) em vez de vir no arquivo da Kurier. */
  colada: boolean;
  linhaArquivo: number | null;
  dataPublicacao: string | null;
  triadaEm: string | null;
  pastaCi: string | null;
  pastaVinculo: string | null;
  /** Área (escritório) de agora. */
  escritorio: string | null;
  pendencia: Pendencia | null;
  triagemResolvida: Marca | null;
  duplicidadeRevisada: (Marca & { resultado: DuplicidadeResultado | null }) | null;
  /** Última transferência: `de` é a área de antes; a de destino é a de agora. */
  transferencia: (Marca & { de: string; motivo: string | null }) | null;
  vistagem: (Marca & { observacao: string | null }) | null;
  /** Última devolução e quantas houve. */
  devolucao: (Marca & { motivo: string | null; total: number }) | null;
  revistagem: Marca | null;
  /** Quem vistou reabriu a vistagem para alterar antes da Conferência (a última vez). */
  reabertura?: Marca | null;
  conferencia: Marca | null;
  central: { itemId: string | null; enviadaEm: string | null; erro: string | null; tentativaEm: string | null } | null;
  check: (Marca & { nota: string | null }) | null;
  tarefas: TarefaNoHistorico[];
  inconsistencias: InconsistenciaResumo[];
}

/** AAAA-MM-DD → DD/MM/AAAA. */
function data(iso: string | null): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

const linhas = (...itens: (string | null | false | undefined)[]): string[] => itens.filter((item): item is string => Boolean(item && item.trim()));

/** Tarefa, data e responsável de cada tarefa, como ficaram. */
function resumoDasTarefas(tarefas: TarefaNoHistorico[]): TarefaResumida[] {
  return tarefas.map((tarefa) => ({ tarefa: tarefa.tarefa, data: tarefa.data, responsavel: tarefa.responsavel }));
}

function eventosDoRobo(tarefas: TarefaNoHistorico[]): EventoHistorico[] {
  const eventos: EventoHistorico[] = [];
  // Enviadas juntas (a conferência manda todas de uma vez): um evento só.
  const porEnvio = new Map<string, TarefaNoHistorico[]>();
  for (const tarefa of tarefas) {
    if (!tarefa.enviadoEm) continue;
    porEnvio.set(tarefa.enviadoEm, [...(porEnvio.get(tarefa.enviadoEm) ?? []), tarefa]);
  }
  for (const [em, juntas] of porEnvio) {
    eventos.push(
      juntas.length === 1
        ? { tipo: "robo_envio", em, titulo: `${juntas[0].tarefa} enviada ao robô`, por: null, detalhes: [] }
        : { tipo: "robo_envio", em, titulo: `${juntas.length} tarefas enviadas ao robô`, por: null, detalhes: juntas.map((tarefa) => tarefa.tarefa) }
    );
  }
  // O que o robô respondeu por último em cada tarefa.
  for (const tarefa of tarefas) {
    const em = tarefa.envioAtualizadoEm ?? tarefa.enviadoEm;
    if (!em) continue;
    const erro = linhas(tarefa.envioErro);
    if (tarefa.envioStatus === "concluido") {
      eventos.push(
        tarefa.envioSimulado
          ? { tipo: "robo_simulado", em, titulo: `${tarefa.tarefa}: o robô conferiu em simulação, sem gravar no VIOS`, por: null, detalhes: [] }
          : { tipo: "robo_ok", em, titulo: `${tarefa.tarefa} agendada no VIOS`, por: null, detalhes: [] }
      );
    } else if (tarefa.envioStatus === "erro") {
      eventos.push({ tipo: "robo_erro", em, titulo: `${tarefa.tarefa}: erro no robô`, por: null, detalhes: erro });
    } else if (esperandoOVios(tarefa)) {
      eventos.push({ tipo: "robo_espera", em, titulo: `${tarefa.tarefa}: aguardando a publicação no VIOS`, por: null, detalhes: erro });
    } else if (tarefa.envioStatus === "processando") {
      eventos.push({ tipo: "robo_andamento", em, titulo: `${tarefa.tarefa}: o robô está agendando`, por: null, detalhes: [] });
    }
  }
  return eventos;
}

export function montarHistorico(dados: DadosDoHistorico): EventoHistorico[] {
  const eventos: EventoHistorico[] = [];
  const tarefasNaVistagem = resumoDasTarefas(dados.tarefas);

  eventos.push({
    tipo: "chegada",
    em: dados.capturadaEm,
    titulo: dados.colada ? "Colada na vistagem" : "Chegou no arquivo da Kurier",
    por: null,
    detalhes: linhas(
      dados.dataPublicacao && `Publicada em ${data(dados.dataPublicacao)}`,
      !dados.colada && dados.linhaArquivo !== null && `Linha ${dados.linhaArquivo} do arquivo`
    ),
  });

  // Área em que caiu na triagem: a de antes da transferência, se houve.
  const areaDaTriagem = dados.transferencia?.de ?? dados.escritorio;
  const pasta = dados.pastaCi ? { ci: dados.pastaCi, vinculo: dados.pastaVinculo } : null;
  if (dados.triadaEm) {
    eventos.push(
      dados.triagemResolvida
        ? {
            tipo: "triagem",
            em: dados.triadaEm,
            titulo: "Triada",
            por: null,
            detalhes: linhas(dados.pendencia ? `Ficou pendente: ${PENDENCIA[dados.pendencia]}` : "Ficou pendente na triagem"),
          }
        : {
            tipo: "triagem",
            em: dados.triadaEm,
            titulo: "Triada",
            por: null,
            detalhes: linhas(!pasta && dados.pendencia && `Pendência: ${PENDENCIA[dados.pendencia]}`),
            area: areaDaTriagem,
            pasta,
          }
    );
  }
  if (dados.triagemResolvida) {
    eventos.push({
      tipo: "pendencia",
      em: dados.triagemResolvida.em,
      titulo: "Pendência da triagem resolvida",
      por: dados.triagemResolvida.por,
      detalhes: [],
      area: areaDaTriagem,
      pasta,
    });
  }
  if (dados.duplicidadeRevisada) {
    eventos.push({
      tipo: "duplicidade",
      em: dados.duplicidadeRevisada.em,
      titulo: dados.duplicidadeRevisada.resultado === "confirmada" ? "Confirmada como duplicidade" : "Revisada: não é duplicidade",
      por: dados.duplicidadeRevisada.por,
      detalhes: [],
    });
  }
  if (dados.transferencia) {
    eventos.push({
      tipo: "transferencia",
      em: dados.transferencia.em,
      titulo: "Transferida de área",
      por: dados.transferencia.por,
      detalhes: linhas(dados.transferencia.motivo && `Motivo: ${dados.transferencia.motivo}`),
      areaDe: dados.transferencia.de,
      area: dados.escritorio,
    });
  }
  if (dados.vistagem) {
    eventos.push({
      tipo: "vistagem",
      em: dados.vistagem.em,
      titulo: "Vistada",
      por: dados.vistagem.por,
      detalhes: linhas(dados.vistagem.observacao && `Observação: ${dados.vistagem.observacao}`),
      // As tarefas são as de agora: depois de uma devolução, aparecem na nova vistagem.
      tarefas: dados.revistagem ? [] : tarefasNaVistagem,
    });
  }
  if (dados.devolucao) {
    eventos.push({
      tipo: "devolucao",
      em: dados.devolucao.em,
      titulo: "Devolvida ao jurídico",
      por: dados.devolucao.por,
      detalhes: linhas(
        dados.devolucao.motivo && `Motivo: ${dados.devolucao.motivo}`,
        dados.devolucao.total > 1 && `Foi devolvida ${dados.devolucao.total} vezes; aqui aparece a última.`
      ),
    });
  }
  if (dados.reabertura) {
    eventos.push({ tipo: "reabertura", em: dados.reabertura.em, titulo: "Vistagem reaberta para alterar, antes da Conferência", por: dados.reabertura.por, detalhes: [] });
  }
  if (dados.revistagem) {
    eventos.push({ tipo: "revistagem", em: dados.revistagem.em, titulo: "Vistada de novo", por: dados.revistagem.por, detalhes: [], tarefas: tarefasNaVistagem });
  }

  for (const inconsistencia of dados.inconsistencias) {
    eventos.push({
      tipo: "inconsistencia",
      em: inconsistencia.criadoEm,
      titulo: `Inconsistência apontada: ${inconsistencia.tipo}${inconsistencia.subtipo ? ` (${inconsistencia.subtipo})` : ""}`,
      por: inconsistencia.criadoPor,
      detalhes: linhas(inconsistencia.descricao),
    });
    if (inconsistencia.contestadoEm) {
      eventos.push({
        tipo: "inconsistencia",
        em: inconsistencia.contestadoEm,
        titulo: "Inconsistência contestada",
        por: inconsistencia.contestadoPor,
        detalhes: linhas(inconsistencia.contestacao),
      });
    }
    if (inconsistencia.excluidaEm) {
      eventos.push({
        tipo: "inconsistencia",
        em: inconsistencia.excluidaEm,
        titulo: "Inconsistência retirada",
        por: inconsistencia.excluidaPor,
        detalhes: linhas(inconsistencia.motivoExclusao && `Motivo: ${inconsistencia.motivoExclusao}`),
      });
    }
  }

  for (const tarefa of dados.tarefas) {
    for (const ajuste of tarefa.ajustes) {
      eventos.push({
        tipo: "ajuste",
        em: ajuste.em,
        titulo: `${tarefa.tarefa} ajustada na conferência`,
        por: ajuste.por,
        detalhes: [],
        mudancas: ajuste.mudancas.map((mudanca) => ({ campo: mudanca.campo, de: mudanca.de || "vazio", para: mudanca.para || "vazio" })),
      });
    }
  }

  const paraCentral = dados.status === "abertura_pasta" || Boolean(dados.central);
  if (dados.conferencia) {
    eventos.push({
      tipo: "conferencia",
      em: dados.conferencia.em,
      titulo: paraCentral ? "Conferida e enviada à Central (abertura de pasta)" : "Conferida e enviada ao robô",
      por: dados.conferencia.por,
      detalhes: [],
    });
  }
  if (dados.central?.enviadaEm) {
    eventos.push({
      tipo: "central",
      em: dados.central.enviadaEm,
      titulo: "Pedido de abertura de pasta criado na Central do SharePoint",
      por: null,
      detalhes: linhas(dados.central.itemId && `Item ${dados.central.itemId}`),
    });
  } else if (dados.central?.erro) {
    const em = dados.central.tentativaEm ?? dados.conferencia?.em;
    if (em) eventos.push({ tipo: "central_erro", em, titulo: "A Central do SharePoint não respondeu", por: null, detalhes: linhas(dados.central.erro) });
  }

  eventos.push(...eventosDoRobo(dados.tarefas));

  if (dados.check) {
    eventos.push({ tipo: "check", em: dados.check.em, titulo: "Checada", por: dados.check.por, detalhes: linhas(dados.check.nota && `Nota: ${dados.check.nota}`) });
  }

  // Em ordem de tempo; no mesmo instante, fica a ordem do fluxo (a ordenação é estável).
  return eventos
    .filter((evento) => Number.isFinite(Date.parse(evento.em)))
    .sort((a, b) => Date.parse(a.em) - Date.parse(b.em));
}
