import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { hasHrAccess } from "@/lib/rh/access";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import { NATIONALITY_OPTIONS } from "@/lib/rh/qualifications/types";
import { onlyDigits } from "@/lib/masks-br";
import { suggestRegistrationMatches, type MatchCandidate } from "./matching";
import {
  coerceRegistrationAnswers,
  emptyRegistrationAnswers,
  isRegistrationExpired,
  isRegistrationKind,
  registrationPublicPath,
  REGISTRATION_KIND_EMPLOYMENT_TYPE,
  type DietaryInfo,
  type RegistrationAnswers,
  type RegistrationDetail,
  type RegistrationEmployeeRef,
  type RegistrationKind,
  type RegistrationListItem,
  type RegistrationStatus,
} from "./types";
import {
  normalizeRegistrationAnswers,
  validateRegistrationAnswers,
  type RegistrationErrors,
} from "./validation";

export { RhHttpError };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Prazo do link público. Devolver para correção reabre por pelo menos 14 dias. */
const LINK_TTL_DAYS = 30;
const REOPEN_TTL_DAYS = 14;

const TOKEN_PATTERN = /^fc_[A-Za-z0-9_-]{20,64}$/;

const FORM_SELECT =
  "id, token, employment_kind, invitee_name, invitee_personal_email, invitee_phone, expected_admission_date, status, answers, expires_at, reopen_note, submitted_at, consent_at, approved_at, linked_at, applied_at, created_at, employee_id, employee:hr_employees(id, full_name, department, position, is_active)";

export function createRegistrationAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new RhHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function generateToken(): string {
  return `fc_${randomBytes(24).toString("base64url")}`;
}

export function isValidRegistrationToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

// ─── Acesso ──────────────────────────────────────────────────────────────────

interface RegistrationManager {
  profileId: string;
}

/** RH (permissão /rh ou admin) ou destinatárias fixas das notificações de RH. */
export async function requireRegistrationManager(): Promise<RegistrationManager> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new RhHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const admin = createRegistrationAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, role, permissions, is_hr_notification_recipient, is_active")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (error || !data) {
    throw new RhHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  }
  if (data.is_active === false) throw new RhHttpError("Usuário inativo.", 403, "FORBIDDEN");

  const allowed =
    hasHrAccess(data.role as string | null, (data.permissions as string[] | null) ?? []) ||
    Boolean(data.is_hr_notification_recipient);
  if (!allowed) {
    throw new RhHttpError("Você não tem acesso às fichas cadastrais.", 403, "FORBIDDEN");
  }
  return { profileId: data.id as string };
}

// ─── Mapeamento ──────────────────────────────────────────────────────────────

type FormRow = {
  id: string;
  token: string;
  employment_kind: RegistrationKind;
  invitee_name: string;
  invitee_personal_email: string | null;
  invitee_phone: string | null;
  expected_admission_date: string | null;
  status: RegistrationStatus;
  answers: unknown;
  expires_at: string;
  reopen_note: string | null;
  submitted_at: string | null;
  consent_at: string | null;
  approved_at: string | null;
  linked_at: string | null;
  applied_at: string | null;
  created_at: string;
  employee_id: string | null;
  employee: RegistrationEmployeeRef | RegistrationEmployeeRef[] | null;
};

function pickEmployee(raw: FormRow["employee"]): RegistrationEmployeeRef | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function toListItem(row: FormRow, candidates: MatchCandidate[]): RegistrationListItem {
  const answers = coerceRegistrationAnswers(row.answers);
  const employee = pickEmployee(row.employee);
  const submitted = row.status === "recebida" || row.status === "aprovada";
  const canSuggest = !employee && row.status !== "cancelada";
  return {
    id: row.id,
    employment_kind: row.employment_kind,
    invitee_name: row.invitee_name,
    invitee_personal_email: row.invitee_personal_email,
    invitee_phone: row.invitee_phone,
    expected_admission_date: row.expected_admission_date,
    status: row.status,
    expires_at: row.expires_at,
    submitted_at: row.submitted_at,
    approved_at: row.approved_at,
    linked_at: row.linked_at,
    applied_at: row.applied_at,
    created_at: row.created_at,
    employee,
    declared_name: submitted ? answers.fullName || null : null,
    suggestions: canSuggest
      ? suggestRegistrationMatches(
          { names: [row.invitee_name, submitted ? answers.fullName : null], cpf: submitted ? answers.cpf : null },
          candidates
        )
      : [],
    public_path: registrationPublicPath(row.token),
  };
}

