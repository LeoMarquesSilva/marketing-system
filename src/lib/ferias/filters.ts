import type {
  CompanyRecess,
  EmployeeWithBalance,
  HrEmployee,
  VacationPeriodStatus,
} from "@/lib/ferias/types";

export type SituationFilter = "ativos" | "inativos" | "all";
export type StatusFilter = "all" | VacationPeriodStatus;

export interface FeriasListFilters {
  search: string;
  status: StatusFilter;
  situation: SituationFilter;
}

export interface FeriasKpis {
  pendingDays: number;
  overdue: number;
  dueSoon: number;
  onLeave: number;
  activeCount: number;
}

/** Filtra a lista da tela principal: situação, status do saldo e busca textual. */
export function filterEmployeesWithBalance(
  employees: EmployeeWithBalance[],
  filters: FeriasListFilters
): EmployeeWithBalance[] {
  const query = filters.search.trim().toLowerCase();
  return employees.filter(({ employee, balance }) => {
    if (filters.situation === "ativos" && !employee.is_active) return false;
    if (filters.situation === "inativos" && employee.is_active) return false;
    if (filters.status !== "all" && balance.status !== filters.status) return false;
    if (!query) return true;
    const haystack = `${employee.full_name} ${employee.department ?? ""} ${employee.position ?? ""}`;
    return haystack.toLowerCase().includes(query);
  });
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
