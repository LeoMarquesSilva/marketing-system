import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { computeEmployeeBalance, generateAccrualPeriods, todayISO } from "@/lib/ferias/balance";
import { FeriasHttpError } from "@/lib/ferias/errors";
import {
  employeeEligibleForRecess,
  resolveEmployeeAvatarUrl,
  summarizeRecessApplication,
} from "@/lib/ferias/filters";
import {
  employeeMatchesFeriasAccess,
  isFeriasEditor,
  redactFeriasEmployee,
  resolveFeriasAccess,
  type FeriasAccess,
  type FeriasAccessMode,
} from "@/lib/ferias/access";
import type {
  CompanyRecess,
  CompanyRecessWithStatus,
  EmployeeDetail,
  EmployeeWithBalance,
  HrEmployee,
  LinkableUser,
  VacationLeave,
  VacationPeriod,
  ViosMissingEmployee,
  ViosSyncAlerts,
  ViosUnmatchedEmployee,
} from "@/lib/ferias/types";
import type {
  EmployeeCreateInput,
  EmployeeUpdateInput,
  LeaveCreateInput,
  LeaveUpdateInput,
  PeriodUpdateInput,
  RecessCreateInput,
} from "@/lib/ferias/validation";
export { FeriasHttpError, toApiError } from "@/lib/ferias/errors";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const EMPLOYEE_SELECT =
  "id, user_id, full_name, cpf, email, department, position, admission_date, termination_date, is_active, notes, vios_ci, vacation_exempt";
const VIOS_SELECT =
  "ci, company, department, full_name, position, email, situation, is_active, matched_employee_id, synced_at";
const PERIOD_SELECT =
  "id, employee_id, period_start, period_end, entitled_days, concessive_start, concessive_end, notes";
const LEAVE_SELECT = "id, employee_id, start_date, end_date, days, kind, notes";
const RECESS_SELECT = "id, year, start_date, end_date, days, notes";

type EmployeeRow = Omit<HrEmployee, "avatar_url">;

export interface FeriasActor {
  authUserId: string;
  profileId: string;
  role: string | null;
  name: string;
  access: FeriasAccess;
}

function createFeriasAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new FeriasHttpError(
      "SUPABASE_SERVICE_ROLE_KEY não configurada.",
      503,
      "SERVICE_UNAVAILABLE"
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Autoriza RH editor ou viewer de área; o escopo sempre é recalculado no servidor. */
export async function requireFeriasAccess(): Promise<FeriasActor> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new FeriasHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const admin = createFeriasAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, name, role, permissions, ferias_access_mode, ferias_area_scope")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error) {
    throw new FeriasHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  }

  const role = (data?.role as string | null | undefined) ?? null;
  const permissions = (data?.permissions as string[] | null | undefined) ?? [];
  if (!data) {
    throw new FeriasHttpError("Você não tem acesso ao módulo de Férias.", 403, "FORBIDDEN");
  }

  const { data: employee, error: employeeError } = await admin
    .from("hr_employees")
    .select("position, department")
    .eq("user_id", data.id)
    .maybeSingle();
  if (employeeError) {
    throw new FeriasHttpError("Não foi possível validar sua área.", 500, "ACCESS_LOOKUP_FAILED");
  }

  const access = resolveFeriasAccess({
    role,
    permissions,
    accessMode: data.ferias_access_mode as FeriasAccessMode | null,
    areaScope: data.ferias_area_scope as string[] | null,
    position: employee?.position as string | null | undefined,
    department: employee?.department as string | null | undefined,
  });
  if (access.level === "denied") {
    throw new FeriasHttpError("Você não tem acesso ao módulo de Férias.", 403, "FORBIDDEN");
  }

  return {
    authUserId: user.id,
    profileId: data.id as string,
    role: (data.role as string | null) ?? null,
    name: data.name as string,
    access,
  };
}

/** Mantido como guard explícito para todas as mutações. */
export async function requireFeriasManager(): Promise<FeriasActor> {
  const actor = await requireFeriasAccess();
  if (!isFeriasEditor(actor.access)) {
    throw new FeriasHttpError(
      "Seu acesso ao módulo de Férias é somente leitura.",
      403,
      "READ_ONLY"
    );
  }
  return actor;
}

export async function hasFeriasAccess(): Promise<boolean> {
  try {
    await requireFeriasAccess();
    return true;
  } catch {
    return false;
  }
}

