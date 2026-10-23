import type { FluxoDaTarefa } from "./fluxo-vios";
import type { PastaSioe, Pendencia } from "./triagem";

/** Situação da publicação no fluxo de vistagem (captura → vistagem → agendamento → revisão). */
export type PublicacaoStatus =
  | "captada"
  | "duplicidade"
  | "descartada"
  | "triagem_pendente"
  | "juridico_vistar"
  | "controladoria_vistar"
  | "pronto_para_agendar"
  | "agendado"
  | "checado"
  | "revisar";

export type DuplicidadeResultado = "confirmada" | "nao_duplicidade";

export type DuplicidadeCriterio = "texto" | "id_documento";

/** Uma linha da aba "Publicações" do xlsx diário da Kurier. */
export interface KurierLinha {
  /** Número da linha no Excel (1 = primeira linha da planilha). */
  linha: number;
  dataDivulgacao: string | null;
  dataPublicacao: string | null;
  numeroProcesso: string;
  estado: string;
  diario: string;
  nomeLocalizado: string;
  caderno: string;
  comarca: string;
  titulo: string;
  /** PUBLICAÇÃO + CONTINUAÇÃO PUBLICAÇÃO 1..N, sem cortes. */
  teor: string;
}

export interface ProcessoNormalizado {
  /** Número CNJ com máscara (NNNNNNN-DD.AAAA.J.TR.OOOO). */
  cnj: string | null;
  /** Os 20 dígitos do CNJ, usados para cruzar com o VIOS. */
  digitos: string | null;
  /** Complemento após o CNJ (ex.: "5000" em 2197342-77.2026.8.26.0000/5000). */
  sufixo: string | null;
}

export type Justica = "estadual" | "trabalhista" | "federal" | "superior";

export interface TribunalNormalizado {
  sigla: string;
  justica: Justica | null;
}

export interface DjenParte {
  nome: string;
  polo: string;
  idComunicacao: number | null;
}

export interface DjenAdvogado {
  nome: string;
  oab: string;
  uf: string;
}

/** Campos do cabeçalho estruturado das comunicações do DJEN. */
export interface DjenDados {
  idComunicacao: number | null;
  orgao: string | null;
  dataDisponibilizacao: string | null;
  tipoComunicacao: string | null;
  tribunal: string | null;
  intimados: string[];
  partes: DjenParte[];
  advogados: DjenAdvogado[];
  /** Texto da decisão sem os blocos de partes/advogados e sem a linha "Intimado(s) / Citado(s)". */
  corpo: string;
}

// ---------------------------------------------------------------------------
// Respostas das rotas (o que a tela recebe)
// ---------------------------------------------------------------------------

export interface ArquivoKurierResumo {
  id: string;
  nomeArquivo: string;
  dataArquivo: string;
  lote: number;
  origem: "sharepoint" | "upload";
  status: "processando" | "processado" | "erro";
  erro: string | null;
  totalLinhas: number;
  totalCaptadas: number;
  totalDuplicidades: number;
  totalDescartadas: number;
  recebidoEm: string;
  processadoEm: string | null;
}

export interface PublicacaoResumo {
  id: string;
  linhaArquivo: number | null;
  numeroProcesso: string | null;
  numeroProcessoOriginal: string;
  tribunal: string | null;
  justica: Justica | null;
  dataDivulgacao: string | null;
  dataPublicacao: string | null;
  nomeLocalizado: string | null;
  djenIdComunicacao: number | null;
  djenOrgao: string | null;
  djenTipoComunicacao: string | null;
  djenIntimados: string[];
  status: PublicacaoStatus;
  motivoDescarte: string | null;
  duplicidadeDe: string | null;
  duplicidadeResultado: DuplicidadeResultado | null;
  duplicidadeCriterio: DuplicidadeCriterio | null;
  documentoIds: string[];
  /** Triagem com o SIOE. */
  pastaCi: string | null;
  pastaVinculo: string | null;
  cliente: string | null;
  grupoCliente: string | null;
  advogadoResponsavel: string | null;
  situacaoProcesso: string | null;
  escritorioResponsavel: string | null;
  demandaRisco: boolean | null;
  pendencia: Pendencia | null;
  pastasCandidatas: PastaSioe[];
  triadaEm: string | null;
  /** Vistagem do jurídico e conferência da controladoria. */
  observacaoVistagem: string | null;
  vistadoEm: string | null;
  conferidoEm: string | null;
  devolucaoMotivo: string | null;
  devolvidoEm: string | null;
  checadoEm: string | null;
  checkNota: string | null;
  teor: string;
  /** true quando `teor` foi encurtado na listagem. */
  teorResumido: boolean;
}

export interface DuplicidadeItem {
  duplicidade: PublicacaoResumo;
  principal: PublicacaoResumo | null;
  dataArquivo: string | null;
  revisadaPor: string | null;
  revisadaEm: string | null;
}

export interface TriagemResumo {
  triadas: number;
  juridico: number;
  pendentes: number;
  descartadas: number;
  porEscritorio: Record<string, number>;
  erro?: string;
}

