import type { CivilKey } from "@/lib/rh/pdi/civil";
import type { PdiPerson } from "@/lib/rh/pdi/types";

export type FeedbackKind = "reconhecimento" | "desenvolvimento" | "sem_tipo" | "boa_pratica";
export type FeedbackVisibility = "privado" | "gestor" | "publico";
export type FeedbackRequestStatus = "aberto" | "respondido" | "recusado";

/** Os 5 valores CIVIL que viram etiqueta no feedback (Liderança é critério da avaliação, não valor). */
export const FEEDBACK_VALUES = ["cliente", "inovacao", "valorizacao", "inteligencia", "liberdade"] as const satisfies readonly CivilKey[];
export type FeedbackValue = (typeof FEEDBACK_VALUES)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  reconhecimento: "Reconhecimento",
  desenvolvimento: "Desenvolvimento",
  sem_tipo: "Feedback",
  boa_pratica: "Boa prática",
};

export const FEEDBACK_VISIBILITY_LABELS: Record<FeedbackVisibility, string> = {
  privado: "Só a pessoa",
  gestor: "A pessoa e o gestor dela",
  publico: "Todos (mural)",
};

export interface FeedbackSettings {
  coverage_days: number;
  hr_reads_content: boolean;
  mural_enabled: boolean;
  ai_enabled: boolean;
  email_enabled: boolean;
}

export interface FeedbackTemplate {
  id: string;
  name: string;
  body: string;
  kind: "reconhecimento" | "desenvolvimento" | null;
  is_active: boolean;
}

export interface FeedbackReply {
  id: string;
  author: PdiPerson;
  message: string;
  created_at: string;
  mine: boolean;
}

export interface FeedbackSummary {
  id: string;
  kind: FeedbackKind;
  from: PdiPerson;
  to: PdiPerson;
  visibility: FeedbackVisibility;
  civil_values: FeedbackValue[];
  value_ratings: Record<string, number> | null;
  template_name: string | null;
  /** Texto (pode vir resumido na lista). */
  message: string;
  in_person: boolean;
  ai_assisted: boolean;
  read_at: string | null;
  created_at: string;
  replies_count: number;
  from_feedz: boolean;
  /** Pedido que este feedback respondeu. */
  request_id: string | null;
  good_practice_id: string | null;
  /** Como quem está vendo se relaciona com o feedback. */
  viewer: "remetente" | "destinatario" | "gestor" | "rh" | "mural";
  deleted_at: string | null;
}

export interface GoodPracticeAttachment {
  id: string;
  url: string;
  content_type: string;
  file_name: string;
}

export interface FeedbackDetail extends FeedbackSummary {
  replies: FeedbackReply[];
  my_note: string;
  good_practice: {
    category: string;
    occurred_on: string;
    area: string;
    employee_name: string;
    manual_page: number | null;
    attachments: GoodPracticeAttachment[];
  } | null;
  permissions: {
    canReply: boolean;
    canDelete: boolean;
    canWriteNote: boolean;
    /** Prazo do autor para apagar (24 h). */
    deleteUntil: string | null;
  };
}

export interface FeedbackRequest {
  id: string;
  requester: PdiPerson;
  giver: PdiPerson;
  subject: PdiPerson;
  message: string;
  due_date: string | null;
  status: FeedbackRequestStatus;
  created_at: string;
  answered_at: string | null;
  decline_reason: string | null;
  /** O pedido venceu e ainda está aberto. */
  overdue: boolean;
}

export interface CoverageRow {
  person: PdiPerson;
  /** Dias desde o último feedback que a pessoa recebeu (sem contar Boas práticas). */
  days_received: number | null;
  /** Dias desde o último feedback que a pessoa deu. */
  days_given: number | null;
  /** Dias desde o último pedido de feedback que a pessoa fez. */
  days_requested: number | null;
  /** Na visão do gestor: dias desde o último feedback que ELE deu a esta pessoa. */
  days_from_me: number | null;
  received_total: number;
  given_total: number;
}

export interface ValueCount {
  value: FeedbackValue;
  mine: number;
  company: number;
}

export interface FeedbackOverview {
  me: PdiPerson | null;
  isHr: boolean;
  isLeader: boolean;
  settings: FeedbackSettings;
  templates: FeedbackTemplate[];
  /** Pessoas que podem receber feedback (ativas, sem robôs). */
  people: PdiPerson[];
  received: FeedbackSummary[];
  sent: FeedbackSummary[];
  /** Feedbacks "pessoa e gestor" de quem eu lidero. */
  team_feedbacks: FeedbackSummary[];
  mural: FeedbackSummary[];
  requests_received: FeedbackRequest[];
  requests_sent: FeedbackRequest[];
  team_coverage: CoverageRow[];
  values: ValueCount[];
  unread: number;
}

export interface FeedbackHrOverview {
  settings: FeedbackSettings;
  templates: FeedbackTemplate[];
  feedbacks: FeedbackSummary[];
  deleted: FeedbackSummary[];
  coverage: CoverageRow[];
  requests: FeedbackRequest[];
}

export interface CreateFeedbackInput {
  to_employee_id: string;
  kind: "reconhecimento" | "desenvolvimento";
  visibility: FeedbackVisibility;
  civil_values: FeedbackValue[];
  template_id?: string | null;
  message: string;
  in_person: boolean;
  ai_assisted?: boolean;
  request_id?: string | null;
  note?: string | null;
}

export interface CreateRequestInput {
  giver_employee_ids: string[];
  subject_employee_id?: string | null;
  message: string;
  due_date?: string | null;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  actor: PdiPerson | null;
  read_at: string | null;
  created_at: string;
}