function failed(message: string): never {
  throw new FeriasHttpError(message, 500, "QUERY_FAILED");
}

/**
 * Cria os períodos aquisitivos que faltam para o colaborador. É idempotente:
 * períodos já existentes (inclusive ajustados manualmente) não são tocados.
 */
async function syncEmployeePeriods(
  admin: SupabaseClient,
  employeeId: string,
  admissionDate: string,
  referenceDate: string = todayISO()
): Promise<void> {
  const generated = generateAccrualPeriods(admissionDate, referenceDate);
  if (generated.length === 0) return;

  const { error } = await admin.from("vacation_periods").upsert(
    generated.map((period) => ({ employee_id: employeeId, ...period })),
    { onConflict: "employee_id,period_start", ignoreDuplicates: true }
  );
  if (error) failed("Não foi possível gerar os períodos aquisitivos.");
}

interface FeriasDataset {
  employees: HrEmployee[];
  periods: VacationPeriod[];
  leaves: VacationLeave[];
}

async function attachAvatars(
  admin: SupabaseClient,
  rows: EmployeeRow[]
): Promise<HrEmployee[]> {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))] as string[];
  const avatarByUser = new Map<string, string | null>();

  if (userIds.length > 0) {
    const { data, error } = await admin
      .from("users")
      .select("id, avatar_url, photo_onedrive_url")
      .in("id", userIds);
    if (error) failed("Não foi possível carregar as fotos dos colaboradores.");
    for (const user of data ?? []) {
      avatarByUser.set(
        user.id as string,
        resolveEmployeeAvatarUrl(
          user.avatar_url as string | null,
          user.photo_onedrive_url as string | null
        )
      );
    }
  }

  return rows.map((row) => ({
    ...row,
    avatar_url: row.user_id ? (avatarByUser.get(row.user_id) ?? null) : null,
  }));
}

async function loadDataset(
  admin: SupabaseClient,
  access: FeriasAccess,
  employeeId?: string,
  referenceDate: string = todayISO()
): Promise<FeriasDataset> {
  let employeeQuery = admin.from("hr_employees").select(EMPLOYEE_SELECT).order("full_name");
  if (employeeId) {
    employeeQuery = employeeQuery.eq("id", employeeId);
  } else {
    // Sócios fundadores e demais isentos ficam fora do controle de férias.
    employeeQuery = employeeQuery.eq("vacation_exempt", false);
  }

  const employeesResult = await employeeQuery;
  if (employeesResult.error) failed("Não foi possível carregar os dados de férias.");

  const employeeRows = ((employeesResult.data ?? []) as EmployeeRow[]).filter((row) =>
    employeeMatchesFeriasAccess(row.department, access)
  );

  // Uma leitura parcial não provoca escrita. O RH editor continua garantindo
  // períodos novos após o aniversário de admissão.
  if (isFeriasEditor(access)) {
    await Promise.all(
      employeeRows.map((row) =>
        syncEmployeePeriods(admin, row.id, row.admission_date, referenceDate)
      )
    );
  }

  const employeeIds = employeeRows.map((row) => row.id);
  if (employeeIds.length === 0) {
    return { employees: [], periods: [], leaves: [] };
  }

  const periodQuery = admin
    .from("vacation_periods")
    .select(PERIOD_SELECT)
    .in("employee_id", employeeIds)
    .order("period_start");
  const leaveQuery = admin
    .from("vacation_leaves")
    .select(LEAVE_SELECT)
    .in("employee_id", employeeIds)
    .order("start_date");

  const [periods, leaves] = await Promise.all([periodQuery, leaveQuery]);
  if (periods.error || leaves.error) {
    failed("Não foi possível carregar os dados de férias.");
  }

  const employeesWithAvatars = await attachAvatars(admin, employeeRows);
  const employees = employeesWithAvatars.map((employee) =>
    redactFeriasEmployee(employee, access)
  );

  return {
    employees,
    periods: (periods.data ?? []) as VacationPeriod[],
    leaves: (leaves.data ?? []) as VacationLeave[],
  };
}

function buildBalances(
  dataset: FeriasDataset,
  referenceDate: string
): EmployeeWithBalance[] {
  return dataset.employees.map((employee) => ({
    employee,
    balance: computeEmployeeBalance({
      admissionDate: employee.admission_date,
      periods: dataset.periods.filter((period) => period.employee_id === employee.id),
      leaves: dataset.leaves.filter((leave) => leave.employee_id === employee.id),
      referenceDate,
    }),
  }));
}

