import type { Valores } from "./campos";

export const POLOS = [
  { valor: "ativo", rotulo: "Polo ativo" },
  { valor: "passivo", rotulo: "Polo passivo" },
  { valor: "terceiro", rotulo: "Terceiro" },
] as const;
export type PoloParte = (typeof POLOS)[number]["valor"];

export const PAPEIS = [
  { valor: "parte", rotulo: "Parte" },
  { valor: "representante", rotulo: "Representante" },
  { valor: "socio", rotulo: "Sócio" },
  { valor: "administrador", rotulo: "Administrador" },
  { valor: "corresponsavel", rotulo: "Corresponsável" },
  { valor: "fiador", rotulo: "Fiador" },
  { valor: "avalista", rotulo: "Avalista" },
  { valor: "advogado", rotulo: "Advogado" },
] as const;
export type PapelParte = (typeof PAPEIS)[number]["valor"];

export const TIPOS_CONTATO = [
  { valor: "celular", rotulo: "Celular" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "site", rotulo: "Site" },
] as const;
export type TipoContato = (typeof TIPOS_CONTATO)[number]["valor"];

export type OrigemDado = "manual" | "vios" | "ia";

export function rotuloDoPolo(polo: string): string {
  return POLOS.find((item) => item.valor === polo)?.rotulo ?? polo;
}

export function rotuloDoPapel(papel: string): string {
  return PAPEIS.find((item) => item.valor === papel)?.rotulo ?? papel;
}

/* ------------------------------------------------------------- importação */

export interface ParteImportada {
  polo: PoloParte;
  /** Tipo de parte do VIOS (Exequente, Requerido…), quando o relatório traz. */
  tipo: string | null;
  nome: string;
}

export interface RegistroImportado {
  ci: string;
  valores: Valores;
  partes: ParteImportada[];
}

/* ------------------------------------------------------------------- telas */

export interface Endereco {
  id?: string;
  endereco: string;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  observacao: string | null;
  origem?: OrigemDado;
}

export interface Contato {
  id?: string;
  tipo: TipoContato;
  valor: string;
  whatsapp: boolean;
  observacao: string | null;
  origem?: OrigemDado;
}

export interface Parte {
  id: string;
  polo: PoloParte;
  papel: PapelParte;
  /** Tipo de parte no VIOS ou vínculo informado (sócio de…, fiador de…). */
  vinculo: string | null;
  devedor: boolean;
  referenteA: string | null;
  origem: OrigemDado;
  pessoaId: string;
  nome: string;
  documento: string | null;
  oab: string | null;
  observacao: string | null;
  enderecos: Endereco[];
  contatos: Contato[];
}

/** O que a tela manda para criar ou salvar uma parte (com a pessoa, os endereços e os contatos). */
export interface ParteEntrada {
  polo: PoloParte;
  papel: PapelParte;
  vinculo: string | null;
  devedor: boolean;
  referenteA: string | null;
  nome: string;
  documento: string | null;
  oab: string | null;
  observacao: string | null;
  enderecos: Endereco[];
  contatos: Contato[];
}

export interface Alteracao {
  id: string;
  campo: string;
  anterior: string | null;
  novo: string | null;
  origem: OrigemDado;
  autor: string | null;
  quando: string;
}

export const STATUS_ENVIO = ["pendente", "enviado", "confirmado", "erro", "cancelado"] as const;
export type StatusEnvio = (typeof STATUS_ENVIO)[number];

export interface EnvioVios {
  id: string;
  processoId: string;
  ci: string | null;
  campo: string;
  valorVios: string | null;
  valorNovo: string | null;
  status: StatusEnvio;
  simulado: boolean;
  erro: string | null;
  autor: string | null;
  quando: string;
}

export interface ItemSaneamento {
  chave: string;
  rotulo: string;
  origem: "vios" | "novo";
  estado: "ok" | "falta" | "nao_se_aplica";
  /** Saiu da conta pela regra (item opcional vazio, data de encerramento de processo ativo), não por alguém. */
  automatico?: boolean;
}

export interface Preenchimento {
  itens: ItemSaneamento[];
  /** Itens preenchidos e itens que contam (os "não se aplica" ficam de fora). */
  feitos: number;
  total: number;
  percentual: number;
}

export interface ProcessoResumo {
  id: string;
  ci: string | null;
  cnj: string | null;
  grupoCliente: string | null;
  cliente: string | null;
  area: string | null;
  acao: string | null;
  fase: string | null;
  situacao: string | null;
  uf: string | null;
  comarca: string | null;
  advogadoResponsavel: string | null;
  parteAtiva: string | null;
  partePassiva: string | null;
  valorAcao: number | null;
  etiquetas: string[];
  pendentesVios: number;
  feitos: number;
  total: number;
  percentual: number;
  faltando: string[];
}

export interface ProcessoDetalhe {
  id: string;
  valores: Valores;
  partes: Parte[];
  historico: Alteracao[];
  envios: EnvioVios[];
  preenchimento: Preenchimento;
  naoAplicaveis: string[];
  sincronizadoEm: string | null;
  viosEditadoEm: string | null;
  /** A fila do VIOS está em modo simulado (padrão) ou gravando de verdade. */
  gravacaoSimulada: boolean;
}

export interface ExecucaoSync {
  id: string;
  origem: "sharepoint" | "csv";
  status: "ok" | "erro";
  arquivo: string | null;
  lidos: number;
  noRecorte: number;
  criados: number;
  atualizados: number;
  confirmados: number;
  colunasIgnoradas: string[];
  erro: string | null;
  autor: string | null;
  iniciadoEm: string;
  concluidoEm: string | null;
}

export interface SituacaoImportacao {
  execucoes: ExecucaoSync[];
  envios: EnvioVios[];
  /** Gravação no VIOS simulada (padrão) ou real. */
  gravacaoSimulada: boolean;
  recorte: { areas: string[] | null; grupos: string[] | null };
  totalProcessos: number;
}
