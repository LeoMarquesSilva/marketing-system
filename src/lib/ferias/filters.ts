import type {
  CompanyRecess,
  EmployeeWithBalance,
  HrEmployee,
  RecessApplicationSummary,
  RecessApplyState,
  VacationPeriodStatus,
} from "@/lib/ferias/types";

export const RECESS_APPLY_STATE_LABEL: Record<RecessApplyState, string> = {
  pendente: "Não aplicado",
  parcial: "Parcialmente aplicado",
  aplicado: "Já aplicado",
  sem_elegiveis: "Sem elegíveis",
};

export type SituationFilter = "ativos" | "inativos" | "all";
export type StatusFilter = "all" | VacationPeriodStatus;
/**
 * Sinal do saldo (quantidade), ortogonal ao status do prazo concessivo.
 * - a_tirar: saldo positivo (ainda há dias a gozar)
 * - a_mais: saldo negativo (gozou além do direito)
 * - zerado: direito e gozo batem
 */
export type BalanceFilter = "all" | "a_tirar" | "a_mais" | "zerado";

export const BALANCE_FILTER_LABEL: Record<BalanceFilter, string> = {
  all: "Todos os saldos",
  a_tirar: "Saldo positivo",
  a_mais: "Saldo negativo",
  zerado: "Zerado",
};

export interface FeriasListFilters {
  search: string;
  status: StatusFilter;
  situation: SituationFilter;
  /** Área do filtro em botões; `all` = sem filtro. */
  department: string;
  /** Sinal do saldo; `all` = sem filtro. */
  balance?: BalanceFilter;
}

export interface FeriasKpis {
  pendingDays: number;
  overdue: number;
  dueSoon: number;
  onLeave: number;
  activeCount: number;
}

/** Rótulo canônico do agrupamento Operações Legais no filtro. */
export const AREA_FILTER_OPERACOES_LEGAIS = "Operações Legais";

function normalizeDepartmentKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Departamentos que entram no filtro "Operações Legais"
 * (Marketing, Financeiro, Facilities, RH + a própria área).
 */
const OPERACOES_LEGAIS_DEPARTMENTS = new Set([
  "operacoes legais",
  "marketing",
  "comercial", // legado; Marketing fica sob Operações Legais
  "financeiro",
  "facilities",
  "rh",
  "r h",
  "recursos humanos",
]);

/** Departamentos que não ganham botão próprio (continuam em "Todas as áreas"). */
const HIDDEN_AREA_FILTER_BUTTONS = new Set(["distressed deals"]);

function isOperacoesLegaisDepartment(department: string | null | undefined): boolean {
  if (!department?.trim()) return false;
  return OPERACOES_LEGAIS_DEPARTMENTS.has(normalizeDepartmentKey(department));
}

/** Resolve o rótulo do botão de área a partir do departamento bruto. */
export function resolveAreaFilterLabel(department: string | null | undefined): string | null {
  const trimmed = department?.trim();
  if (!trimmed) return null;
  if (HIDDEN_AREA_FILTER_BUTTONS.has(normalizeDepartmentKey(trimmed))) return null;
  if (isOperacoesLegaisDepartment(trimmed)) return AREA_FILTER_OPERACOES_LEGAIS;
  return trimmed;
}

/** Verifica se o departamento do colaborador cabe no filtro de área selecionado. */
export function departmentMatchesAreaFilter(
  department: string | null | undefined,
  areaFilter: string
): boolean {
  if (areaFilter === "all") return true;
  if (normalizeDepartmentKey(areaFilter) === normalizeDepartmentKey(AREA_FILTER_OPERACOES_LEGAIS)) {
    return isOperacoesLegaisDepartment(department);
  }
  return normalizeDepartmentKey(department ?? "") === normalizeDepartmentKey(areaFilter);
}

/** Classifica o saldo pela quantidade (não pelo prazo concessivo). */
export function classifyVacationBalanceSign(
  balance: Pick<EmployeeWithBalance["balance"], "pendingDays" | "unallocatedDays">
): Exclude<BalanceFilter, "all"> {
  if (balance.unallocatedDays > 0 || balance.pendingDays < 0) return "a_mais";
  if (balance.pendingDays > 0) return "a_tirar";
  return "zerado";
}