export async function listEmployeesWithBalance(
  referenceDate: string = todayISO(),
  actor?: FeriasActor
): Promise<EmployeeWithBalance[]> {
  const currentActor = actor ?? (await requireFeriasAccess());
  const admin = createFeriasAdminClient();
  const dataset = await loadDataset(admin, currentActor.access, undefined, referenceDate);
  return buildBalances(dataset, referenceDate);
}

export async function fetchEmployeeDetail(
  employeeId: string,
  referenceDate: string = todayISO(),
  actor?: FeriasActor
): Promise<EmployeeDetail | null> {
  const currentActor = actor ?? (await requireFeriasAccess());
  const admin = createFeriasAdminClient();
  const dataset = await loadDataset(admin, currentActor.access, employeeId, referenceDate);
  const [result] = buildBalances(dataset, referenceDate);
  if (!result) return null;
  return { ...result, leaves: dataset.leaves };
}

export async function createEmployee(input: EmployeeCreateInput): Promise<HrEmployee> {
  const manager = await requireFeriasManager();
  const admin = createFeriasAdminClient();

  const { data, error } = await admin
    .from("hr_employees")
    .insert({
      user_id: input.userId ?? null,
      full_name: input.fullName,
      cpf: input.cpf ?? null,
      email: input.email ?? null,
      department: input.department ?? null,
      position: input.position ?? null,
      admission_date: input.admissionDate,
      termination_date: input.terminationDate ?? null,
      is_active: input.isActive ?? true,
      notes: input.notes ?? null,
      created_by: manager.profileId,
    })
    .select(EMPLOYEE_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new FeriasHttpError("Já existe um colaborador com este CPF.", 409, "DUPLICATE_CPF");
    }
    failed("Não foi possível cadastrar o colaborador.");
  }

  await syncEmployeePeriods(admin, data.id as string, data.admission_date as string);
  // Se já houver espelho VIOS com o mesmo e-mail, vincula e aplica Situação.
  await admin.rpc("sync_hr_employees_from_vios");

  const { data: refreshed, error: refreshError } = await admin
    .from("hr_employees")
    .select(EMPLOYEE_SELECT)
    .eq("id", data.id)
    .single();
  if (refreshError || !refreshed) {
    const [employee] = await attachAvatars(admin, [data as EmployeeRow]);
    return employee;
  }
  const [employee] = await attachAvatars(admin, [refreshed as EmployeeRow]);
  return employee;
}

export async function updateEmployee(
  employeeId: string,
  input: EmployeeUpdateInput
): Promise<HrEmployee> {
  await requireFeriasManager();
  const admin = createFeriasAdminClient();

  const payload: Record<string, unknown> = {};
  if (input.fullName !== undefined) payload.full_name = input.fullName;
  if (input.cpf !== undefined) payload.cpf = input.cpf;
  if (input.email !== undefined) payload.email = input.email;
  if (input.department !== undefined) payload.department = input.department;
  if (input.position !== undefined) payload.position = input.position;
  if (input.admissionDate !== undefined) payload.admission_date = input.admissionDate;
  if (input.terminationDate !== undefined) payload.termination_date = input.terminationDate;
  if (input.userId !== undefined) payload.user_id = input.userId;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.notes !== undefined) payload.notes = input.notes;

  const { data, error } = await admin
    .from("hr_employees")
    .update(payload)
    .eq("id", employeeId)
    .select(EMPLOYEE_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new FeriasHttpError("Já existe um colaborador com este CPF.", 409, "DUPLICATE_CPF");
    }
    failed("Não foi possível atualizar o colaborador.");
  }
  if (!data) throw new FeriasHttpError("Colaborador não encontrado.", 404, "NOT_FOUND");

  const [employee] = await attachAvatars(admin, [data as EmployeeRow]);
  if (input.admissionDate !== undefined) {
    // A admissão define a régua dos períodos: refaz a partir da nova data.
    const { error: deleteError } = await admin
      .from("vacation_periods")
      .delete()
      .eq("employee_id", employeeId);
    if (deleteError) failed("Não foi possível recalcular os períodos aquisitivos.");
  }
  await syncEmployeePeriods(admin, employee.id, employee.admission_date);
  return employee;
}

