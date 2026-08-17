import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { hasHrAccess } from "@/lib/rh/access";
import {
  QUALIFICATION_SELECT,
  type HrQualification,
  type QualificationListItem,
} from "@/lib/rh/qualifications/types";
import {
  isQualificationComplete,
  type QualificationUpsertInput,
} from "@/lib/rh/qualifications/validation";
import { resolveAreaFilterLabel } from "@/lib/ferias/filters";
import {
  type QualificationRequirementHistoryItem,
  type QualificationRequirementScope,
  type QualificationRequirementSelection,
} from "@/lib/rh/qualifications/requirements";

export class RhHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "RhHttpError";
  }
}

export function toRhApiError(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof RhHttpError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  console.error("[rh]", error);
  return { status: 500, body: { error: "Erro interno.", code: "INTERNAL" } };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export interface RhManager {
  authUserId: string;
  profileId: string;
  role: string | null;
  name: string;
}

function createRhAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new RhHttpError(
      "SUPABASE_SERVICE_ROLE_KEY não configurada.",
      503,
      "SERVICE_UNAVAILABLE"
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function resolveSessionProfile(): Promise<{
  authUserId: string;
  profileId: string;
  role: string | null;
  name: string;
  permissions: string[];
}> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new RhHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const admin = createRhAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, name, role, permissions")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error || !data) {
    throw new RhHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  }

  return {
    authUserId: user.id,
    profileId: data.id as string,
    role: (data.role as string | null) ?? null,
    name: data.name as string,
    permissions: (data.permissions as string[] | null) ?? [],
  };
}

export async function requireHrManager(): Promise<RhManager> {
  const profile = await resolveSessionProfile();
  if (!hasHrAccess(profile.role, profile.permissions)) {
    throw new RhHttpError("Você não tem acesso ao módulo de RH.", 403, "FORBIDDEN");
  }
  return {
    authUserId: profile.authUserId,
    profileId: profile.profileId,
    role: profile.role,
    name: profile.name,
  };
}

export async function requireAuthenticatedUser(): Promise<{
  authUserId: string;
  profileId: string;
  name: string;
}> {
  const profile = await resolveSessionProfile();
  return {
    authUserId: profile.authUserId,
    profileId: profile.profileId,
    name: profile.name,
  };
}

export async function getMyQualification(): Promise<HrQualification | null> {
  const user = await requireAuthenticatedUser();
  const admin = createRhAdminClient();
  const { data, error } = await admin
    .from("hr_qualifications")
    .select(QUALIFICATION_SELECT)
    .eq("user_id", user.profileId)
    .maybeSingle();

  if (error) throw new RhHttpError("Falha ao carregar qualificação.", 500, "QUERY_FAILED");
  return (data as HrQualification | null) ?? null;
}

export async function upsertMyQualification(
  input: QualificationUpsertInput
): Promise<HrQualification> {
  const user = await requireAuthenticatedUser();
  const admin = createRhAdminClient();
  const complete = isQualificationComplete(input);
  const now = new Date().toISOString();

  const payload = {
    user_id: user.profileId,
    ...input,
    status: complete ? ("completo" as const) : ("pendente" as const),
    completed_at: complete ? now : null,
    updated_by: user.profileId,
  };

  const { data, error } = await admin
    .from("hr_qualifications")
    .upsert(payload, { onConflict: "user_id" })
    .select(QUALIFICATION_SELECT)
    .single();

  if (error) {
    if (error.code === "23505" && error.message?.includes("cpf")) {
      throw new RhHttpError("Este CPF já está cadastrado.", 409, "CPF_DUPLICATE");
    }
    throw new RhHttpError("Falha ao salvar qualificação.", 500, "UPSERT_FAILED");
  }

  if (complete) {
    const { error: profileError } = await admin
      .from("users")
      .update({ qualification_completed_at: now })
      .eq("id", user.profileId);
    if (profileError) {
      throw new RhHttpError(
        "A qualificação foi salva, mas não foi possível concluir a pendência.",
        500,
        "REQUIREMENT_UPDATE_FAILED"
      );
    }
  }

  return data as HrQualification;
}

export interface QualificationRequirementResult {
  selectedCount: number;
  requestedCount: number;
  alreadyCompleteCount: number;
}

