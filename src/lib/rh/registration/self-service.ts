import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import {
  createRegistrationAdminClient,
  getClientIp,
  hashIp,
  RegistrationValidationError,
  RhHttpError,
} from "./server";
import {
  PREFILL_QUALIFICATION_SELECT,
  prefillSelfAnswers,
  type PrefillEmployee,
  type PrefillQualification,
} from "./self-prefill";
import {
  employmentTypeLabel,
  resolveRegistrationKind,
  type RegistrationAnswers,
  type RegistrationKind,
  type RegistrationStatus,
} from "./types";
import { normalizeRegistrationAnswers, validateRegistrationAnswers } from "./validation";

/**
 * Atualização da ficha cadastral pelo próprio colaborador, com login. A sessão
 * identifica a pessoa (users.auth_id → hr_employees.user_id); do cliente só vêm
 * as respostas. O envio cai na revisão da RH como "recebida".
 */

type EmployeeRow = PrefillEmployee & {
  id: string;
  user_id: string;
  employment_type: string | null;
  is_active: boolean;
};

type SelfFormRow = {
  id: string;
  employment_kind: RegistrationKind;
  status: RegistrationStatus;
  answers: unknown;
  reopen_note: string | null;
  submitted_at: string | null;
  approved_at: string | null;
};

interface SelfContext {
  profileId: string;
  employee: EmployeeRow;
  form: SelfFormRow | null;
}

async function loadSelfContext(admin: SupabaseClient): Promise<SelfContext | null> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new RhHttpError("Faça login para ver sua ficha.", 401, "UNAUTHENTICATED");

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, is_active")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    throw new RhHttpError("Não foi possível identificar seu usuário.", 500, "ACCESS_LOOKUP_FAILED");
  }
  if (profile.is_active === false) throw new RhHttpError("Usuário inativo.", 403, "FORBIDDEN");

  // Pode haver cadastro antigo inativo; vale o ativo mais recente.
  const { data: employees, error: employeeError } = await admin
    .from("hr_employees")
    .select("id, user_id, full_name, cpf, rg, birth_date, gender, employment_type, oab_number, oab_uf, is_active")
    .eq("user_id", profile.id as string)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);
  if (employeeError) throw new RhHttpError("Falha ao carregar seu cadastro.", 500, "QUERY_FAILED");
  const employee = (employees?.[0] as EmployeeRow | undefined) ?? null;
  if (!employee || !employee.is_active) return null;

  // Índice único garante no máximo uma ficha não cancelada por colaborador.
  const { data: form, error: formError } = await admin
    .from("hr_registration_forms")
    .select("id, employment_kind, status, answers, reopen_note, submitted_at, approved_at")
    .eq("employee_id", employee.id)
    .neq("status", "cancelada")
    .maybeSingle();
  if (formError) throw new RhHttpError("Falha ao carregar sua ficha.", 500, "QUERY_FAILED");

  return { profileId: profile.id as string, employee, form: (form as SelfFormRow | null) ?? null };
}

function resolveKind(employee: EmployeeRow, form: SelfFormRow | null): RegistrationKind {
  return resolveRegistrationKind(employee.employment_type, form?.employment_kind);
}

export type SelfRegistrationState =
  | { state: "no_employee" }
  | {
      state: "ready";
      employeeName: string;
      kind: RegistrationKind;
      /** Vínculo como o VIOS chama ("Sócio cotista"), para o título da ficha. */
      vinculoLabel: string;
      answers: RegistrationAnswers;
      form: {
        status: RegistrationStatus;
        submittedAt: string | null;
        approvedAt: string | null;
        reopenNote: string | null;
      } | null;
    };

export async function getSelfRegistration(): Promise<SelfRegistrationState> {
  const admin = createRegistrationAdminClient();
  const context = await loadSelfContext(admin);
  if (!context) return { state: "no_employee" };
  const { employee, form } = context;

  const { data: qualification } = await admin
    .from("hr_qualifications")
    .select(PREFILL_QUALIFICATION_SELECT)
    .eq("user_id", employee.user_id)
    .maybeSingle();

  const kind = resolveKind(employee, form);
  const answers = normalizeRegistrationAnswers(
    prefillSelfAnswers(form?.answers ?? null, (qualification as PrefillQualification | null) ?? null, employee),
    kind
  );

  return {
    state: "ready",
    employeeName: employee.full_name,
    kind,
    vinculoLabel: employmentTypeLabel(employee.employment_type, kind),
    answers,
    form: form
      ? {
          status: form.status,
          submittedAt: form.submitted_at,
          approvedAt: form.approved_at,
          reopenNote: form.status === "pendente" ? form.reopen_note : null,
        }
      : null,
  };
}

export async function submitSelfRegistration(body: unknown, request: Request): Promise<void> {
  const admin = createRegistrationAdminClient();
  const context = await loadSelfContext(admin);
  if (!context) {
    throw new RhHttpError(
      "Não encontramos seu cadastro de colaborador ativo. Fale com Pessoas e Cultura.",
      404,
      "NO_EMPLOYEE"
    );
  }
  const { employee, form, profileId } = context;

  const payload = (body ?? {}) as { answers?: unknown; consent?: unknown };
  if (payload.consent !== true) {
    throw new RhHttpError("Confirme a declaração para enviar.", 422, "CONSENT_REQUIRED");
  }
  const kind = resolveKind(employee, form);
  const answers = normalizeRegistrationAnswers(payload.answers, kind);
  const fieldErrors = validateRegistrationAnswers(answers, kind);
  if (Object.keys(fieldErrors).length > 0) throw new RegistrationValidationError(fieldErrors);

  const now = new Date().toISOString();
  const submission = {
    answers,
    employment_kind: kind,
    status: "recebida",
    submitted_at: now,
    consent_at: now,
    submitted_ip_hash: hashIp(getClientIp(request)),
    submitted_user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    reopen_note: null,
    approved_at: null,
    approved_by: null,
    // Daqui em diante a ficha é só com login: o link público, se havia, para de valer.
    token: null,
    expires_at: null,
  };

  let formId: string;
  if (form) {
    // Ficha existente (admissão ou atualização anterior) volta para a revisão da RH.
    const { error } = await admin.from("hr_registration_forms").update(submission).eq("id", form.id);
    if (error) throw new RhHttpError("Não foi possível enviar. Tente de novo.", 500, "UPDATE_FAILED");
    formId = form.id;
  } else {
    const { data, error } = await admin
      .from("hr_registration_forms")
      .insert({
        ...submission,
        origin: "atualizacao",
        invitee_name: employee.full_name,
        invitee_personal_email: answers.personalEmail || null,
        invitee_phone: answers.personalPhone || null,
        employee_id: employee.id,
        linked_at: now,
        linked_by: profileId,
        created_by: profileId,
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      throw new RhHttpError("Sua ficha acabou de ser atualizada. Recarregue a página.", 409, "CONFLICT");
    }
    if (error || !data) throw new RhHttpError("Não foi possível enviar. Tente de novo.", 500, "INSERT_FAILED");
    formId = data.id as string;
  }

  // Um aviso pendente por ficha: reenvios antes da revisão não duplicam o sino da RH.
  const { data: pending } = await admin
    .from("hr_onboarding_notifications")
    .select("id")
    .eq("registration_form_id", formId)
    .eq("event_type", "registration_submitted")
    .is("resolved_at", null)
    .limit(1);
  if (!pending?.length) {
    await admin
      .from("hr_onboarding_notifications")
      .insert({ event_type: "registration_submitted", registration_form_id: formId });
  }
}
