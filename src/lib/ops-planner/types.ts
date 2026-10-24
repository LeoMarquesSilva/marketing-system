/**
 * Planner de Operações Legais (Operações Legais > Planner).
 *
 * Um espaço por equipe de Operações Legais do organograma, com listas, tarefas,
 * rotinas recorrentes e alarmes. Status, prioridade e tipo são os mesmos em
 * todos os espaços para que Minhas tarefas e a Gestão comparem coisas iguais.
 * O Planner de Marketing (marketing_requests) continua à parte.
 */

import type { OpsKpis } from "./domain";

export const OPS_PLANNER_PATH = "/operacoes-legais/planner";
export const OPS_SPACES_PATH = `${OPS_PLANNER_PATH}/espacos`;
export const OPS_MANAGEMENT_PATH = `${OPS_PLANNER_PATH}/gestao`;
export const OPS_ROUTINES_PATH = `${OPS_PLANNER_PATH}/rotinas`;

/** Bucket privado dos anexos (upload por URL assinada criada na API). */
export const OPS_FILES_BUCKET = "MARKETING-SYSTEM-OPS";
export const OPS_FILE_MAX_BYTES = 50 * 1024 * 1024;

export const OPS_TASK_STATUSES = ["a_fazer", "em_andamento", "aguardando", "concluida", "cancelada"] as const;
export type OpsTaskStatus = (typeof OPS_TASK_STATUSES)[number];

/** Colunas do quadro (cancelada só aparece no filtro da lista). */
export const OPS_BOARD_STATUSES: OpsTaskStatus[] = ["a_fazer", "em_andamento", "aguardando", "concluida"];

export const OPS_STATUS_LABEL: Record<OpsTaskStatus, string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const OPS_PRIORITIES = ["urgente", "alta", "media", "baixa"] as const;
export type OpsPriority = (typeof OPS_PRIORITIES)[number];

export const OPS_PRIORITY_LABEL: Record<OpsPriority, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const OPS_TIPOS = ["operacional", "projeto", "plano_acao"] as const;
export type OpsTipo = (typeof OPS_TIPOS)[number];

export const OPS_TIPO_LABEL: Record<OpsTipo, string> = {
  operacional: "Operacional",
  projeto: "Projeto",
  plano_acao: "Plano de ação",
};

export const OPS_SPACE_ROLES = ["gestor", "lider", "membro"] as const;
export type OpsSpaceRole = (typeof OPS_SPACE_ROLES)[number];

export const OPS_SPACE_ROLE_LABEL: Record<OpsSpaceRole, string> = {
  gestor: "Gestor",
  lider: "Líder",
  membro: "Membro",
};

export interface OpsSpace {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  wip_limit: number;
  sort_order: number;
}