export interface SincronizacaoResultado {
  verificados: number;
  importados: number;
  resultados: { nome: string; situacao: "importado" | "ja_importado" | "erro"; mensagem?: string }[];
  triagem?: TriagemResumo;
}

export interface PendenciasControladoria {
  pendentes: PublicacaoResumo[];
  exClientes: PublicacaoResumo[];
}

/** Resolução de uma pendência: CI escolhida e/ou dados informados pela controladoria. */
export interface ResolucaoPendencia {
  ci?: string;
  escritorio?: string;
  grupo?: string;
  demandaRisco?: boolean;
}

/** Publicação pronta para gravar, ainda sem ids do banco. */
export interface PublicacaoCapturada {
  linha: number;
  dataDivulgacao: string | null;
  dataPublicacao: string | null;
  numeroProcessoOriginal: string;
  processo: ProcessoNormalizado;
  estado: string;
  diario: string;
  tribunal: TribunalNormalizado;
  nomeLocalizado: string;
  caderno: string;
  comarca: string;
  titulo: string;
  teor: string;
  djen: DjenDados | null;
  chaveDecisao: string | null;
  /** Ids de documento do PJe citados no texto. */
  documentoIds: string[];
  status: Extract<PublicacaoStatus, "captada" | "duplicidade" | "descartada">;
  motivoDescarte: string | null;
  /** Linha da publicação principal quando esta é duplicidade dentro do mesmo arquivo. */
  duplicidadeDeLinha: number | null;
  /** Como a duplicidade foi reconhecida: mesmo texto ou mesmo Id de documento. */
  duplicidadeCriterio: DuplicidadeCriterio | null;
}

// ---------------------------------------------------------------------------
// Vistagem do jurídico e conferência
// ---------------------------------------------------------------------------

export type EnvioStatus = "nao_enviado" | "pendente" | "enviado" | "processando" | "concluido" | "erro";

export interface AgendamentoResumo {
  id: string;
  ordem: number;
  etiqueta: "PRAZO" | "PROVIDENCIA";
  tarefa: string;
  tarefaId: string | null;
  /** Data da tarefa no VIOS (no Prazo, o Enviar = fatal − 3 dias úteis). */
  data: string;
  dataFatal: string | null;
  diasPrazo: number | null;
  responsavel: string;
  revisor: string | null;
  observacao: string | null;
  envioStatus: EnvioStatus;
  envioSimulado: boolean | null;
  viosTarefaId: string | null;
  envioErro: string | null;
  enviadoEm: string | null;
}

export interface CatalogoVistagem {
  area: string;
  atualizadoEm: string;
  /** `nome` é único na lista (nome repetido no VIOS ganha o tipo); `nomeVios` é o nome original. */
  tarefas: { PRAZO: { id: string; nome: string; nomeVios?: string }[]; PROVIDENCIA: { id: string; nome: string; nomeVios?: string }[] };
  usuarios: { id: string; nome: string }[];
}

export interface VistagemDetalhe {
  publicacao: PublicacaoResumo;
  agendamentos: AgendamentoResumo[];
  catalogo: CatalogoVistagem | null;
  /** Por que não há lista de tarefas (catálogo indisponível ou área sem catálogo). */
  catalogoErro: string | null;
  responsavelSugerido: string | null;
  /** Auxiliar da pasta no VIOS (sugerido como revisor do Prazo). */
  revisorSugerido: string | null;
  inconsistencias: InconsistenciaResumo[];
  /** Feriados (AAAA-MM-DD) para contar os dias úteis do Prazo na tela. */
  feriados: string[];
  /** Fluxo automático do VIOS por id do tipo de tarefa (só os que criam algo). */
  fluxos: Record<string, FluxoDaTarefa>;
  /** Por que o fluxo do VIOS não pôde ser carregado. */
  fluxosErro: string | null;
  hoje: string;
}

export interface ConferenciaItem {
  publicacao: PublicacaoResumo;
  agendamentos: AgendamentoResumo[];
  inconsistencias: InconsistenciaResumo[];
  vistadoPor: string | null;
  conferidoPor: string | null;
}

export interface ConferenciaResposta {
  aConferir: ConferenciaItem[];
  enviadas: ConferenciaItem[];
  envioSimulado: boolean;
}

export interface InconsistenciaResumo {
  id: string;
  origem: "juridico" | "agendamento";
  tipo: string;
  subtipo: string | null;
  descricao: string;
  criadoPor: string | null;
  criadoEm: string;
  contestacao: string | null;
  contestadoPor: string | null;
  contestadoEm: string | null;
  excluidaEm: string | null;
  excluidaPor: string | null;
  motivoExclusao: string | null;
}

export interface InconsistenciaItem {
  inconsistencia: InconsistenciaResumo;
  publicacao: PublicacaoResumo;
}

export interface CheckResposta {
  aChecar: ConferenciaItem[];
  revisar: ConferenciaItem[];
  checadas: ConferenciaItem[];
}
