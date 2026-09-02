export type AppRole = "admin" | "controladoria" | "juridico" | "ops" | "estag";

export type PublicationStatus =
  | "CAPTURADA"
  | "MATCH_PENDENTE"
  | "JURIDICO_VISTAR"
  | "PRAZO_PENDENTE"
  | "AGENDAR"
  | "AGENDANDO"
  | "SIM_OK"
  | "SIM_OK_AJUSTE"
  | "ERRO"
  | "SKIP";

export type Publication = {
  id: string;
  capture_date: string;
  origem: string;
  source_filename: string | null;
  data_recebimento: string | null;
  advogado_localizado: string | null;
  data_divulgacao: string | null;
  data_publicacao: string | null;
  diario_divisao: string | null;
  pasta: string | null;
  numero_processo: string | null;
  publicacao: string | null;
  responsavel_principal: string | null;
  escritorio_responsavel: string | null;
  grupo: string | null;
  cliente_principal: string | null;
  natureza: string | null;
  status_processo: string | null;
  acao: string | null;
  fase: string | null;
  processo_encerrado: string | null;
  motivo_encerramento: string | null;
  titulo: string | null;
  demanda_risco: boolean;
  prioridade_agendamento: boolean;
  juridico_texto: string | null;
  controladoria_texto: string | null;
  tipo_agendamento_id: string | null;
  tipo_agendamento_label: string | null;
  data_conclusao: string | null;
  data_limite: string | null;
  data_fatal: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  status: PublicationStatus;
  ci: string | null;
  vios_pxe_id: string | null;
  schedule_error: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskType = {
  id: string;
  code: string;
  label_vios: string;
  kind: "prazo" | "compromisso" | "skip";
  requires_hora: boolean;
  active: boolean;
  notes: string | null;
};

export type ProcessBaseRow = {
  ci: string;
  cnj: string | null;
  area: string | null;
  cliente: string | null;
  escritorio_responsavel: string | null;
  acao: string | null;
  situacao: string | null;
  fase: string | null;
  advogado_responsavel: string | null;
  processo_encerrado: string | null;
  titulo: string | null;
  grupo: string | null;
  vinculo: string | null;
  demanda_risco: string | null;
};

export const STATUS_LABELS: Record<PublicationStatus, string> = {
  CAPTURADA: "Capturada",
  MATCH_PENDENTE: "Match pendente",
  JURIDICO_VISTAR: "Jurídico vistar",
  PRAZO_PENDENTE: "Prazo pendente",
  AGENDAR: "Agendar",
  AGENDANDO: "Agendando",
  SIM_OK: "SIM-OK",
  SIM_OK_AJUSTE: "SIM-OK c/ ajuste",
  ERRO: "Erro",
  SKIP: "Skip",
};

export const POSSIVEL_ABERTURA = "POSSÍVEL ABERTURA DE PASTA";
