/** Pauta de Audiências: tipos e rótulos sem servidor (telas e regras usam direto). */

export type TipoAudiencia = "una" | "inicial" | "instrucao" | "conciliacao" | "julgamento" | "sessao" | "pericia" | "encerramento" | "outro";
export type Modalidade = "presencial" | "video" | "hibrida";
export type ModalidadeEquipe = "presencial" | "video";
export type Situacao = "designada" | "cancelada" | "realizada";
export type FonteLink = "pje" | "djen" | "manual";
export type Mudanca = "tipo" | "horario" | "vara" | "link" | "cancelada";
export type Papel = "titular" | "backup";

export const ROTULO_TIPO: Record<TipoAudiencia, string> = {
  una: "UNA",
  inicial: "Inicial",
  instrucao: "Instrução",
  conciliacao: "Conciliação",
  julgamento: "Julgamento",
  sessao: "Sessão",
  pericia: "Perícia",
  encerramento: "Encerramento",
  outro: "Audiência",
};

export const ROTULO_MODALIDADE: Record<Modalidade, string> = { presencial: "Presencial", video: "Vídeo", hibrida: "Híbrida" };

export const ROTULO_MUDANCA: Record<Mudanca, string> = {
  tipo: "Tipo mudou",
  horario: "Horário mudou",
  vara: "Vara mudou",
  link: "Link mudou",
  cancelada: "Cancelada no PJe",
};

/** Duração padrão por tipo, em minutos: o PJe muitas vezes grava 1 minuto de duração. Configurável. */
export const DURACAO_PADRAO: Record<TipoAudiencia, number> = {
  una: 60,
  inicial: 60,
  conciliacao: 60,
  instrucao: 120,
  julgamento: 60,
  sessao: 180,
  pericia: 120,
  encerramento: 60,
  outro: 60,
};

export interface PessoaPauta {
  id: string;
  nomeVios: string;
  nomeCurto: string;
  sigla: string | null;
  userId: string | null;
  email: string | null;
  whatsapp: string | null;
  cargo: string | null;
  fazAudiencia: boolean;
  coordenacao: boolean;
  ativo: boolean;
}

/** Uma audiência como as telas recebem. Datas em ISO (UTC); a tela mostra no horário de Brasília. */
export interface Audiencia {
  id: string;
  chave: string;
  origem: "pje" | "vios" | "manual";
  tribunal: string | null;
  cnj: string;
  inicio: string;
  fim: string | null;
  tipo: TipoAudiencia;
  tipoDescricao: string | null;
  ritoSumarissimo: boolean;
  modalidadeTribunal: Modalidade | null;
  modalidadeEquipe: ModalidadeEquipe | null;
  orgao: string | null;
  sala: string | null;
  juizoDigital: boolean | null;
  situacao: Situacao;
  linkSala: string | null;
  linkFonte: FonteLink | null;
  linkFonteData: string | null;
  linkAnterior: string | null;
  cliente: string | null;
  grupoCliente: string | null;
  ciProcesso: string | null;
  reclamanteIniciais: string | null;
  titularId: string | null;
  backupId: string | null;
  substituiId: string | null;
  mudancas: Mudanca[];
  mudancaConferidaEm: string | null;
  viosInicio: string | null;
  viosSituacao: string | null;
  djenConferidoEm: string | null;
  djenData: string | null;
  djenInicio: string | null;
  djenModalidade: Modalidade | null;
  correspondente: string | null;
  observacao: string | null;
  lidaEm: string;
}

/** Um alerta de uma audiência na pauta ou na distribuição. */
export interface AlertaAudiencia {
  tipo: "sem_titular" | "choque" | "deslocamento" | "backup_ocupado" | "cedo" | "mudou" | "cancelada" | "sem_link" | "a_completar" | "vios_diverge";
  grave: boolean;
  texto: string;
}
