import { paraDataVios, type EtiquetaAgendamento } from "./agendamento";
import { escritorioNoBkp, tiposDoAgendamento } from "./bkp-sioe";
import { ehCienciaDosAgendamentos, ehCienciaNf } from "./ciencia-agendamentos";
import { agendaNoVios, partesDaData, type LinhaNoVios } from "./como-fica-no-vios";
import type { DataDoFluxo, TarefaPrevista } from "./types";

/**
 * "Central do SharePoint": a lista SOLICITAÇÃO DE AGENDAMENTOS E REAGENDAMENTOS (site CONTROLADORIAJURDICA). Publicação
 * sem pasta no VIOS não vai para o robô: depois da conferência da controladoria vira um pedido de abertura de pasta nessa lista,
 * com os mesmos campos do fluxo antigo da lista de trabalho (modelo: item 64033), e a controladoria agenda ao abrir a pasta.
 */

/**
 * A publicação vai para a Central quando não há pasta para abrir o agendamento. Com várias pastas (liberada sem escolher
 * uma), o processo tem pasta no VIOS: não é abertura, segue para a conferência e o robô, que acha pela intimação.
 */
export function vaiParaCentral(publicacao: { pastaCi: string | null; pendencia: string | null }): boolean {
  return !publicacao.pastaCi && publicacao.pendencia !== "varias_pastas";
}

/**
 * Etiqueta "Abertura de pasta" nas telas: as publicações sem pasta que estão ou já foram para esse caminho. A duplicidade e
 * a captada também não têm pasta, mas por outro motivo; a descartada saiu da esteira.
 */
export function ehAberturaDePasta(publicacao: { status: string; pastaCi: string | null; pendencia: string | null }): boolean {
  return !["duplicidade", "captada", "descartada"].includes(publicacao.status) && vaiParaCentral(publicacao);
}

/** Opção da coluna "ÁREA / EQUIPE" para um escritório; a lista não tem Operações Legais, que vai em "DEPARTAMENTO". */
const AREAS_DA_CENTRAL = new Set([
  "CÍVEL",
  "INSOLVÊNCIA",
  "TRABALHISTA",
  "TRIBUTÁRIO",
  "CÍVEL | INSOLVÊNCIA",
  "COMERCIAL",
  "CONTRATOS",
  "RECUPERAÇÃO DE CRÉDITO",
  "SPECIAL SITUATIONS",
]);

const CAMPO = {
  processo: "PROCESSO",
  descricao: "DESCRI_x00c7__x00c3_ODOPRAZO",
  dataEnviar: "DATA_x002d_ENVIAR",
  status: "Status",
  area: "_x00c1_REA_x0020__x002f__x0020_E",
  departamento: "DEPARTAMENTO",
  motivo: "MOTIVO_x0020__x002f__x0020_OBSER",
  tipoAbertura: "Tipo_x0020_de_x0020_Agendamento_",
  risco: "DEMANDADERISCO",
  dataAtual: "DATAATUAL",
} as const;

/** O campo é texto longo do SharePoint (até 63.999 caracteres); os teores maiores vão cortados, com aviso. */
const LIMITE_MOTIVO = 60_000;

const ROTULO_TAREFA: Record<EtiquetaAgendamento, string> = { PRAZO: "PRAZO", PROVIDENCIA: "PROVIDÊNCIA", COMPROMISSO: "COMPROMISSO" };

export interface PublicacaoParaCentral {
  numero_processo: string | null;
  processo_sufixo: string | null;
  numero_processo_original: string;
  grupo_cliente: string | null;
  cliente: string | null;
  escritorio_responsavel: string | null;
  demanda_risco: boolean | null;
  teor: string;
  observacao_vistagem: string | null;
  publicacao_esocial: string | null;
  /** Parte que a triagem identificou como cliente (a publicação sem pasta não tem cliente gravado). */
  sugestao_triagem: { cliente?: string | null } | null;
}

export interface TarefaParaCentral {
  etiqueta: EtiquetaAgendamento;
  tarefa: string;
  /** AAAA-MM-DD; no Prazo, o Enviar. */
  data: string;
  data_fatal: string | null;
  dias_prazo: number | null;
  contagem_prazo: string | null;
  hora: string | null;
  hora_fim: string | null;
  responsavel: string;
  revisor: string | null;
  observacao: string | null;
  fluxo_datas: DataDoFluxo[] | null;
  /**
   * O que o fluxo do VIOS cria com a tarefa, com a data e quem fica em cada uma (`comFluxoPrevisto`). Sem a árvore do
   * VIOS (falhou a leitura), vai só o que o jurídico mudou no fluxo (`fluxo_datas`).
   */
  fluxo_previsto?: TarefaPrevista[] | null;
  /** Prazo apertado: o Enviar vistado já passou, e a tarefa vai com o de hoje. */
  enviar_hoje?: string | null;
}