async function assertEmployeeExists(admin: SupabaseClient, employeeId: string): Promise<void> {
  const { data, error } = await admin
    .from("hr_employees")
    .select("id, admission_date")
    .eq("id", employeeId)
    .maybeSingle();
  if (error) failed("Não foi possível validar o colaborador.");
  if (!data) throw new FeriasHttpError("Colaborador não encontrado.", 404, "NOT_FOUND");
  await syncEmployeePeriods(admin, employeeId, data.admission_date as string);
}

export async function createLeave(input: LeaveCreateInput): Promise<VacationLeave> {
  const manager = await requireFeriasManager();
  const admin = createFeriasAdminClient();
  await assertEmployeeExists(admin, input.employeeId);

  const { data, error } = await admin
    .from("vacation_leaves")
    .insert({
      employee_id: input.employeeId,
      start_date: input.startDate,
      end_date: input.endDate,
      days: input.days,
      kind: input.kind,
      notes: input.notes ?? null,
      created_by: manager.profileId,
    })
    .select(LEAVE_SELECT)
    .single();

  if (error) failed("Não foi possível registrar as férias.");
  return data as VacationLeave;
}

export async function updateLeave(
  leaveId: string,
  input: LeaveUpdateInput
): Promise<VacationLeave> {
  await requireFeriasManager();
  const admin = createFeriasAdminClient();

  const payload: Record<string, unknown> = {};
  if (input.startDate !== undefined) payload.start_date = input.startDate;
  if (input.endDate !== undefined) payload.end_date = input.endDate;
  if (input.days !== undefined) payload.days = input.days;
  if (input.kind !== undefined) payload.kind = input.kind;
  if (input.notes !== undefined) payload.notes = input.notes;

  const { data, error } = await admin
    .from("vacation_leaves")
    .update(payload)
    .eq("id", leaveId)
    .select(LEAVE_SELECT)
    .maybeSingle();

  if (error) failed("Não foi possível atualizar o lançamento.");
  if (!data) throw new FeriasHttpError("Lançamento não encontrado.", 404, "NOT_FOUND");
  return data as VacationLeave;
}

export async function deleteLeave(leaveId: string): Promise<void> {
  await requireFeriasManager();
  const admin = createFeriasAdminClient();
  const { error } = await admin.from("vacation_leaves").delete().eq("id", leaveId);
  if (error) failed("Não foi possível excluir o lançamento.");
}

export async function listRecess(actor?: FeriasActor): Promise<CompanyRecess[]> {
  if (!actor) await requireFeriasAccess();
  const admin = createFeriasAdminClient();
  const { data, error } = await admin
    .from("company_recess")
    .select(RECESS_SELECT)
    .order("year", { ascending: false });
  if (error) failed("Não foi possível carregar o recesso coletivo.");
  return (data ?? []) as CompanyRecess[];
}

/**
 * Lista recessos com resumo de quem já recebeu o lançamento entre os ativos.
 */
export async function listRecessWithApplicationStatus(
  actor?: FeriasActor
): Promise<CompanyRecessWithStatus[]> {
  const currentActor = actor ?? (await requireFeriasAccess());
  const admin = createFeriasAdminClient();

  const [recessResult, employeesResult] = await Promise.all([
    admin.from("company_recess").select(RECESS_SELECT).order("year", { ascending: false }),
    admin
      .from("hr_employees")
      .select("id, department, admission_date, termination_date, is_active")
      .eq("is_active", true)
      .eq("vacation_exempt", false),
  ]);

  if (recessResult.error) failed("Não foi possível carregar o recesso coletivo.");
  if (employeesResult.error) failed("Não foi possível carregar os colaboradores.");

  const recesses = (recessResult.data ?? []) as CompanyRecess[];
  const activeEmployees = ((employeesResult.data ?? []) as Array<{
    id: string;
    department: string | null;
    admission_date: string;
    termination_date: string | null;
    is_active: boolean;
  }>).filter((employee) =>
    employeeMatchesFeriasAccess(employee.department, currentActor.access)
  );

  if (recesses.length === 0) return [];

  // Recesso já lançado se o intervalo se sobrepõe ao calendário coletivo
  // (não só match exato — evita duplicar quem voltou 1 dia antes, etc.).
  const leaveResults = await Promise.all(
    recesses.map((recess) =>
      admin
        .from("vacation_leaves")
        .select("employee_id")
        .eq("kind", "recesso")
        .lte("start_date", recess.end_date)
        .gte("end_date", recess.start_date)
    )
  );

  return recesses.map((recess, index) => {
    const leaveResult = leaveResults[index];
    if (leaveResult.error) failed("Não foi possível verificar lançamentos de recesso.");
    const scopedEmployeeIds = new Set(activeEmployees.map((employee) => employee.id));
    const appliedEmployeeIds = (leaveResult.data ?? [])
      .map((row) => row.employee_id as string)
      .filter((employeeId) => scopedEmployeeIds.has(employeeId));
    return {
      ...recess,
      application: summarizeRecessApplication({
        activeEmployees,
        recess,
        appliedEmployeeIds,
      }),
    };
  });
}

