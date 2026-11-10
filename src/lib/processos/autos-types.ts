import type { RoboDoProcesso } from "./tribunais";
import type { PapelParte, PoloParte, TipoContato } from "./types";

/** Bucket privado dos autos. Só a service role alcança; as telas usam URL assinada. */
export const BUCKET_AUTOS = "processos-autos";
/** Mesmo limite do bucket (migration 20261110160000). */
export const TAMANHO_MAXIMO_AUTOS = 200 * 1024 * 1024;
/** Por quantos dias o PDF fica guardado quando ainda há sugestão sem decisão (PROCESSOS_AUTOS_DIAS troca). */
export const DIAS_DE_GUARDA_PADRAO = 7;


/* ---------------------------------------------------------------- pedidos */

export const STATUS_PEDIDO = ["pendente", "em_andamento", "aguardando_pessoa", "concluido", "erro", "cancelado"] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];
export const PEDIDO_ABERTO: StatusPedido[] = ["pendente", "em_andamento", "aguardando_pessoa"];

export const MOTIVOS_ESPERA = ["login", "segundo_fator", "captcha", "segredo_justica"] as const;
export type MotivoEspera = (typeof MOTIVOS_ESPERA)[number];

export interface PedidoAutos {
  id: string;
  processoId: string;
  cnj: string;
  sistema: string;
  tribunal: string;
  status: StatusPedido;
  motivoEspera: MotivoEspera | null;
  erro: string | null;
  segredoLiberado: boolean;
  tentativas: number;
  robo: string | null;
  autor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  concluidoEm: string | null;
}

/* ------------------------------------------------------------- documentos */

export type OrigemDocumento = "robo" | "manual";
export type StatusLeitura = "pendente" | "lendo" | "lida" | "sem_texto" | "erro";

export interface DocumentoAutos {
  id: string;
  nome: string;
  tamanhoBytes: number | null;
  paginas: number | null;
  origem: OrigemDocumento;
  leitura: StatusLeitura;
  leituraErro: string | null;
  leituraIniciadaEm: string | null;
  lidoEm: string | null;
  paginasLidas: number | null;
  paginasSemTexto: number | null;
  autor: string | null;
  criadoEm: string;
  /** O PDF já saiu do armazenamento (ficam o registro e as sugestões, com página e trecho). */
  arquivoRemovidoEm: string | null;
}

/* -------------------------------------------------------------- sugestões */

export const TIPOS_SUGESTAO = ["campo", "parte_nova", "parte_documento", "parte_oab", "parte_endereco", "parte_contato"] as const;
export type TipoSugestao = (typeof TIPOS_SUGESTAO)[number];
export type Confianca = "alta" | "media" | "baixa";
export type SituacaoSugestao = "pendente" | "aprovada" | "recusada";

export interface EnderecoSugerido {
  endereco: string;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}

export interface ContatoSugerido {
  tipo: TipoContato;
  valor: string;
  whatsapp: boolean;
}

/** Pessoa que a IA encontrou nos autos e que ainda não está no processo. */
export interface PessoaSugerida {
  polo: PoloParte;
  papel: PapelParte;
  vinculo: string | null;
  nome: string;
  documento: string | null;
  oab: string | null;
  /** Nome da parte a que a pessoa se liga (sócio de…, advogado de…); o id é resolvido ao aprovar. */
  referenteNome: string | null;
  enderecos: EnderecoSugerido[];
  contatos: ContatoSugerido[];
}

/** O que vai em proc_sugestoes.valor, conforme o tipo. */
/**
 * Valor de um campo. `junto`: outros campos gravados na mesma aprovação (o texto do último andamento leva a
 * data dele).
 */
export interface ValorDeCampo {
  valor: string | number | boolean;
  junto?: Record<string, string | number | boolean>;
}

export type ValorSugestao =
  | ValorDeCampo
  | PessoaSugerida
  | { documento: string }
  | { oab: string }
  | EnderecoSugerido
  | ContatoSugerido;

/** Sugestão pronta para gravar em proc_sugestoes (ainda sem id nem decisão). */
/** De onde veio a sugestão: IA lendo os autos, DataJud (API pública do CNJ) ou o próprio número CNJ. */
export type FonteSugestao = "autos" | "datajud" | "cnj";

export interface SugestaoNova {
  /** Ausente: "autos" (as sugestões da leitura do PDF). */
  fonte?: FonteSugestao;
  tipo: TipoSugestao;
  campo: string | null;
  parteId: string | null;
  /** Item do saneamento a que a sugestão responde. */
  item: string;
  /** Identidade da proposta, para não repetir numa releitura. */
  chave: string;
  resumo: string;
  valor: ValorSugestao;
  pagina: number | null;
  trecho: string | null;
  trechoConferido: boolean;
  confianca: Confianca;
}

export interface Sugestao extends SugestaoNova {
  id: string;
  documentoId: string | null;
  situacao: SituacaoSugestao;
  decididoPor: string | null;
  decididoEm: string | null;
  criadoEm: string;
}

/** Tudo o que o painel "Autos" e a fila de sugestões da ficha mostram. */
export interface AutosDoProcesso {
  robo: RoboDoProcesso;
  /** O cadastro marca o processo como segredo de justiça: pedir ao robô exige liberação. */
  segredoJustica: boolean;
  pedidos: PedidoAutos[];
  documentos: DocumentoAutos[];
  sugestoes: Sugestao[];
  /** Há chave de IA configurada no servidor (sem ela, o PDF é guardado mas não é lido). */
  iaConfigurada: boolean;
  /** Dias que o PDF fica guardado enquanto houver sugestão sem decisão. */
  diasDeGuarda: number;
}