/** Filtra a lista da tela principal: situação, status do prazo, sinal do saldo e busca. */
export function filterEmployeesWithBalance(
  employees: EmployeeWithBalance[],
  filters: FeriasListFilters
): EmployeeWithBalance[] {
  const query = filters.search.trim().toLowerCase();
  const balanceFilter = filters.balance ?? "all";
  return employees.filter(({ employee, balance }) => {
    if (filters.situation === "ativos" && !employee.is_active) return false;
    if (filters.situation === "inativos" && employee.is_active) return false;
    if (filters.status !== "all" && balance.status !== filters.status) return false;
    if (balanceFilter !== "all" && classifyVacationBalanceSign(balance) !== balanceFilter) {
      return false;
    }
    if (!departmentMatchesAreaFilter(employee.department, filters.department)) return false;
    if (!query) return true;
    const haystack = `${employee.full_name} ${employee.department ?? ""} ${employee.position ?? ""}`;
    return haystack.toLowerCase().includes(query);
  });
}

/**
 * Áreas para os botões de filtro. Marketing/Financeiro/Facilities/RH
 * entram agrupados em "Operações Legais".
 */
export function listEmployeeDepartments(employees: EmployeeWithBalance[]): string[] {
  const set = new Set<string>();
  for (const { employee } of employees) {
    const label = resolveAreaFilterLabel(employee.department);
    if (label) set.add(label);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** KPIs só consideram colaboradores ativos — ex-funcionários não entram no alerta. */
export function computeFeriasKpis(employees: EmployeeWithBalance[]): FeriasKpis {
  const active = employees.filter((item) => item.employee.is_active);
  return {
    activeCount: active.length,
    pendingDays: active.reduce((sum, item) => sum + Math.max(0, item.balance.pendingDays), 0),
    overdue: active.filter((item) => item.balance.overdueDays > 0).length,
    // Inclui quem vence hoje: ainda não é "vencido" na CLT, mas o RH precisa agir.
    dueSoon: active.filter(
      (item) =>
        item.balance.overdueDays === 0 &&
        (item.balance.dueSoonDays > 0 || item.balance.dueTodayDays > 0)
    ).length,
    onLeave: active.filter((item) => item.balance.onLeaveNow).length,
  };
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Prefere avatar público; OneDrive fica como fallback quando a foto ainda não foi publicada. */
export function resolveEmployeeAvatarUrl(
  avatarUrl: string | null | undefined,
  photoOnedriveUrl?: string | null
): string | null {
  const primary = avatarUrl?.trim();
  if (primary) return primary;
  const fallback = photoOnedriveUrl?.trim();
  return fallback || null;
}

/**
 * Colaborador ativo que estava na empresa durante o intervalo do recesso.
 * Quem entrou depois do fim ou saiu antes do início não recebe o lançamento.
 */
export function employeeEligibleForRecess(
  employee: Pick<HrEmployee, "admission_date" | "termination_date" | "is_active">,
  recess: Pick<CompanyRecess, "start_date" | "end_date">
): boolean {
  if (!employee.is_active) return false;
  if (employee.admission_date > recess.end_date) return false;
  if (employee.termination_date && employee.termination_date < recess.start_date) {
    return false;
  }
  return true;
}

/** Intervalos inclusivos em ISO `YYYY-MM-DD`. */
export function dateRangesOverlap(
  a: Pick<CompanyRecess, "start_date" | "end_date">,
  b: Pick<CompanyRecess, "start_date" | "end_date">
): boolean {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

/**
 * Resume quantos ativos elegíveis já têm (ou ainda não) o lançamento do recesso.
 * `appliedEmployeeIds` deve incluir quem já tem recesso com intervalo sobreposto.
 */
export function summarizeRecessApplication(input: {
  activeEmployees: Array<
    Pick<HrEmployee, "id" | "admission_date" | "termination_date" | "is_active">
  >;
  recess: Pick<CompanyRecess, "start_date" | "end_date">;
  /** IDs com lançamento `recesso` que se sobrepõe ao calendário coletivo. */
  appliedEmployeeIds: Iterable<string>;
}): RecessApplicationSummary {
  const appliedSet = new Set(input.appliedEmployeeIds);
  const eligible = input.activeEmployees.filter((employee) =>
    employeeEligibleForRecess(employee, input.recess)
  );
  const applied = eligible.filter((employee) => appliedSet.has(employee.id)).length;
  const pending = eligible.length - applied;
  const ineligible = input.activeEmployees.length - eligible.length;

  let state: RecessApplyState;
  if (eligible.length === 0) state = "sem_elegiveis";
  else if (pending === 0) state = "aplicado";
  else if (applied === 0) state = "pendente";
  else state = "parcial";

  return {
    eligible: eligible.length,
    applied,
    pending,
    ineligible,
    state,
  };
}