function buildPeopleScopes(
  users: Array<{ id: string; name: string; department: string | null }>,
  positionByUser: Map<string, string | null>
): QualificationRequirementScope[] {
  const byArea = new Map<string, QualificationRequirementScope>();
  for (const user of users) {
    const area = resolveAreaFilterLabel(user.department) ?? "Sem área";
    const current = byArea.get(area) ?? { area, people: [] };
    current.people.push({
      user_id: user.id,
      name: user.name,
      position: positionByUser.get(user.id) ?? null,
    });
    byArea.set(area, current);
  }
  return [...byArea.values()]
    .map((scope) => ({
      ...scope,
      people: scope.people.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }))
    .sort((a, b) => a.area.localeCompare(b.area, "pt-BR"));
}

async function insertRequirementHistory(
  admin: SupabaseClient,
  input: Omit<
    QualificationRequirementHistoryItem,
    "id" | "performed_by" | "created_at"
  > & { performed_by: string }
): Promise<void> {
  const { error } = await admin
    .from("hr_qualification_requirement_history")
    .insert(input);
  if (error) {
    throw new RhHttpError(
      "A obrigatoriedade foi alterada, mas não foi possível registrar o histórico.",
      500,
      "HISTORY_INSERT_FAILED"
    );
  }
}

export async function requestQualificationsForSelection(
  selection: QualificationRequirementSelection
): Promise<QualificationRequirementResult> {
  const manager = await requireHrManager();
  const admin = createRhAdminClient();
  const now = new Date().toISOString();

  const [
    { data: users, error: usersError },
    { data: employees, error: employeesError },
    { data: qualifications, error: qualificationsError },
  ] = await Promise.all([
    admin
      .from("users")
      .select("id, name, department")
      .eq("is_active", true),
    admin
      .from("hr_employees")
      .select("user_id, position")
      .eq("is_active", true),
    admin
      .from("hr_qualifications")
      .select("user_id, status"),
  ]);

  if (usersError || employeesError || qualificationsError) {
    throw new RhHttpError(
      "Não foi possível identificar os colaboradores selecionados.",
      500,
      "TARGET_LOOKUP_FAILED"
    );
  }

  const positionByUser = new Map(
    ((employees as Array<{ user_id: string | null; position: string | null }>) ?? [])
      .filter((employee) => employee.user_id)
      .map((employee) => [employee.user_id as string, employee.position])
  );
  const completeUserIds = new Set(
    ((qualifications as Array<{ user_id: string; status: string }>) ?? [])
      .filter((qualification) => qualification.status === "completo")
      .map((qualification) => qualification.user_id)
  );
  const requestedSet = new Set(selection.user_ids);
  const selectedUsers = (
    (users as Array<{ id: string; name: string; department: string | null }>) ??
    []
  )
    // Contas técnicas existem em users para vincular conteúdo, mas somente
    // perfis ligados ao cadastro ativo de RH são colaboradores elegíveis.
    .filter((user) => positionByUser.has(user.id) && requestedSet.has(user.id));
  const selectedUserIds = selectedUsers.map((user) => user.id);
  if (selectedUserIds.length === 0) {
    throw new RhHttpError(
      "Nenhum colaborador ativo encontrado na seleção.",
      404,
      "USER_NOT_FOUND"
    );
  }
  const historyScopes = buildPeopleScopes(selectedUsers, positionByUser);
  const requestedUserIds = selectedUserIds.filter(
    (userId) => !completeUserIds.has(userId)
  );

  const { error: clearError } = await admin
    .from("users")
    .update({
      qualification_required_at: null,
      qualification_requested_by: null,
    })
    .not("qualification_required_at", "is", null);
  if (clearError) {
    throw new RhHttpError(
      "Não foi possível substituir a obrigatoriedade atual.",
      500,
      "REQUIREMENT_CLEAR_FAILED"
    );
  }

  if (requestedUserIds.length > 0) {
    const { error: requestError } = await admin
      .from("users")
      .update({
        qualification_required_at: now,
        qualification_requested_by: manager.profileId,
      })
      .in("id", requestedUserIds);
    if (requestError) {
      throw new RhHttpError(
        "Não foi possível ativar a obrigatoriedade para os colaboradores.",
        500,
        "REQUEST_FAILED"
      );
    }
  }

  await insertRequirementHistory(admin, {
    action: "activated",
    scopes: historyScopes,
    selected_count: selectedUserIds.length,
    affected_count: requestedUserIds.length,
    already_complete_count: selectedUserIds.length - requestedUserIds.length,
    performed_by: manager.profileId,
    performed_by_name: manager.name,
  });

  return {
    selectedCount: selectedUserIds.length,
    requestedCount: requestedUserIds.length,
    alreadyCompleteCount: selectedUserIds.length - requestedUserIds.length,
  };
}

