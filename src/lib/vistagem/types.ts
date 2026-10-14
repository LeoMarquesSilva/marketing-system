/** Situação da publicação no fluxo de vistagem (captura → vistagem → agendamento → revisão). */
export type PublicacaoStatus =
  | "captada"
  | "duplicidade"
  | "descartada"
  | "juridico_vistar"
  | "controladoria_vistar"
  | "pronto_para_agendar"
  | "agendado"
  | "checado"
  | "revisar";

export type DuplicidadeResultado = "confirmada" | "nao_duplicidade";

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

export interface SincronizacaoResultado {
  verificados: number;
  importados: number;
  resultados: { nome: string; situacao: "importado" | "ja_importado" | "erro"; mensagem?: string }[];
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
  status: Extract<PublicacaoStatus, "captada" | "duplicidade" | "descartada">;
  motivoDescarte: string | null;
  /** Linha da publicação principal quando esta é duplicidade dentro do mesmo arquivo. */
  duplicidadeDeLinha: number | null;
}
