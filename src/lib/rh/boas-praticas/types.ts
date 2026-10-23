/**
 * Feedbacks de boas práticas (RH > Boas práticas).
 *
 * Só registro para o RH: nada daqui é enviado ao colaborador. Substitui a
 * planilha DASHBOARD_FEEDBACKS_BOAS_PRATICAS.xlsx.
 */

export interface GoodPracticeFeedback {
  id: string;
  occurred_on: string;
  sent_on: string;
  employee_id: string | null;
  employee_name: string;
  is_team: boolean;
  manager_employee_id: string | null;
  manager_name: string;
  area: string;
  category: string;
  description: string;
  manager_action: string | null;
  responded_on: string | null;
  /** true = visualizado, false = não visualizado, null = sem dado do Feedz. */
  viewed: boolean | null;
  viewed_on: string | null;
  source: "sistema" | "planilha";
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  photo_count: number;
}

/** Bucket PRIVADO das fotos das ocorrências (visualização por link assinado). */
export const FEEDBACK_PHOTOS_BUCKET = "RH-BOAS-PRATICAS";
export const FEEDBACK_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const FEEDBACK_PHOTOS_MAX = 10;
export const FEEDBACK_PHOTO_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type FeedbackPhotoType = (typeof FEEDBACK_PHOTO_TYPES)[number];

export interface FeedbackPhoto {
  id: string;
  feedback_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  /** Quando a foto foi tirada (EXIF), se a câmera gravou. */
  taken_at: string | null;
  created_at: string;
  /** Link assinado, vale 1 hora. */
  url: string;
}

/** Colaborador do cadastro, para escolher quem recebeu e quem é o gestor. */
export interface FeedbackPerson {
  id: string;
  full_name: string;
  /** Nome de exibição: o do organograma, senão primeiro + último nome. */
  short_name: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
  /** Foto do usuário (avatar → OneDrive) ou, na falta, a do organograma. */
  avatar_url: string | null;
}

export interface FeedbackInput {
  occurred_on: string;
  sent_on: string;
  employee_name: string;
  is_team: boolean;
  manager_name: string;
  area: string;
  category: string;
  description: string;
  manager_action: string;
  responded_on: string;
  viewed: boolean | null;
  viewed_on: string;
}

/** Áreas do Registro (mesma grafia das outras telas do RH; Marketing e Comercial à parte). */
export const FEEDBACK_AREAS = [
  "Reestruturação",
  "Cível",
  "Trabalhista",
  "Operações Legais",
  "Societário e Contratos",
  "ADD",
  "Recuperação de Crédito",
  "Tributário",
  "Marketing",
  "Comercial",
] as const;

export const FEEDBACK_CATEGORIES = [
  "Mau uso da cozinha / refeitório",
  "Ambiente de trabalho desorganizado",
  "Mau uso da sala de reunião / áreas comuns",
  "Mau uso dos banheiros",
  "Luz, ar-condicionado ou equipamento ligado",
  "Estacionamento indevido",
  "Fumar em frente ao escritório",
  "Uso e transporte de equipamentos do escritório",
  "Organização do ambiente de trabalho",
  "Outros",
] as const;

export type FeedbackFlowStatus = "respondido" | "visualizado" | "nao_visualizado" | "sem_dado";

export const FLOW_STATUS_LABEL: Record<FeedbackFlowStatus, string> = {
  respondido: "Respondido",
  visualizado: "Visto, sem resposta",
  nao_visualizado: "Não visualizado",
  sem_dado: "Sem dado do Feedz",
};

export type AreaBand = "acionamento" | "atencao" | "monitoramento";

export const AREA_BAND_LABEL: Record<AreaBand, string> = {
  acionamento: "Acionamento",
  atencao: "Atenção",
  monitoramento: "Monitoramento",
};

export const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;