/** Número como a lista guarda, com o incidente junto ("1413501-21.2026.8.12.0000/50002"). */
export function processoNaCentral(publicacao: Pick<PublicacaoParaCentral, "numero_processo" | "processo_sufixo" | "numero_processo_original">): string {
  const numero = publicacao.numero_processo?.trim() || publicacao.numero_processo_original.trim();
  return publicacao.numero_processo && publicacao.processo_sufixo ? `${numero}/${publicacao.processo_sufixo}` : numero;
}

/**
 * "DATA - ENVIAR": no fluxo antigo vinha da "DATA - PRIMEIRO PRAZO/PROVIDÊNCIA". A Ciência dos Agendamentos, que o
 * Orquestra põe sozinho no dia do lançamento, não conta; nunca fica no passado, como no envio ao robô.
 */
export function dataEnviarNaCentral(tarefas: Pick<TarefaParaCentral, "tarefa" | "data" | "enviar_hoje">[], hoje: string): string {
  const pedidas = tarefas.filter((tarefa) => !ehCienciaDosAgendamentos(tarefa.tarefa));
  const primeira = (pedidas.length ? pedidas : tarefas).map((tarefa) => tarefa.enviar_hoje ?? tarefa.data).sort()[0];
  return primeira && primeira > hoje ? primeira : hoje;
}

/** "20/11/2026 (sex)": quem agenda à mão confere o dia da semana. */
function diaComSemana(iso: string): string {
  return `${paraDataVios(iso)} (${partesDaData(iso).semana})`;
}

/** Uma tarefa da árvore: data, nome e quem fica, com o que difere do VIOS (quem agenda à mão precisa repetir). */
function linhaDoFluxo(linha: LinhaNoVios, etiqueta: EtiquetaAgendamento): string {
  const nome = linha.principal ? `${linha.nome} (${etiqueta === "PRAZO" ? "Enviar" : "esta tarefa"})` : linha.nome;
  const notas = [
    linha.criadaPor ? `criada por ${linha.criadaPor}` : null,
    linha.nota,
    !linha.principal && linha.data && linha.dataVios && linha.data !== linha.dataVios ? `o VIOS daria ${paraDataVios(linha.dataVios)}: mudar a data` : null,
    linha.repetida ? "repetida nesta vistagem: cancelar no VIOS (fica a da primeira tarefa)" : null,
  ].filter(Boolean);
  const partes = [
    `${linha.data ? diaComSemana(linha.data) : "data do VIOS"}${linha.hora ? ` às ${linha.hora}` : ""}`,
    nome,
    linha.responsaveis?.trim() || "responsável padrão do VIOS",
  ];
  // As que nascem de outra do fluxo ficam um nível para dentro, como na árvore da tela.
  const recuo = linha.criadaPor ? "     " : "   ";
  return `${recuo}- ${partes.join(" | ")}${notas.length ? ` (${notas.join("; ")})` : ""}`;
}

/** A árvore do fluxo da tarefa, em ordem de data: a pedida (no Prazo, o Enviar), o Revisar, o Protocolar e as outras. */
function arvoreDaTarefa(tarefa: TarefaParaCentral, indice: number): string[] {
  const agenda = agendaNoVios({
    id: String(indice),
    tarefa: tarefa.tarefa,
    data: tarefa.data,
    hora: tarefa.hora,
    responsavel: tarefa.responsavel,
    revisor: tarefa.revisor,
    enviarHoje: tarefa.enviar_hoje ?? null,
    fluxoPrevisto: tarefa.fluxo_previsto ?? [],
    viosTarefas: null,
  });
  // Só a tarefa pedida, sem fluxo: a linha de cima já diz tudo.
  if (agenda.linhas.length < 2 && !agenda.aoConcluir.length) return [];
  return [
    "   Fluxo no VIOS (data | tarefa | responsável):",
    ...agenda.linhas.map((linha) => linhaDoFluxo(linha, tarefa.etiqueta)),
    ...(agenda.aoConcluir.length ? [`   Ao concluir, o VIOS cria: ${agenda.aoConcluir.join(", ")} (responsável padrão do VIOS)`] : []),
  ];
}