export async function upsertRecess(input: RecessCreateInput): Promise<CompanyRecess> {
  await requireFeriasManager();
  const admin = createFeriasAdminClient();
  const { data, error } = await admin
    .from("company_recess")
    .upsert(
      {
        year: input.year,
        start_date: input.startDate,
        end_date: input.endDate,
        days: input.days,
        notes: input.notes ?? null,
      },
      { onConflict: "year" }
    )
    .select(RECESS_SELECT)
    .single();
  if (error) failed("Não foi possível salvar o recesso coletivo.");
  return data as CompanyRecess;
}

export async function deleteRecess(recessId: string): Promise<void> {
  await requireFeriasManager();
  const admin = createFeriasAdminClient();
  const { error } = await admin.from("company_recess").delete().eq("id", recessId);
  if (error) failed("Não foi possível excluir o recesso coletivo.");
}

export interface ApplyRecessResult {
  applied: number;
  skippedExisting: number;
  skippedIneligible: number;
}

/**
 * Gera lançamento `recesso` para cada colaborador ativo elegível.
 * Idempotente: não duplica quem já tem recesso com intervalo sobreposto.
 */
export async function applyRecessToActiveEmployees(
  recessId: string
): Promise<ApplyRecessResult> {
  const manager = await requireFeriasManager();
  const admin = createFeriasAdminClient();

  const { data: recess, error: recessError } = await admin
    .from("company_recess")
    .select(RECESS_SELECT)
    .eq("id", recessId)
    .maybeSingle();
  if (recessError) failed("Não foi possível carregar o recesso coletivo.");
  if (!recess) throw new FeriasHttpError("Recesso não encontrado.", 404, "NOT_FOUND");

  const recessRow = recess as CompanyRecess;

  const { data: employees, error: employeesError } = await admin
    .from("hr_employees")
    .select("id, full_name, admission_date, termination_date, is_active")
    .eq("is_active", true)
    .eq("vacation_exempt", false);
  if (employeesError) failed("Não foi possível carregar os colaboradores.");

  const activeRows = (employees ?? []) as Array<{
    id: string;
    full_name: string;
    admission_date: string;
    termination_date: string | null;
    is_active: boolean;
  }>;

  const eligible = activeRows.filter((row) =>
    employeeEligibleForRecess(row, recessRow)
  );
  const skippedIneligible = activeRows.length - eligible.length;

  if (eligible.length === 0) {
    return { applied: 0, skippedExisting: 0, skippedIneligible };
  }

  const eligibleIds = eligible.map((row) => row.id);
  const { data: existingLeaves, error: leavesError } = await admin
    .from("vacation_leaves")
    .select("employee_id, start_date, end_date, kind")
    .in("employee_id", eligibleIds)
    .eq("kind", "recesso")
    .lte("start_date", recessRow.end_date)
    .gte("end_date", recessRow.start_date);
  if (leavesError) failed("Não foi possível verificar lançamentos existentes.");

  const alreadyApplied = new Set(
    (existingLeaves ?? []).map((leave) => leave.employee_id as string)
  );

  const toInsert = eligible.filter((row) => !alreadyApplied.has(row.id));
  const skippedExisting = eligible.length - toInsert.length;

  if (toInsert.length > 0) {
    const note = `Recesso coletivo ${recessRow.year}`;
    const { error: insertError } = await admin.from("vacation_leaves").insert(
      toInsert.map((row) => ({
        employee_id: row.id,
        start_date: recessRow.start_date,
        end_date: recessRow.end_date,
        days: recessRow.days,
        kind: "recesso" as const,
        notes: note,
        created_by: manager.profileId,
      }))
    );
    if (insertError) failed("Não foi possível aplicar o recesso aos colaboradores.");

    await Promise.all(
      toInsert.map((row) =>
        syncEmployeePeriods(admin, row.id, row.admission_date)
      )
    );
  }

  return {
    applied: toInsert.length,
    skippedExisting,
    skippedIneligible,
  };
}