function toDetail(row: FormRow, candidates: MatchCandidate[]): RegistrationDetail {
  return {
    ...toListItem(row, candidates),
    answers: coerceRegistrationAnswers(row.answers),
    reopen_note: row.reopen_note,
    consent_at: row.consent_at,
  };
}

/**
 * Colaboradores que ainda podem receber uma ficha: ativos e sem ficha ativa
 * vinculada. São os candidatos às sugestões de vínculo.
 */
async function loadMatchCandidates(admin: SupabaseClient): Promise<MatchCandidate[]> {
  const [employeesResult, linkedResult] = await Promise.all([
    admin
      .from("hr_employees")
      .select("id, full_name, cpf, department, position")
      .eq("is_active", true),
    admin
      .from("hr_registration_forms")
      .select("employee_id")
      .not("employee_id", "is", null)
      .neq("status", "cancelada"),
  ]);
  if (employeesResult.error || linkedResult.error) {
    throw new RhHttpError("Falha ao carregar colaboradores.", 500, "QUERY_FAILED");
  }
  const linked = new Set((linkedResult.data ?? []).map((row) => row.employee_id as string));
  return ((employeesResult.data ?? []) as MatchCandidate[]).filter((row) => !linked.has(row.id));
}

async function loadFormRow(admin: SupabaseClient, id: string): Promise<FormRow> {
  const { data, error } = await admin
    .from("hr_registration_forms")
    .select(FORM_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new RhHttpError("Falha ao carregar a ficha.", 500, "QUERY_FAILED");
  if (!data) throw new RhHttpError("Ficha não encontrada.", 404, "NOT_FOUND");
  return data as unknown as FormRow;
}

// ─── RH ──────────────────────────────────────────────────────────────────────

export async function listRegistrationForms(): Promise<RegistrationListItem[]> {
  await requireRegistrationManager();
  const admin = createRegistrationAdminClient();
  const [{ data, error }, candidates] = await Promise.all([
    admin.from("hr_registration_forms").select(FORM_SELECT).order("created_at", { ascending: false }),
    loadMatchCandidates(admin),
  ]);
  if (error) throw new RhHttpError("Falha ao carregar as fichas.", 500, "QUERY_FAILED");
  return ((data ?? []) as unknown as FormRow[]).map((row) => toListItem(row, candidates));
}

/** Colaboradores ativos ainda sem ficha — opções do seletor de vínculo manual. */
export async function listLinkableEmployees(): Promise<RegistrationEmployeeRef[]> {
  await requireRegistrationManager();
  const candidates = await loadMatchCandidates(createRegistrationAdminClient());
  return candidates
    .map((row) => ({
      id: row.id,
      full_name: row.full_name,
      department: row.department,
      position: row.position,
      is_active: true,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
}

export async function getRegistrationForm(id: string): Promise<RegistrationDetail> {
  await requireRegistrationManager();
  const admin = createRegistrationAdminClient();
  const [row, candidates] = await Promise.all([loadFormRow(admin, id), loadMatchCandidates(admin)]);
  return toDetail(row, candidates);
}

export interface CreateRegistrationInput {
  kind: unknown;
  inviteeName: unknown;
  personalEmail?: unknown;
  phone?: unknown;
  expectedAdmissionDate?: unknown;
}

function optionalText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export async function createRegistrationForm(
  input: CreateRegistrationInput
): Promise<RegistrationDetail> {
  const manager = await requireRegistrationManager();
  if (!isRegistrationKind(input.kind)) {
    throw new RhHttpError("Selecione o vínculo.", 400, "INVALID_KIND");
  }
  const inviteeName = optionalText(input.inviteeName);
  if (!inviteeName) throw new RhHttpError("Informe o nome da pessoa.", 400, "INVALID_NAME");

  const personalEmail = optionalText(input.personalEmail)?.toLowerCase() ?? null;
  if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
    throw new RhHttpError("E-mail pessoal inválido.", 400, "INVALID_EMAIL");
  }
  const phone = optionalText(input.phone, 40);
  const expected = optionalText(input.expectedAdmissionDate, 10);
  if (expected && !/^\d{4}-\d{2}-\d{2}$/.test(expected)) {
    throw new RhHttpError("Data de admissão inválida.", 400, "INVALID_DATE");
  }

  // Pré-preenche o que a RH já sabe; a pessoa confirma ou corrige.
  const answers: RegistrationAnswers = {
    ...emptyRegistrationAnswers(),
    fullName: inviteeName,
    personalEmail: personalEmail ?? "",
    personalPhone: phone ?? "",
  };

  const admin = createRegistrationAdminClient();
  const { data, error } = await admin
    .from("hr_registration_forms")
    .insert({
      token: generateToken(),
      employment_kind: input.kind,
      invitee_name: inviteeName,
      invitee_personal_email: personalEmail,
      invitee_phone: phone,
      expected_admission_date: expected,
      answers,
      expires_at: daysFromNow(LINK_TTL_DAYS),
      created_by: manager.profileId,
    })
    .select("id")
    .single();
  if (error || !data) throw new RhHttpError("Não foi possível criar a ficha.", 500, "INSERT_FAILED");
  return getRegistrationForm(data.id as string);
}

export class RegistrationValidationError extends RhHttpError {
  constructor(public readonly fieldErrors: RegistrationErrors) {
    super("Revise os campos destacados.", 422, "INVALID_ANSWERS");
  }
}

function validateOrThrow(raw: unknown, kind: RegistrationKind): RegistrationAnswers {
  const answers = normalizeRegistrationAnswers(raw, kind);
  const errors = validateRegistrationAnswers(answers, kind);
  if (Object.keys(errors).length > 0) throw new RegistrationValidationError(errors);
  return answers;
}

export type RegistrationAction =
  | { action: "save"; answers: unknown; employmentKind?: unknown }
  | { action: "approve" }
  | { action: "reopen"; note?: unknown }
  | { action: "cancel" }
  | { action: "regenerate" }
  | { action: "link"; employeeId: unknown }
  | { action: "unlink" };

export async function runRegistrationAction(
  id: string,
  body: RegistrationAction
): Promise<RegistrationDetail> {
  const manager = await requireRegistrationManager();
  const admin = createRegistrationAdminClient();
  const row = await loadFormRow(admin, id);
  const update = async (payload: Record<string, unknown>) => {
    const { error } = await admin.from("hr_registration_forms").update(payload).eq("id", id);
    if (error) {
      if (error.code === "23505") {
        throw new RhHttpError("Este colaborador já tem outra ficha vinculada.", 409, "EMPLOYEE_TAKEN");
      }
      throw new RhHttpError("Não foi possível atualizar a ficha.", 500, "UPDATE_FAILED");
    }
  };

  if (row.status === "cancelada" && body.action !== "regenerate") {
    throw new RhHttpError("Esta ficha foi cancelada.", 409, "CANCELLED");
  }

  switch (body.action) {
    case "save": {
      if (row.status === "pendente") {
        throw new RhHttpError("A pessoa ainda não enviou a ficha.", 409, "NOT_SUBMITTED");
      }
      const kind = isRegistrationKind(body.employmentKind) ? body.employmentKind : row.employment_kind;
      const answers = validateOrThrow(body.answers, kind);
      await update({ answers, employment_kind: kind });
      // Ficha já aprovada e vinculada: a correção também vai para a ficha do colaborador.
      if (row.status === "aprovada" && row.employee_id) {
        await applyToEmployee(admin, { ...row, answers, employment_kind: kind }, manager.profileId);
      }
      break;
    }
    case "approve": {
      if (row.status !== "recebida") {
        throw new RhHttpError("Só fichas recebidas podem ser aprovadas.", 409, "INVALID_STATUS");
      }
      validateOrThrow(row.answers, row.employment_kind);
      await update({ status: "aprovada", approved_at: new Date().toISOString(), approved_by: manager.profileId });
      await resolveSubmittedNotifications(admin, id, manager.profileId);
      if (row.employee_id) await applyToEmployee(admin, row, manager.profileId);
      break;
    }
    case "reopen": {
      if (row.status !== "recebida" && row.status !== "aprovada") {
        throw new RhHttpError("A ficha ainda não foi enviada.", 409, "INVALID_STATUS");
      }
      const minExpiry = daysFromNow(REOPEN_TTL_DAYS);
      await update({
        status: "pendente",
        reopen_note: optionalText(body.note, 1000),
        approved_at: null,
        approved_by: null,
        expires_at: row.expires_at > minExpiry ? row.expires_at : minExpiry,
      });
      await resolveSubmittedNotifications(admin, id, manager.profileId);
      break;
    }
    case "cancel": {
      await update({ status: "cancelada" });
      await resolveSubmittedNotifications(admin, id, manager.profileId);
      break;
    }
    case "regenerate": {
      if (row.status !== "pendente" && row.status !== "cancelada") {
        throw new RhHttpError("A ficha já foi enviada.", 409, "INVALID_STATUS");
      }
      await update({ token: generateToken(), status: "pendente", expires_at: daysFromNow(LINK_TTL_DAYS) });
      break;
    }
    case "link": {
      if (typeof body.employeeId !== "string" || !body.employeeId) {
        throw new RhHttpError("Selecione o colaborador.", 400, "INVALID_EMPLOYEE");
      }
      const { data: employee, error } = await admin
        .from("hr_employees")
        .select("id")
        .eq("id", body.employeeId)
        .maybeSingle();
      if (error || !employee) throw new RhHttpError("Colaborador não encontrado.", 404, "NOT_FOUND");
      await update({
        employee_id: body.employeeId,
        linked_at: new Date().toISOString(),
        linked_by: manager.profileId,
        applied_at: null,
      });
      if (row.status === "aprovada") {
        await applyToEmployee(admin, { ...row, employee_id: body.employeeId }, manager.profileId);
      }
      break;
    }
    case "unlink": {
      await update({ employee_id: null, linked_at: null, linked_by: null, applied_at: null });
      break;
    }
    default:
      throw new RhHttpError("Ação inválida.", 400, "INVALID_ACTION");
  }

  return getRegistrationForm(id);
}

async function resolveSubmittedNotifications(
  admin: SupabaseClient,
  formId: string,
  resolvedBy: string
): Promise<void> {
  await admin
    .from("hr_onboarding_notifications")
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq("registration_form_id", formId)
    .is("resolved_at", null);
}

/**
 * Copia a ficha aprovada para o colaborador vinculado. Só preenche campos
 * vazios — o que a RH já digitou na ficha do colaborador não é sobrescrito.
 * Sócio de serviço também ganha a qualificação jurídica pré-preenchida.
 */
async function applyToEmployee(
  admin: SupabaseClient,
  row: Pick<FormRow, "id" | "answers" | "employment_kind" | "employee_id">,
  appliedBy: string
): Promise<void> {
  if (!row.employee_id) return;
  const answers = coerceRegistrationAnswers(row.answers);
  const { data: employee, error } = await admin
    .from("hr_employees")
    .select("id, user_id, cpf, rg, birth_date, gender, employment_type, oab_number, oab_uf")
    .eq("id", row.employee_id)
    .maybeSingle();
  if (error || !employee) return;

  const patch: Record<string, unknown> = {};
  const fill = (column: string, value: string | null) => {
    if (value && !employee[column as keyof typeof employee]) patch[column] = value;
  };
  fill("rg", answers.rg || null);
  fill("birth_date", answers.birthDate || null);
  fill("gender", answers.gender === "feminino" ? "F" : answers.gender === "masculino" ? "M" : null);
  fill("employment_type", REGISTRATION_KIND_EMPLOYMENT_TYPE[row.employment_kind]);
  fill("oab_number", answers.oabNumber || null);
  fill("oab_uf", answers.oabUf || null);

  if (Object.keys(patch).length > 0) {
    await admin.from("hr_employees").update(patch).eq("id", employee.id);
  }
  // CPF é único: aplicado à parte para um conflito não derrubar o resto.
  if (!employee.cpf && onlyDigits(answers.cpf).length === 11) {
    await admin.from("hr_employees").update({ cpf: answers.cpf }).eq("id", employee.id);
  }

  if (row.employment_kind === "socio_servico" && employee.user_id) {
    await prefillQualification(admin, employee.user_id as string, answers, appliedBy);
  }

  await admin.from("hr_registration_forms").update({ applied_at: new Date().toISOString() }).eq("id", row.id);
  await admin
    .from("hr_onboarding_notifications")
    .update({ resolved_at: new Date().toISOString(), resolved_by: appliedBy })
    .eq("employee_id", employee.id)
    .eq("event_type", "new_employee")
    .is("resolved_at", null);
}

/** A qualificação usa uma lista fechada de nacionalidades; texto livre vira o valor mais próximo. */
function qualificationNationality(value: string): string {
  const normalized = nameKey(value);
  const match = NATIONALITY_OPTIONS.find((option) =>
    [option.value, option.label, option.feminine, option.masculine].some(
      (candidate) => nameKey(candidate) === normalized
    )
  );
  return match?.value ?? "brasileira";
}

function nameKey(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

async function prefillQualification(
  admin: SupabaseClient,
  userId: string,
  answers: RegistrationAnswers,
  updatedBy: string
): Promise<void> {
  const { data: existing } = await admin
    .from("hr_qualifications")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return;
  // Estado civil e profissão não estão na ficha: a qualificação segue pendente.
  await admin.from("hr_qualifications").insert({
    user_id: userId,
    full_name: answers.fullName,
    birth_date: answers.birthDate || null,
    nationality: qualificationNationality(answers.nationality),
    treatment_gender: answers.gender === "masculino" ? "m" : answers.gender === "feminino" ? "f" : null,
    cpf: onlyDigits(answers.cpf) || null,
    rg: answers.rg || null,
    rg_issuer: answers.rgIssuer || null,
    oab_number: answers.oabNumber || null,
    oab_uf: answers.oabUf || null,
    cep: onlyDigits(answers.cep) || null,
    street: answers.street || null,
    number: answers.number || null,
    complement: answers.complement || null,
    district: answers.district || null,
    city: answers.city || null,
    state: answers.state || null,
    personal_phone: answers.personalPhone || null,
    personal_email: answers.personalEmail || null,
    status: "pendente",
    updated_by: updatedBy,
  });
}

// ─── Link público ────────────────────────────────────────────────────────────

const RATE_LIMIT_PER_MINUTE = 20;
const rateBucket = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret = process.env.NPS_IP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "fc-fallback";
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** Rate limit in-memory simples (por processo), como no NPS. */
function isRateLimited(key: string, ipHash: string | null): boolean {
  const bucketKey = createHash("sha256").update(`${key}:${ipHash ?? "anon"}`).digest("hex").slice(0, 32);
  const now = Date.now();
  const entry = rateBucket.get(bucketKey);
  if (!entry || entry.resetAt <= now) {
    rateBucket.set(bucketKey, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

export type PublicRegistrationState =
  | { state: "not_found" | "expired" | "cancelled" | "rate_limited" }
  | { state: "submitted"; inviteeName: string; submittedAt: string | null }
  | {
      state: "ready";
      kind: RegistrationKind;
      inviteeName: string;
      answers: RegistrationAnswers;
      reopenNote: string | null;
      expiresAt: string;
    };

type PublicRow = {
  id: string;
  employment_kind: RegistrationKind;
  invitee_name: string;
  status: RegistrationStatus;
  answers: unknown;
  expires_at: string;
  reopen_note: string | null;
  submitted_at: string | null;
};

async function loadPublicRow(admin: SupabaseClient, token: string): Promise<PublicRow | null> {
  const { data, error } = await admin
    .from("hr_registration_forms")
    .select("id, employment_kind, invitee_name, status, answers, expires_at, reopen_note, submitted_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new RhHttpError("Falha ao carregar a ficha.", 500, "QUERY_FAILED");
  return (data as PublicRow | null) ?? null;
}

export async function resolvePublicRegistration(
  token: string,
  request: Request
): Promise<PublicRegistrationState> {
  if (!isValidRegistrationToken(token)) return { state: "not_found" };
  if (isRateLimited(`get:${token}`, hashIp(getClientIp(request)))) return { state: "rate_limited" };

  const row = await loadPublicRow(createRegistrationAdminClient(), token);
  if (!row) return { state: "not_found" };
  if (row.status === "cancelada") return { state: "cancelled" };
  // Depois de enviada, as respostas nunca voltam pelo link (dados bancários etc.).
  if (row.status !== "pendente") {
    return { state: "submitted", inviteeName: row.invitee_name, submittedAt: row.submitted_at };
  }
  if (isRegistrationExpired(row.expires_at)) return { state: "expired" };

  return {
    state: "ready",
    kind: row.employment_kind,
    inviteeName: row.invitee_name,
    answers: coerceRegistrationAnswers(row.answers),
    reopenNote: row.reopen_note,
    expiresAt: row.expires_at,
  };
}

export type PublicSubmitResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string; fieldErrors?: RegistrationErrors };

export async function submitPublicRegistration(
  token: string,
  body: unknown,
  request: Request
): Promise<PublicSubmitResult> {
  if (!isValidRegistrationToken(token)) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Link inválido." };
  }
  const ipHash = hashIp(getClientIp(request));
  if (isRateLimited(`submit:${token}`, ipHash)) {
    return { ok: false, status: 429, code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde um minuto." };
  }

  const admin = createRegistrationAdminClient();
  const row = await loadPublicRow(admin, token);
  if (!row) return { ok: false, status: 404, code: "NOT_FOUND", message: "Link inválido." };
  if (row.status !== "pendente") {
    return { ok: false, status: 409, code: "ALREADY_SUBMITTED", message: "Esta ficha já foi enviada." };
  }
  if (isRegistrationExpired(row.expires_at)) {
    return { ok: false, status: 410, code: "EXPIRED", message: "Este link expirou. Peça um novo à equipe de Pessoas e Cultura." };
  }

  const payload = (body ?? {}) as { answers?: unknown; consent?: unknown };
  if (payload.consent !== true) {
    return { ok: false, status: 422, code: "CONSENT_REQUIRED", message: "Confirme a declaração para enviar." };
  }
  const answers = normalizeRegistrationAnswers(payload.answers, row.employment_kind);
  const fieldErrors = validateRegistrationAnswers(answers, row.employment_kind);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, status: 422, code: "INVALID_ANSWERS", message: "Revise os campos destacados.", fieldErrors };
  }

  const now = new Date().toISOString();
  // Condicional ao status: dois envios simultâneos não sobrescrevem um ao outro.
  const { data: updated, error } = await admin
    .from("hr_registration_forms")
    .update({
      answers,
      status: "recebida",
      submitted_at: now,
      consent_at: now,
      submitted_ip_hash: ipHash,
      submitted_user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      reopen_note: null,
    })
    .eq("id", row.id)
    .eq("status", "pendente")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, status: 500, code: "UPDATE_FAILED", message: "Não foi possível enviar. Tente de novo." };
  if (!updated) {
    return { ok: false, status: 409, code: "ALREADY_SUBMITTED", message: "Esta ficha já foi enviada." };
  }

  await admin
    .from("hr_onboarding_notifications")
    .insert({ event_type: "registration_submitted", registration_form_id: row.id });

  return { ok: true };
}

// ─── Restrição alimentar (Eventos / Café com Cultura) ────────────────────────

/**
 * Restrições alimentares por usuário, a partir das fichas vinculadas. Só a
 * restrição e o detalhe saem daqui — nada de banco, tipo sanguíneo etc.
 * Chamar apenas de rotas que já validaram acesso a Eventos/Café.
 */
export async function getDietaryByUserIds(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, DietaryInfo>> {
  const result = new Map<string, DietaryInfo>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return result;

  const { data: employees, error } = await admin
    .from("hr_employees")
    .select("id, user_id")
    .in("user_id", ids);
  if (error || !employees?.length) return result;

  const userByEmployee = new Map(employees.map((row) => [row.id as string, row.user_id as string]));
  const { data: forms } = await admin
    .from("hr_registration_forms")
    .select("employee_id, answers")
    .in("employee_id", [...userByEmployee.keys()])
    .in("status", ["recebida", "aprovada"]);

  for (const form of forms ?? []) {
    const userId = userByEmployee.get(form.employee_id as string);
    if (!userId) continue;
    const answers = coerceRegistrationAnswers(form.answers);
    if (answers.dietaryRestrictions.length === 0) continue;
    result.set(userId, {
      restrictions: answers.dietaryRestrictions,
      notes: answers.dietaryNotes || null,
    });
  }
  return result;
}