export async function clearQualificationRequirements(): Promise<number> {
  const manager = await requireHrManager();
  const admin = createRhAdminClient();
  const { data: latestActivation, error: historyLookupError } = await admin
    .from("hr_qualification_requirement_history")
    .select("scopes")
    .eq("action", "activated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (historyLookupError) {
    throw new RhHttpError(
      "Não foi possível consultar a configuração atual.",
      500,
      "HISTORY_LOOKUP_FAILED"
    );
  }

  const { data, error } = await admin
    .from("users")
    .update({
      qualification_required_at: null,
      qualification_requested_by: null,
    })
    .not("qualification_required_at", "is", null)
    .select("id");

  if (error) {
    throw new RhHttpError(
      "Não foi possível desativar a obrigatoriedade.",
      500,
      "REQUIREMENT_CLEAR_FAILED"
    );
  }
  const clearedCount = data?.length ?? 0;
  await insertRequirementHistory(admin, {
    action: "deactivated",
    scopes:
      (latestActivation?.scopes as QualificationRequirementHistoryItem["scopes"]) ??
      [],
    selected_count: clearedCount,
    affected_count: clearedCount,
    already_complete_count: 0,
    performed_by: manager.profileId,
    performed_by_name: manager.name,
  });
  return clearedCount;
}

export async function listQualificationRequirementHistoryForHr(): Promise<
  QualificationRequirementHistoryItem[]
> {
  await requireHrManager();
  const admin = createRhAdminClient();
  const { data, error } = await admin
    .from("hr_qualification_requirement_history")
    .select(
      "id, action, scopes, selected_count, affected_count, already_complete_count, performed_by, performed_by_name, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new RhHttpError(
      "Falha ao carregar o histórico de obrigatoriedade.",
      500,
      "HISTORY_QUERY_FAILED"
    );
  }
  return (data as QualificationRequirementHistoryItem[] | null) ?? [];
}

export async function listQualificationsForHr(): Promise<QualificationListItem[]> {
  await requireHrManager();
  const admin = createRhAdminClient();

  const [
    { data: users, error: usersError },
    { data: quals, error: qualsError },
    { data: employees, error: employeesError },
  ] =
    await Promise.all([
      admin
        .from("users")
        .select("id, name, email, department, avatar_url, is_active, qualification_required_at, qualification_completed_at")
        .eq("is_active", true)
        .order("name"),
      admin.from("hr_qualifications").select(QUALIFICATION_SELECT),
      admin
        .from("hr_employees")
        .select("user_id, position")
        .eq("is_active", true),
    ]);

  if (usersError || qualsError || employeesError) {
    throw new RhHttpError("Falha ao listar qualificações.", 500, "QUERY_FAILED");
  }

  const byUser = new Map(
    ((quals as HrQualification[]) ?? []).map((q) => [q.user_id, q])
  );
  const positionByUser = new Map(
    ((employees as Array<{ user_id: string | null; position: string | null }>) ?? [])
      .filter((employee) => employee.user_id)
      .map((employee) => [employee.user_id as string, employee.position])
  );
  const activeEmployeeUserIds = new Set(positionByUser.keys());

  return (
    (users as Array<{
      id: string;
      name: string;
      email: string | null;
      department: string | null;
      avatar_url: string | null;
      qualification_required_at: string | null;
      qualification_completed_at: string | null;
    }>) ?? []
  )
    .filter((user) => activeEmployeeUserIds.has(user.id))
    .map((u) => ({
      user_id: u.id,
      user_name: u.name,
      user_email: u.email,
      department: u.department,
      position: positionByUser.get(u.id) ?? null,
      avatar_url: u.avatar_url,
      qualification_required_at: u.qualification_required_at,
      qualification_completed_at: u.qualification_completed_at,
      qualification: byUser.get(u.id) ?? null,
    }));
}