export async function updatePeriod(
  periodId: string,
  input: PeriodUpdateInput
): Promise<VacationPeriod> {
  await requireFeriasManager();
  const admin = createFeriasAdminClient();

  const payload: Record<string, unknown> = {};
  if (input.entitledDays !== undefined) payload.entitled_days = input.entitledDays;
  if (input.notes !== undefined) payload.notes = input.notes;

  if (Object.keys(payload).length === 0) {
    throw new FeriasHttpError("Nenhum campo para atualizar.", 400, "INVALID_INPUT");
  }

  const { data, error } = await admin
    .from("vacation_periods")
    .update(payload)
    .eq("id", periodId)
    .select(PERIOD_SELECT)
    .maybeSingle();

  if (error) failed("Não foi possível atualizar o período aquisitivo.");
  if (!data) throw new FeriasHttpError("Período não encontrado.", 404, "NOT_FOUND");
  return data as VacationPeriod;
}

/** TI não entra no módulo de férias — são usuários do sistema, não colaboradores RH. */
function isItDepartment(department: string | null | undefined): boolean {
  const normalized = (department ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  return normalized === "t.i" || normalized === "ti" || normalized === "tecnologia" || normalized === "tecnologiainformacao";
}

export async function listLinkableUsers(): Promise<LinkableUser[]> {
  await requireFeriasManager();
  const admin = createFeriasAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, name, email, department, avatar_url")
    .eq("is_active", true)
    .order("name");
  if (error) failed("Não foi possível carregar os usuários.");
  return ((data ?? []) as LinkableUser[]).filter((user) => !isItDepartment(user.department));
}

type ViosRow = {
  ci: string;
  company: string | null;
  department: string | null;
  full_name: string;
  position: string | null;
  email: string | null;
  situation: string | null;
  is_active: boolean;
  matched_employee_id: string | null;
  synced_at: string;
};

/**
 * Alertas do último sync VIOS:
 * - unmatched: vieram no export e ainda não têm cadastro em hr_employees
 * - missingFromExport: cadastrados (ativos) que não apareceram no export
 */
export async function listViosSyncAlerts(): Promise<ViosSyncAlerts> {
  await requireFeriasManager();
  const admin = createFeriasAdminClient();

  const [viosResult, employeesResult] = await Promise.all([
    admin.from("hr_vios_employees").select(VIOS_SELECT).order("full_name"),
    admin
      .from("hr_employees")
      .select("id, full_name, email, department, is_active, vios_ci")
      .eq("is_active", true)
      .eq("vacation_exempt", false)
      .order("full_name"),
  ]);

  if (viosResult.error || employeesResult.error) {
    failed("Não foi possível carregar os alertas do sync VIOS.");
  }

  const viosRows = (viosResult.data ?? []) as ViosRow[];
  const employees = (employeesResult.data ?? []) as ViosMissingEmployee[];

  // Sem export ainda: não alertar "ausentes" (evita ruído antes do primeiro sync).
  if (viosRows.length === 0) {
    return { unmatched: [], missingFromExport: [], lastSyncedAt: null };
  }

  const unmatched: ViosUnmatchedEmployee[] = viosRows
    .filter((row) => !row.matched_employee_id)
    .map((row) => ({
      ci: row.ci,
      full_name: row.full_name,
      email: row.email,
      department: row.department,
      position: row.position,
      situation: row.situation,
      is_active: row.is_active,
      company: row.company,
    }));

  const matchedIds = new Set(
    viosRows
      .map((row) => row.matched_employee_id)
      .filter((id): id is string => Boolean(id))
  );

  const missingFromExport: ViosMissingEmployee[] = employees.filter((employee) => {
    if (matchedIds.has(employee.id)) return false;
    // Sem e-mail e sem CI: não dá para cruzar com o VIOS — não alerta.
    if (!employee.email && !employee.vios_ci) return false;
    return true;
  });

  const lastSyncedAt =
    viosRows.reduce<string | null>((latest, row) => {
      if (!latest || row.synced_at > latest) return row.synced_at;
      return latest;
    }, null) ?? null;

  return { unmatched, missingFromExport, lastSyncedAt };
}
