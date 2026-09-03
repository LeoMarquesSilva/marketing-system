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
  desatualizado: "Datas desatualizadas",
  sem_elegiveis: "Sem elegíveis",
};

export type RecessLeaveSyncAction = "insert" | "keep" | "update";

export function recessLeaveMatchesCalendar(
  leave: Pick<CompanyRecess, "start_date" | "end_date" | "days">,
  recess: Pick<CompanyRecess, "start_date" | "end_date" | "days">
): boolean {
  return (
    leave.start_date === recess.start_date &&
    leave.end_date === recess.end_date &&
    leave.days === recess.days
  );
}

export function classifyRecessLeaveSync(
  recess: Pick<CompanyRecess, "start_date" | "end_date" | "days">,
  existing: Pick<CompanyRecess, "start_date" | "end_date" | "days"> | null
): RecessLeaveSyncAction {
  if (!existing) return "insert";
  return recessLeaveMatchesCalendar(existing, recess) ? "keep" : "update";
}

export interface RecessLeaveSyncPlan {
  insertIds: string[];
  updateLeaveIds: string[];
  keepEmployeeIds: string[];
}

export function planRecessLeaveSync(input: {
  eligibleIds: string[];
  recess: Pick<CompanyRecess, "start_date" | "end_date" | "days">;
  existingLeaves: Array<{
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
    days: number;
  }>;
}): RecessLeaveSyncPlan {
  const leaveByEmployee = new Map<string, (typeof input.existingLeaves)[number]>();
  for (const leave of input.existingLeaves) {
    const current = leaveByEmployee.get(leave.employee_id);
    if (!current) {
      leaveByEmployee.set(leave.employee_id, leave);
      continue;
    }
    if (
      classifyRecessLeaveSync(input.recess, current) !== "keep" &&
      classifyRecessLeaveSync(input.recess, leave) === "keep"
    ) {
      leaveByEmployee.set(leave.employee_id, leave);
    }
  }

  const insertIds: string[] = [];
  const updateLeaveIds: string[] = [];
  const keepEmployeeIds: string[] = [];

  for (const employeeId of input.eligibleIds) {
    const existing = leaveByEmployee.get(employeeId) ?? null;
    const action = classifyRecessLeaveSync(input.recess, existing);
    if (action === "insert") insertIds.push(employeeId);
    else if (action === "keep") keepEmployeeIds.push(employeeId);
    else if (existing) updateLeaveIds.push(existing.id);
  }

  return { insertIds, updateLeaveIds, keepEmployeeIds };
}

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

/** Situação de gozo em relação a hoje, ortogonal ao saldo e ao prazo concessivo. */
export type ActivityFilter = "all" | "em_ferias" | "programada";

export const ACTIVITY_FILTER_LABEL: Record<ActivityFilter, string> = {
  all: "Todas",
  em_ferias: "Em férias",
  programada: "Férias programadas",
};

export type FeriasListTab = "colaboradores" | "recesso";

export interface FeriasListFilters {
  search: string;
  status: StatusFilter;
  situation: SituationFilter;
  /** Área do filtro em botões; `all` = sem filtro. */
  department: string;
  /** Sinal do saldo; `all` = sem filtro. */
  balance?: BalanceFilter;
  /** Em férias agora ou com férias já lançadas para o futuro; `all` = sem filtro. */
  activity?: ActivityFilter;
}

/** Filtros da listagem + aba, persistidos na query da URL. */
export interface FeriasListQuery extends Required<FeriasListFilters> {
  tab: FeriasListTab;
}

export const FERIAS_LIST_QUERY_DEFAULTS: FeriasListQuery = {
  search: "",
  status: "all",
  situation: "ativos",
  department: "all",
  balance: "all",
  activity: "all",
  tab: "colaboradores",
};

const STATUS_FILTER_VALUES = new Set<StatusFilter>([
  "all",
  "em_dia",
  "a_vencer",
  "vencido",
  "quitado",
]);
const SITUATION_FILTER_VALUES = new Set<SituationFilter>(["ativos", "inativos", "all"]);
const BALANCE_FILTER_VALUES = new Set<BalanceFilter>(["all", "a_tirar", "a_mais", "zerado"]);
const ACTIVITY_FILTER_VALUES = new Set<ActivityFilter>(["all", "em_ferias", "programada"]);
const TAB_VALUES = new Set<FeriasListTab>(["colaboradores", "recesso"]);

type QueryParamRecord = Record<string, string | string[] | undefined>;

