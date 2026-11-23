/**
 * PDI (Plano de Desenvolvimento Individual) — tipos compartilhados entre servidor e telas.
 *
 * Mesmo desenho do Feedz (plano → frentes → ações com progresso 0-100, percentuais por
 * média simples), mais 70-20-10, evidência, prazo por ação e linha do tempo.
 * Engenharia reversa: docs/feedz/README.md.
 */

export type PdiStatus = "ativo" | "concluido" | "cancelado";
export type PdiOrigin = "manual" | "avaliacao" | "feedz";
export type PdiLearningKind = "pratica" | "troca" | "formal";
export type PdiDueState = "em_dia" | "vence_em_breve" | "atrasado" | "concluido" | "cancelado";
export type PdiActivityKind = "progresso" | "comentario" | "status" | "acordo" | "criacao" | "edicao";

export const PDI_STATUS_LABEL: Record<PdiStatus, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const PDI_DUE_STATE_LABEL: Record<PdiDueState, string> = {
  em_dia: "Em dia",
  vence_em_breve: "Vence em breve",
  atrasado: "Atrasado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** 70-20-10: de onde vem o aprendizado de cada ação. */
export const PDI_LEARNING_KINDS: Record<
  PdiLearningKind,
  { label: string; share: string; hint: string }
> = {
  pratica: {
    label: "Prática no trabalho",
    share: "70%",
    hint: "Projetos, desafios e responsabilidades novas no dia a dia.",
  },
  troca: {
    label: "Troca com pessoas",
    share: "20%",
    hint: "Feedback, mentoria, acompanhar alguém mais experiente.",
  },
  formal: {
    label: "Aprendizado formal",
    share: "10%",
    hint: "Cursos, leituras, eventos e certificações.",
  },
};

export const PDI_LEARNING_KIND_ORDER: PdiLearningKind[] = ["pratica", "troca", "formal"];

/** Valores CIVIL: as frentes do PDI costumam nascer de um deles (critérios da avaliação). */
export const CIVIL_VALUES = [
  "Cliente no centro",
  "Inovação constante",
  "Valorização das pessoas",
  "Inteligência em resultados",
  "Liberdade para criar",
  "Liderança",
] as const;

/** Sem atualização há tantos dias, a ação/plano aparece como "parado". */
export const PDI_STALE_DAYS = 30;
/** Faltando até tantos dias para o prazo, o plano aparece como "vence em breve". */
export const PDI_DUE_SOON_DAYS = 15;

export interface PdiPerson {
  id: string;
  name: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface PdiType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface PdiKindCount {
  pratica: number;
  troca: number;
  formal: number;
  sem: number;
}

export interface PdiPlanSummary {
  id: string;
  title: string;
  type_id: string | null;
  type_name: string | null;
  employee: PdiPerson;
  manager: PdiPerson | null;
  start_date: string;
  due_date: string;
  status: PdiStatus;
  origin: PdiOrigin;
  origin_label: string | null;
  progress: number;
  actions_total: number;
  actions_done: number;
  actions_overdue: number;
  due_state: PdiDueState;
  /** Dias até o prazo (negativo = atrasado). */
  days_left: number;
  /** Última atualização de progresso/comentário em qualquer ação. */
  last_update_at: string | null;
  agreed_at: string | null;
  kinds: PdiKindCount;
}

export interface PdiAction {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  learning_kind: PdiLearningKind | null;
  expected_evidence: string | null;
  success_indicator: string | null;
  due_date: string | null;
  progress: number;
  completed_at: string | null;
  learnings: string | null;
  evidence_url: string | null;
  sort_order: number;
  last_update_at: string | null;
  overdue: boolean;
}

export interface PdiGoal {
  id: string;
  title: string;
  description: string | null;
  competency: string | null;
  sort_order: number;
  progress: number;
  actions: PdiAction[];
}

export interface PdiActivity {
  id: string;
  action_id: string | null;
  action_title: string | null;
  kind: PdiActivityKind;
  progress_from: number | null;
  progress_to: number | null;
  body: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
}

export interface PdiPermissions {
  /** Editar estrutura (título, prazos, frentes e ações). */
  canEdit: boolean;
  /** Atualizar progresso, aprendizados e evidência das ações. */
  canUpdateProgress: boolean;
  canComment: boolean;
  /** Registrar o "de acordo" do gestor. */
  canAgree: boolean;
  /** Concluir, cancelar ou reabrir. */
  canChangeStatus: boolean;
  canDelete: boolean;
}

export interface PdiPlanDetail extends PdiPlanSummary {
  career_goal: string | null;
  status_note: string | null;
  completed_at: string | null;
  agreed_by_name: string | null;
  created_by_name: string | null;
  created_at: string;
  goals: PdiGoal[];
  activity: PdiActivity[];
  permissions: PdiPermissions;
  /** Quem está vendo: dono do plano, gestor da equipe ou RH. */
  viewer_role: "dono" | "gestor" | "rh";
}

/** Payload do editor: plano inteiro, com ids das frentes e ações que já existem. */
export interface PdiPlanInput {
  employee_id: string;
  manager_employee_id?: string | null;
  type_id: string | null;
  title: string;
  career_goal: string | null;
  start_date: string;
  due_date: string;
  goals: Array<{
    id?: string;
    title: string;
    description: string | null;
    competency: string | null;
    actions: Array<{
      id?: string;
      title: string;
      description: string | null;
      learning_kind: PdiLearningKind | null;
      expected_evidence: string | null;
      success_indicator: string | null;
      due_date: string | null;
    }>;
  }>;
}

export interface PdiProgressInput {
  progress: number;
  note: string | null;
  learnings: string | null;
  evidence_url: string | null;
}

export interface PdiOverview {
  me: PdiPerson | null;
  myPlans: PdiPlanSummary[];
  /** Planos de quem a pessoa lidera (gestor direto, indireto ou liderança da área). */
  teamPlans: PdiPlanSummary[];
  /** Liderados ativos sem PDI ativo. */
  teamWithoutPlan: PdiPerson[];
  isLeader: boolean;
  isHr: boolean;
  types: PdiType[];
  /** Pessoas para quem quem está vendo pode criar PDI. */
  creatable: PdiPerson[];
}

export interface PdiManagerRow {
  employee: PdiPerson;
  manager_employee_id: string | null;
}
