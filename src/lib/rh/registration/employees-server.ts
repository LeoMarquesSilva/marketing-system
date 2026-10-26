import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createRegistrationAdminClient, requireRegistrationManager, RhHttpError } from "./server";
import {
  PAYROLL_ACCOUNT_RH_SELECT,
  personalBankFromDeclared,
  PREFILL_QUALIFICATION_SELECT,
  prefillSelfAnswers,
  type PrefillPayrollAccount,
  type PrefillQualification,
} from "./self-prefill";
import {
  employeeFichaStatus,
  employmentTypeLabel,
  resolveRegistrationKind,
  type EmployeeRegistrationDetail,
  type EmployeeRegistrationRow,
  type PersonalBankAccount,
  type RegistrationAnswers,
  type RegistrationKind,
  type RegistrationOrigin,
  type RegistrationStatus,
} from "./types";
import { yearsSince } from "./people-filters";
import { normalizeRegistrationAnswers, OAB_KINDS, registrationProgress, resolveHasOab } from "./validation";

/**
 * Visão do RH sobre a ficha de cada colaborador: quem já enviou, o que falta e
 * o melhor dado conhecido (ficha enviada → qualificação → cadastro do VIOS).
 * Só para quem gerencia fichas (requireRegistrationManager).
 */

type EmployeeRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  employment_type: string | null;
  admission_date: string | null;
  is_active: boolean;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  gender: string | null;
  oab_number: string | null;
  oab_uf: string | null;
};

type FormRow = {
  id: string;
  employee_id: string;
  origin: RegistrationOrigin;
  employment_kind: RegistrationKind;
  status: RegistrationStatus;
  answers: unknown;
  reopen_note: string | null;
  submitted_at: string | null;
  approved_at: string | null;
};

export interface EmployeeRegistrationRecord {
  row: EmployeeRegistrationRow;
  answers: RegistrationAnswers;
  /** Conta particular declarada antes da conta da folha (só RH). */
  personalBank: PersonalBankAccount | null;
}

async function loadRecords(admin: SupabaseClient, employeeIds?: string[]): Promise<EmployeeRegistrationRecord[]> {
  if (employeeIds && employeeIds.length === 0) return [];
  let employeesQuery = admin
    .from("hr_employees")
    .select(
      "id, user_id, full_name, email, department, position, employment_type, admission_date, is_active, cpf, rg, birth_date, gender, oab_number, oab_uf"
    );
  if (employeeIds) employeesQuery = employeesQuery.in("id", employeeIds);
  const { data: employeeData, error: employeeError } = await employeesQuery;
  if (employeeError) throw new RhHttpError("Falha ao carregar os colaboradores.", 500, "QUERY_FAILED");
  const employees = (employeeData ?? []) as EmployeeRow[];
  if (employees.length === 0) return [];

  const ids = employees.map((employee) => employee.id);
  const userIds = employees.map((employee) => employee.user_id).filter((id): id is string => !!id);

  const [formsResult, qualificationsResult, usersResult, payrollResult] = await Promise.all([
    admin
      .from("hr_registration_forms")
      .select("id, employee_id, origin, employment_kind, status, answers, reopen_note, submitted_at, approved_at")
      .in("employee_id", ids)
      .neq("status", "cancelada"),
    userIds.length
      ? admin.from("hr_qualifications").select(`user_id, ${PREFILL_QUALIFICATION_SELECT}`).in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin.from("users").select("id, avatar_url").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from("hr_employee_bank_accounts").select(PAYROLL_ACCOUNT_RH_SELECT).in("employee_id", ids),
  ]);
  if (formsResult.error || qualificationsResult.error || payrollResult.error) {
    throw new RhHttpError("Falha ao carregar as fichas.", 500, "QUERY_FAILED");
  }
  const payrollByEmployee = new Map(
    ((payrollResult.data ?? []) as (PrefillPayrollAccount & { employee_id: string; previous_declared: unknown })[]).map((row) => [
      row.employee_id,
      row,
    ])
  );

  const formByEmployee = new Map(((formsResult.data ?? []) as FormRow[]).map((form) => [form.employee_id, form]));
  const qualificationByUser = new Map(
    ((qualificationsResult.data ?? []) as (PrefillQualification & { user_id: string })[]).map((row) => [row.user_id, row])
  );
  const avatarByUser = new Map(
    ((usersResult.data ?? []) as { id: string; avatar_url: string | null }[]).map((row) => [row.id, row.avatar_url])
  );

  return employees.map((employee) => {
    const form = formByEmployee.get(employee.id) ?? null;
    const qualification = employee.user_id ? qualificationByUser.get(employee.user_id) ?? null : null;
    const kind = resolveRegistrationKind(employee.employment_type, form?.employment_kind);
    const answers = normalizeRegistrationAnswers(
      prefillSelfAnswers(form?.answers ?? null, qualification, employee, payrollByEmployee.get(employee.id) ?? null),
      kind
    );
    const progress = registrationProgress(answers, kind);
    const row: EmployeeRegistrationRow = {
      employeeId: employee.id,
      fullName: employee.full_name,
      email: employee.email,
      avatarUrl: employee.user_id ? avatarByUser.get(employee.user_id) ?? null : null,
      department: employee.department,
      position: employee.position,
      employmentType: employee.employment_type,
      vinculoLabel: employmentTypeLabel(employee.employment_type, kind),
      kind,
      isActive: employee.is_active,
      admissionDate: employee.admission_date,
      formId: form?.id ?? null,
      formOrigin: form?.origin ?? null,
      status: employeeFichaStatus(form),
      submittedAt: form?.submitted_at ?? null,
      approvedAt: form?.approved_at ?? null,
      requiredCount: progress.required.length,
      filledCount: progress.filled,
      missingFields: progress.missing,
      gender: answers.gender,
      raceColor: answers.raceColor,
      age: yearsSince(answers.birthDate),
      residenceCity: answers.city,
      residenceState: answers.state,
      dietaryRestrictions: answers.dietaryRestrictions,
      oab: OAB_KINDS.has(kind) ? resolveHasOab(answers) : "na",
    };
    const payroll = payrollByEmployee.get(employee.id);
    const personalBank = payroll ? personalBankFromDeclared(payroll.previous_declared, payroll) : null;
    return { row, answers, personalBank };
  });
}

/** Todos os colaboradores (ativos e inativos) com a situação da ficha. */
export async function listEmployeeRegistrations(): Promise<EmployeeRegistrationRow[]> {
  await requireRegistrationManager();
  const records = await loadRecords(createRegistrationAdminClient());
  return records
    .map((record) => record.row)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
}

/** Ficha de um colaborador com o melhor dado conhecido (painel lateral do RH). */
export async function getEmployeeRegistration(employeeId: string): Promise<EmployeeRegistrationDetail> {
  await requireRegistrationManager();
  const [record] = await loadRecords(createRegistrationAdminClient(), [employeeId]);
  if (!record) throw new RhHttpError("Colaborador não encontrado.", 404, "NOT_FOUND");
  return record;
}

/** Dados completos para a planilha; `employeeIds` restringe ao que estava filtrado na tela. */
export async function loadEmployeeRegistrationsForExport(
  employeeIds?: string[]
): Promise<EmployeeRegistrationRecord[]> {
  await requireRegistrationManager();
  const records = await loadRecords(createRegistrationAdminClient(), employeeIds);
  return records.sort((a, b) => a.row.fullName.localeCompare(b.row.fullName, "pt-BR"));
}