function firstQueryValue(
  input: string | URLSearchParams | QueryParamRecord,
  key: string
): string {
  if (typeof input === "string" || input instanceof URLSearchParams) {
    return new URLSearchParams(input).get(key)?.trim() ?? "";
  }
  const raw = input[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ?? "";
}

function pickQueryValue<T extends string>(
  raw: string,
  allowed: Set<T>,
  fallback: T
): T {
  return allowed.has(raw as T) ? (raw as T) : fallback;
}

/** Lê filtros da query (`q`, `status`, `situacao`, `area`, `saldo`, `atividade`, `aba`). */
export function parseFeriasListQuery(
  input: string | URLSearchParams | QueryParamRecord
): FeriasListQuery {
  const department = firstQueryValue(input, "area");
  return {
    search: firstQueryValue(input, "q"),
    status: pickQueryValue(firstQueryValue(input, "status"), STATUS_FILTER_VALUES, "all"),
    situation: pickQueryValue(
      firstQueryValue(input, "situacao"),
      SITUATION_FILTER_VALUES,
      "ativos"
    ),
    department: department || "all",
    balance: pickQueryValue(firstQueryValue(input, "saldo"), BALANCE_FILTER_VALUES, "all"),
    activity: pickQueryValue(
      firstQueryValue(input, "atividade"),
      ACTIVITY_FILTER_VALUES,
      "all"
    ),
    tab: pickQueryValue(firstQueryValue(input, "aba"), TAB_VALUES, "colaboradores"),
  };
}

/** Grava só o que saiu do padrão, para a URL ficar compartilhavel e limpa. */
export function serializeFeriasListQuery(
  query: Partial<FeriasListQuery>
): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim() ?? "";
  if (search) params.set("q", search);
  if (query.status && query.status !== FERIAS_LIST_QUERY_DEFAULTS.status) {
    params.set("status", query.status);
  }
  if (query.situation && query.situation !== FERIAS_LIST_QUERY_DEFAULTS.situation) {
    params.set("situacao", query.situation);
  }
  if (query.department && query.department !== FERIAS_LIST_QUERY_DEFAULTS.department) {
    params.set("area", query.department);
  }
  if (query.balance && query.balance !== FERIAS_LIST_QUERY_DEFAULTS.balance) {
    params.set("saldo", query.balance);
  }
  if (query.activity && query.activity !== FERIAS_LIST_QUERY_DEFAULTS.activity) {
    params.set("atividade", query.activity);
  }
  if (query.tab && query.tab !== FERIAS_LIST_QUERY_DEFAULTS.tab) {
    params.set("aba", query.tab);
  }
  return params;
}

export function feriasListQueryToSearch(query: Partial<FeriasListQuery>): string {
  const serialized = serializeFeriasListQuery(query).toString();
  return serialized ? `?${serialized}` : "";
}

export interface FeriasKpis {
  pendingDays: number;
  overdue: number;
  dueSoon: number;
  onLeave: number;
  activeCount: number;
  /** Colaboradores ativos com férias/recesso/abono já lançados para o futuro. */
  scheduledCount: number;
  /** Soma dos dias já programados (ainda não descontados do saldo). */
  scheduledDays: number;
}

/** Rótulo canônico do agrupamento Operações Legais no filtro. */
export const AREA_FILTER_OPERACOES_LEGAIS = "Operações Legais";
export const AREA_FILTER_REESTRUTURACAO = "Reestruturação";
export const AREA_FILTER_SOCIETARIO_CONTRATOS = "Societário e Contratos";

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
 * (Marketing, Comercial, Financeiro, Facilities, Administrativo,
 * Recepção, Limpeza, RH + a própria área).
 */
const OPERACOES_LEGAIS_DEPARTMENTS = new Set([
  "operacoes legais",
  "marketing",
  "comercial", // legado; Marketing fica sob Operações Legais
  "financeiro",
  "facilities",
  "administrativo",
  "administracao",
  "recepcao",
  "limpeza",
  "rh",
  "r h",
  "recursos humanos",
]);

const REESTRUTURACAO_DEPARTMENTS = new Set(["insolvencia", "reestruturacao"]);

/** Legado: "Contratos" / "Societário e Contrato" → nomenclatura oficial atual. */
const SOCIETARIO_CONTRATOS_DEPARTMENTS = new Set([
  "contratos",
  "societario e contrato",
  "societario e contratos",
]);

/** Departamentos que não ganham botão próprio (continuam em "Todas as áreas"). */
const HIDDEN_AREA_FILTER_BUTTONS = new Set(["distressed deals"]);

/** Nome canônico exibido nas telas, filtros e buscas. */
export function resolveCanonicalAreaLabel(
  department: string | null | undefined
): string | null {
  const trimmed = department?.trim();
  if (!trimmed) return null;
  const key = normalizeDepartmentKey(trimmed);
  if (REESTRUTURACAO_DEPARTMENTS.has(key)) return AREA_FILTER_REESTRUTURACAO;
  if (SOCIETARIO_CONTRATOS_DEPARTMENTS.has(key)) return AREA_FILTER_SOCIETARIO_CONTRATOS;
  if (OPERACOES_LEGAIS_DEPARTMENTS.has(key)) return AREA_FILTER_OPERACOES_LEGAIS;
  return trimmed;
}