export interface OpsList {
  id: string;
  space_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

export interface OpsMember {
  space_id: string;
  user_id: string;
  role: OpsSpaceRole;
}

/** Pessoa que aparece nos seletores e avatares (users). */
export interface OpsPerson {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface OpsTask {
  id: string;
  space_id: string;
  list_id: string | null;
  parent_task_id: string | null;
  routine_id: string | null;
  occurrence_date: string | null;
  title: string;
  description: string | null;
  status: OpsTaskStatus;
  priority: OpsPriority;
  tipo: OpsTipo;
  assignee_ids: string[];
  requested_by: string | null;
  start_date: string | null;
  due_date: string | null;
  due_time: string | null;
  next_step: string | null;
  waiting_on: string | null;
  waiting_since: string | null;
  reschedule_count: number;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Tarefa com os contadores mostrados no cartão e na linha da lista. */
export interface OpsTaskSummary extends OpsTask {
  subtask_count: number;
  subtask_done_count: number;
  checklist_count: number;
  checklist_done_count: number;
  comment_count: number;
}

export interface OpsChecklistItem {
  id: string;
  task_id: string;
  label: string;
  sort_order: number;
  done_at: string | null;
  done_by: string | null;
}

export interface OpsComment {
  id: string;
  task_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
}

export interface OpsActivity {
  id: string;
  task_id: string;
  user_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: string;
}

export interface OpsAttachment {
  id: string;
  task_id: string;
  kind: "link" | "file";
  name: string;
  url: string | null;
  storage_path: string | null;
  content_type: string | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
}

export interface OpsTaskDetail {
  task: OpsTask;
  subtasks: OpsTask[];
  checklist: OpsChecklistItem[];
  comments: OpsComment[];
  activity: OpsActivity[];
  attachments: OpsAttachment[];
  routine: Pick<OpsRoutine, "id" | "title"> | null;
}

export const OPS_FREQUENCIES = ["diaria", "semanal", "mensal", "anual"] as const;
export type OpsFrequency = (typeof OPS_FREQUENCIES)[number];

export const OPS_FREQUENCY_LABEL: Record<OpsFrequency, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
  anual: "Anual",
};

export const OPS_MONTHLY_MODES = ["dia_do_mes", "dia_util", "semana_do_mes"] as const;
export type OpsMonthlyMode = (typeof OPS_MONTHLY_MODES)[number];

export const OPS_SHIFTS = ["manter", "antecipar", "adiar"] as const;
export type OpsShift = (typeof OPS_SHIFTS)[number];

/** Regra de recorrência (colunas de ops_routines usadas pelo motor). */
export interface OpsRecurrenceRule {
  frequency: OpsFrequency;
  every_n: number;
  weekdays: number[];
  only_business_days: boolean;
  monthly_mode: OpsMonthlyMode | null;
  month_day: number | null;
  business_day_n: number | null;
  week_of_month: number | null;
  weekday: number | null;
  month: number | null;
  shift_non_business: OpsShift;
  starts_on: string;
  ends_on: string | null;
}

export interface OpsRoutine extends OpsRecurrenceRule {
  id: string;
  space_id: string;
  list_id: string | null;
  title: string;
  description: string | null;
  priority: OpsPriority;
  tipo: OpsTipo;
  assignee_ids: string[];
  checklist: string[];
  due_time: string | null;
  lead_days: number;
  active: boolean;
  last_occurrence_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Rotina com o que a tela mostra: próxima data e as últimas ocorrências. */
export interface OpsRoutineSummary extends OpsRoutine {
  next_dates: string[];
  recent: Array<{ task_id: string; occurrence_date: string; status: OpsTaskStatus; on_time: boolean | null }>;
}

export const OPS_NOTIFICATION_KINDS = [
  "rotina_gerada",
  "vence_amanha",
  "vence_hoje",
  "atrasada",
  "escalada",
  "atribuida",
  "comentario",
] as const;
export type OpsNotificationKind = (typeof OPS_NOTIFICATION_KINDS)[number];

export interface OpsNotification {
  id: string;
  recipient_id: string;
  task_id: string | null;
  routine_id: string | null;
  kind: OpsNotificationKind;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
}

export interface OpsNotificationPrefs {
  email_digest: boolean;
  manager_digest: boolean;
}

/** Contadores do cartão do espaço na tela Espaços. */
export interface OpsSpaceCounters {
  open: number;
  overdue: number;
  today: number;
  waiting: number;
}

/** Solicitação do Planner de Marketing mostrada (só leitura) em Minhas tarefas e na Gestão. */
export interface OpsMarketingItem {
  id: string;
  title: string;
  stage: string;
  priority: string | null;
  due_date: string | null;
  due_time: string | null;
  assignee_id: string | null;
  href: string;
}

/* ------------------------------------------------------------ gestão */

export interface OpsPersonLoad {
  user_id: string;
  role: OpsSpaceRole | null;
  a_fazer: number;
  em_andamento: number;
  aguardando: number;
  overdue: number;
  waiting_stale: number;
  done_this_month: number;
  over_wip: boolean;
  marketing_open: number;
  marketing_overdue: number;
}

export interface OpsRoutineAdherence {
  generated: number;
  done_on_time: number;
  done_late: number;
  open_overdue: number;
}

export interface OpsSpaceOverview {
  space: OpsSpace;
  kpis: OpsKpis;
  people: OpsPersonLoad[];
  routines: OpsRoutineAdherence;
}

export interface OpsOverview {
  today: string;
  spaces: OpsSpaceOverview[];
}

/** O que o usuário logado pode fazer no Planner (vem de /api/operacoes-legais/planner/me). */
export interface OpsPlannerContext {
  me: OpsPerson;
  is_admin: boolean;
  spaces: OpsSpace[];
  lists: OpsList[];
  memberships: OpsMember[];
  /** Membros de todos os espaços visíveis (para seletores e filtros). */
  members: OpsMember[];
  people: OpsPerson[];
  today: string;
}
