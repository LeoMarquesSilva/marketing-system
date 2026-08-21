export type VacationLeaveKind =
  | "ferias"
  | "recesso"
  | "abono"
  /** Crédito: dia trabalhado durante o recesso (devolve saldo). */
  | "trabalho_recesso"
  /** Crédito: dia trabalhado durante as férias (devolve saldo). */
  | "trabalho_ferias";

export const VACATION_CREDIT_KINDS: readonly VacationLeaveKind[] = [
  "trabalho_recesso",
  "trabalho_ferias",
];

export function isVacationCreditKind(kind: VacationLeaveKind): boolean {
  return kind === "trabalho_recesso" || kind === "trabalho_ferias";
}

export type VacationPeriodStatus = "em_dia" | "a_vencer" | "vencido" | "quitado";

export interface HrEmployee {
  id: string;
  user_id: string | null;
  full_name: string;
  cpf: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  admission_date: string;
  termination_date: string | null;
  is_active: boolean;
  notes: string | null;
  /** CI do colaborador no VIOS, quando já houve match no sync. */
  vios_ci: string | null;
  /** Fora do controle de férias (ex.: sócios fundadores). */
  vacation_exempt: boolean;
  /** Foto do usuário vinculado (`users.avatar_url` / OneDrive), quando existir. */
  avatar_url: string | null;
}

/** Linha do espelho VIOS sem cadastro correspondente em `hr_employees`. */
export interface ViosUnmatchedEmployee {
  ci: string;
  full_name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  situation: string | null;
  is_active: boolean;
  company: string | null;
}

/** Colaborador cadastrado que não apareceu no último export VIOS. */
export interface ViosMissingEmployee {
  id: string;
  full_name: string;
  email: string | null;
  department: string | null;
  is_active: boolean;
  vios_ci: string | null;
}

export interface ViosSyncAlerts {
  unmatched: ViosUnmatchedEmployee[];
  missingFromExport: ViosMissingEmployee[];
  lastSyncedAt: string | null;
}

export interface VacationPeriod {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  entitled_days: number;
  concessive_start: string;
  concessive_end: string;
  notes: string | null;
}

export interface VacationLeave {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  days: number;
  kind: VacationLeaveKind;
  notes: string | null;
}

export interface CompanyRecess {
  id: string;
  year: number;
  start_date: string;
  end_date: string;
  days: number;
  notes: string | null;
}

/** Situação da aplicação do recesso coletivo nos colaboradores ativos. */
export type RecessApplyState =
  | "pendente"
  | "parcial"
  | "aplicado"
  | "sem_elegiveis";

export interface RecessApplicationSummary {
  eligible: number;
  applied: number;
  pending: number;
  ineligible: number;
  state: RecessApplyState;
}

export interface CompanyRecessWithStatus extends CompanyRecess {
  application: RecessApplicationSummary;
}

/** Parcela de um gozo alocada a um período aquisitivo específico (FIFO). */
export interface LeaveAllocation {
  leave: VacationLeave;
  days: number;
}

export interface PeriodBalance {
  period: VacationPeriod;
  usedDays: number;
  remainingDays: number;
  status: VacationPeriodStatus;
  /** Dias até o fim do período concessivo (negativo quando já venceu). */
  daysUntilDeadline: number;
  allocations: LeaveAllocation[];
}

export interface EmployeeBalance {
  totalEntitledDays: number;
  totalTakenDays: number;
  pendingDays: number;
  /** Dias em períodos cujo prazo concessivo já passou (CLT art. 137 → dobra). */
  overdueDays: number;
  /** Dias cujo prazo concessivo encerra hoje. */
  dueTodayDays: number;
  /** Dias em períodos que vencem dentro da janela de alerta (1–90 dias). */
  dueSoonDays: number;
  /** Dias ainda dentro do prazo concessivo, sem urgência. */
  onTimeDays: number;
  /** Dias gozados além do direito adquirido (adiantamento ou ficha incompleta). */
  unallocatedDays: number;
  /**
   * Dias já lançados (férias/recesso/abono) com início no futuro — "a programar".
   * Ainda não descontam o saldo: o direito só é consumido quando a data chega.
   */
  scheduledDays: number;
  status: VacationPeriodStatus;
  periods: PeriodBalance[];
  /** Período aquisitivo ainda em curso, com proporcional de 2,5 dias/mês. */
  currentPeriod: {
    periodStart: string;
    periodEnd: string;
    accruedDays: number;
  } | null;
  /** Gozo que engloba a data de referência, quando existir. */
  onLeaveNow: VacationLeave | null;
  /** Lançamentos futuros (início após a data de referência), ordenados por início. */
  scheduledLeaves: VacationLeave[];
}

export interface EmployeeWithBalance {
  employee: HrEmployee;
  balance: EmployeeBalance;
}

export interface EmployeeDetail extends EmployeeWithBalance {
  leaves: VacationLeave[];
}

/** Usuário do sistema que pode ser vinculado a um colaborador. */
export interface LinkableUser {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  avatar_url: string | null;
}