function linhaDaTarefa(tarefa: TarefaParaCentral, indice: number): string {
  const partes = [`${indice + 1}. ${ROTULO_TAREFA[tarefa.etiqueta]} - ${tarefa.tarefa}`];
  if (tarefa.etiqueta === "PRAZO") {
    partes.push(`Enviar: ${paraDataVios(tarefa.enviar_hoje ?? tarefa.data)}`);
    if (tarefa.data_fatal) {
      const contagem = tarefa.dias_prazo ? ` (${tarefa.dias_prazo} dias ${tarefa.contagem_prazo === "corridos" ? "corridos" : "úteis"})` : "";
      partes.push(`Fatal: ${paraDataVios(tarefa.data_fatal)}${contagem}`);
    }
  } else {
    const hora = tarefa.hora ? ` às ${tarefa.hora}${tarefa.hora_fim ? ` até ${tarefa.hora_fim}` : ""}` : "";
    partes.push(`Data: ${paraDataVios(tarefa.data)}${hora}`);
  }
  partes.push(`Responsável: ${tarefa.responsavel}`);
  if (tarefa.revisor) partes.push(`Revisor: ${tarefa.revisor}`);
  const linhas = [partes.join(" | ")];
  if (tarefa.observacao?.trim()) linhas.push(`   Observação: ${tarefa.observacao.trim()}`);
  if (tarefa.fluxo_previsto?.length) return [...linhas, ...arvoreDaTarefa(tarefa, indice)].join("\n");
  // Sem a árvore do VIOS: as datas e os responsáveis do fluxo que o jurídico trocou (quem agenda à mão precisa repetir).
  for (const ajuste of tarefa.fluxo_datas ?? []) {
    const nome = ajuste.caminho.at(-1) ?? "fluxo";
    const detalhes = [ajuste.data ? paraDataVios(ajuste.data) : null, ajuste.responsaveis?.length ? ajuste.responsaveis.join(", ") : null].filter(Boolean);
    if (detalhes.length) linhas.push(`   Fluxo, ${nome}: ${detalhes.join(" | ")}`);
  }
  return linhas.join("\n");
}

/** Texto de "MOTIVO / OBSERVAÇÃO", com os títulos do fluxo antigo: quem pediu, os tipos, a vistagem, as tarefas e a publicação. */
export function motivoDaCentral(publicacao: PublicacaoParaCentral, tarefas: TarefaParaCentral[], vistadoPor: string | null): string {
  const quem = vistadoPor?.trim() ?? "";
  const cliente = publicacao.cliente?.trim() || publicacao.sugestao_triagem?.cliente?.trim() || null;
  const tipos = tiposDoAgendamento(tarefas);
  const nf = tarefas.find((tarefa) => ehCienciaNf(tarefa.tarefa));
  const esocial = publicacao.publicacao_esocial?.trim();
  const blocos = [
    `SOLICITADO/ENVIADO POR: ${quem}`,
    `TIPO DA PUBLICAÇÃO: ${tipos.join(", ")}`,
    cliente ? `CLIENTE: ${cliente}${publicacao.cliente?.trim() ? "" : " (sugestão da triagem)"}` : null,
    [`VISTAGEM: ${quem.toUpperCase()}`, publicacao.observacao_vistagem?.trim() ? `motivo: ${publicacao.observacao_vistagem.trim()}` : null].filter(Boolean).join("\n"),
    `TAREFAS:\n${tarefas.map(linhaDaTarefa).join("\n")}`,
    esocial && esocial !== "Não Identificado" ? `PUBLICAÇÃO - ESOCIAL: ${esocial}` : null,
    nf ? `ExecutanteNF: ${nf.responsavel}` : null,
    `PUBLICAÇÃO:\n\n${publicacao.teor.trim()}`,
  ];
  const texto = blocos.filter(Boolean).join("\n\n");
  return texto.length > LIMITE_MOTIVO ? `${texto.slice(0, LIMITE_MOTIVO)}\n\n[Publicação cortada: veja o texto inteiro no ORQESTRAI.]` : texto;
}

/** Campos do item, nos nomes internos da lista. `agora`: ISO da criação. */
export function camposDaCentral(
  publicacao: PublicacaoParaCentral,
  tarefas: TarefaParaCentral[],
  contexto: { vistadoPor: string | null; hoje: string; agora: string }
): Record<string, string | boolean> {
  const escritorio = escritorioNoBkp(publicacao.escritorio_responsavel);
  const grupo = publicacao.grupo_cliente?.trim() || publicacao.cliente?.trim() || "não informado";
  return {
    [CAMPO.processo]: processoNaCentral(publicacao),
    [CAMPO.descricao]: `ABERTURA DE PASTA - PUBLICAÇÃO - GRUPO: ${grupo}`,
    // Meia-noite em Brasília (UTC-3), como a lista grava as datas.
    [CAMPO.dataEnviar]: `${dataEnviarNaCentral(tarefas, contexto.hoje)}T03:00:00Z`,
    [CAMPO.status]: "Pendente",
    ...(escritorio && AREAS_DA_CENTRAL.has(escritorio) ? { [CAMPO.area]: escritorio } : {}),
    ...(escritorio === "OPERAÇÕES LEGAIS" ? { [CAMPO.departamento]: escritorio } : {}),
    [CAMPO.motivo]: motivoDaCentral(publicacao, tarefas, contexto.vistadoPor),
    [CAMPO.tipoAbertura]: "Abertura de Pasta Com Agendamentos",
    [CAMPO.risco]: publicacao.demanda_risco === true,
    [CAMPO.dataAtual]: contexto.agora,
  };
}

/** Item da Central aberto no SharePoint. */
export function linkDoItemNaCentral(itemId: string): string {
  return `https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURDICA/Lists/SOLICITAO%20DE%20AGENDAMENTOS%20E%20REAGENDAMENTOS/DispForm.aspx?ID=${encodeURIComponent(itemId)}`;
}