/** Resolve o rótulo do botão de área a partir do departamento bruto. */
export function resolveAreaFilterLabel(department: string | null | undefined): string | null {
  const trimmed = department?.trim();
  if (!trimmed) return null;
  if (HIDDEN_AREA_FILTER_BUTTONS.has(normalizeDepartmentKey(trimmed))) return null;
  return resolveCanonicalAreaLabel(trimmed);
}

/** Verifica se o departamento do colaborador cabe no filtro de área selecionado. */
export function departmentMatchesAreaFilter(
  department: string | null | undefined,
  areaFilter: string
): boolean {
  if (areaFilter === "all") return true;
  const canonicalDepartment = resolveCanonicalAreaLabel(department);
  const canonicalFilter = resolveCanonicalAreaLabel(areaFilter);
  return normalizeDepartmentKey(canonicalDepartment ?? "") === normalizeDepartmentKey(canonicalFilter ?? "");
}

/** Classifica o saldo pela quantidade (não pelo prazo concessivo). */
export function classifyVacationBalanceSign(
  balance: Pick<EmployeeWithBalance["balance"], "pendingDays" | "unallocatedDays">
): Exclude<BalanceFilter, "all"> {
  if (balance.unallocatedDays > 0 || balance.pendingDays < 0) return "a_mais";
  if (balance.pendingDays > 0) return "a_tirar";
  return "zerado";
}

/** Verifica se o colaborador cabe no filtro de atividade (em férias agora / com férias programadas). */
export function employeeMatchesActivityFilter(
  balance: Pick<EmployeeWithBalance["balance"], "onLeaveNow" | "scheduledDays">,
  activityFilter: ActivityFilter
): boolean {
  if (activityFilter === "em_ferias") return Boolean(balance.onLeaveNow);
  if (activityFilter === "programada") return balance.scheduledDays > 0;
  return true;
}

/** Filtra a lista da tela principal: situação, status do prazo, sinal do saldo e busca. */
export function filterEmployeesWithBalance(
  employees: EmployeeWithBalance[],
  filters: FeriasListFilters
): EmployeeWithBalance[] {
  const query = filters.search.trim().toLowerCase();
  const balanceFilter = filters.balance ?? "all";
  const activityFilter = filters.activity ?? "all";
  return employees.filter(({ employee, balance }) => {
    if (filters.situation === "ativos" && !employee.is_active) return false;
    if (filters.situation === "inativos" && employee.is_active) return false;
    if (filters.status !== "all" && balance.status !== filters.status) return false;
    if (balanceFilter !== "all" && classifyVacationBalanceSign(balance) !== balanceFilter) {
      return false;
    }
    if (!employeeMatchesActivityFilter(balance, activityFilter)) return false;
    if (!departmentMatchesAreaFilter(employee.department, filters.department)) return false;
    if (!query) return true;
    const haystack = `${employee.full_name} ${employee.department ?? ""} ${employee.position ?? ""}`;
    return haystack.toLowerCase().includes(query);
  });
}

/**
 * Áreas para os botões de filtro. Marketing/Financeiro/Facilities/Limpeza/RH
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
    scheduledCount: active.filter((item) => item.balance.scheduledDays > 0).length,
    scheduledDays: active.reduce((sum, item) => sum + item.balance.scheduledDays, 0),
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
 * `appliedEmployeeIds` são fichas com datas iguais ao calendário.
 * `outdatedEmployeeIds` são fichas com recesso sobreposto, mas datas/dias diferentes.
 */
export function summarizeRecessApplication(input: {
  activeEmployees: Array<
    Pick<HrEmployee, "id" | "admission_date" | "termination_date" | "is_active">
  >;
  recess: Pick<CompanyRecess, "start_date" | "end_date">;
  /** IDs com lançamento `recesso` igual ao calendário coletivo. */
  appliedEmployeeIds: Iterable<string>;
  /** IDs com recesso sobreposto que ainda não acompanhou a mudança do calendário. */
  outdatedEmployeeIds?: Iterable<string>;
}): RecessApplicationSummary {
  const appliedSet = new Set(input.appliedEmployeeIds);
  const outdatedSet = new Set(input.outdatedEmployeeIds ?? []);
  const eligible = input.activeEmployees.filter((employee) =>
    employeeEligibleForRecess(employee, input.recess)
  );
  const applied = eligible.filter((employee) => appliedSet.has(employee.id)).length;
  const outdated = eligible.filter(
    (employee) => !appliedSet.has(employee.id) && outdatedSet.has(employee.id)
  ).length;
  const pending = eligible.length - applied - outdated;
  const ineligible = input.activeEmployees.length - eligible.length;

  let state: RecessApplyState;
  if (eligible.length === 0) state = "sem_elegiveis";
  else if (pending === 0 && outdated === 0) state = "aplicado";
  else if (outdated > 0 && pending === 0) state = "desatualizado";
  else if (applied === 0 && outdated === 0) state = "pendente";
  else state = "parcial";

  return {
    eligible: eligible.length,
    applied,
    outdated,
    pending,
    ineligible,
    state,
  };
}
