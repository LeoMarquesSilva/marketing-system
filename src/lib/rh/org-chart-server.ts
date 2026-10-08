import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { RhHttpError, requireHrManager } from "@/lib/rh/qualifications/server";
import {
  alignedTierFor,
  resolveOrgTarget,
  type OrgChartData,
  type OrgMember,
  type OrgPendingEmployee,
  type OrgPlacement,
} from "@/lib/rh/org-chart";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const MEMBER_SELECT =
  "id, employee_id, display_name, role, placement, division_key, team_key, group_label, tier, sort_order, photo_url, employee:hr_employees(full_name, is_active, user_id)";

function createOrgChartAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new RhHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type MemberRow = {
  id: string;
  employee_id: string;
  display_name: string;
  role: string;
  placement: OrgPlacement;
  division_key: string | null;
  team_key: string | null;
  group_label: string | null;
  tier: number;
  sort_order: number;
  photo_url: string | null;
  employee: { full_name: string; is_active: boolean; user_id: string | null } | null;
};

async function avatarsByUser(db: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return map;
  const { data, error } = await db.from("users").select("id, avatar_url").in("id", ids);
  if (error) {
    console.error("[organograma] avatares:", error);
    return map;
  }
  for (const user of data ?? []) {
    if (user.avatar_url) map.set(user.id as string, user.avatar_url as string);
  }
  return map;
}

/** Lê organograma + pendências sem checar acesso (uso interno). */
async function readOrgChart(db: SupabaseClient): Promise<OrgChartData> {
  const [membersResult, employeesResult] = await Promise.all([
    db.from("org_chart_members").select(MEMBER_SELECT),
    db
      .from("hr_employees")
      .select("id, full_name, department, position, user_id")
      .eq("is_active", true)
      .order("full_name"),
  ]);
  if (membersResult.error) {
    console.error("[organograma] membros:", membersResult.error);
    throw new RhHttpError("Falha ao carregar o organograma.", 500, "QUERY_FAILED");
  }
  if (employeesResult.error) {
    console.error("[organograma] colaboradores:", employeesResult.error);
    throw new RhHttpError("Falha ao carregar colaboradores.", 500, "QUERY_FAILED");
  }

  const rows = (membersResult.data ?? []) as unknown as MemberRow[];
  const employees = employeesResult.data ?? [];
  const placedIds = new Set(rows.map((r) => r.employee_id));
  const pendingRows = employees.filter((e) => !placedIds.has(e.id as string));

  const avatars = await avatarsByUser(db, [
    ...rows.map((r) => r.employee?.user_id).filter((id): id is string => Boolean(id)),
    ...pendingRows.map((e) => e.user_id as string | null).filter((id): id is string => Boolean(id)),
  ]);

  const members: OrgMember[] = rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    name: row.display_name,
    role: row.role,
    placement: row.placement,
    divisionKey: row.division_key,
    teamKey: row.team_key,
    groupLabel: row.group_label,
    tier: row.tier,
    sortOrder: row.sort_order,
    photoUrl:
      row.photo_url ?? (row.employee?.user_id ? avatars.get(row.employee.user_id) ?? null : null),
    employeeName: row.employee?.full_name ?? row.display_name,
    isActive: row.employee?.is_active ?? false,
  }));

  const pending: OrgPendingEmployee[] = pendingRows.map((e) => ({
    employeeId: e.id as string,
    fullName: e.full_name as string,
    department: (e.department as string | null) ?? null,
    position: (e.position as string | null) ?? null,
    photoUrl: e.user_id ? avatars.get(e.user_id as string) ?? null : null,
  }));

  return { members, pending };
}

export async function loadOrgChartData(): Promise<OrgChartData> {
  await requireHrManager();
  return readOrgChart(createOrgChartAdminClient());
}

/**
 * Quantos ajustes o organograma precisa: colaborador ativo sem posição +
 * pessoa posicionada que ficou inativa. Usado pelo sino de notificações de RH;
 * devolve 0 para quem não tem acesso ao módulo.
 */
export async function countOrgChartAdjustments(): Promise<number> {
  try {
    await requireHrManager();
  } catch {
    return 0;
  }
  const { members, pending } = await readOrgChart(createOrgChartAdminClient());
  const departed = new Set(
    members.filter((m) => m.placement !== "hidden" && !m.isActive).map((m) => m.employeeId)
  );
  return pending.length + departed.size;
}

export type OrgMemberInput = {
  employeeId?: string;
  displayName: string;
  role: string;
  placement: string;
  divisionKey?: string | null;
  teamKey?: string | null;
  groupLabel?: string | null;
  /** Nível dentro da equipe; ausente = novo nível no fim. */
  tier?: number | null;
};

function validateInput(input: OrgMemberInput) {
  const displayName = input.displayName?.trim();
  if (!displayName) throw new RhHttpError("Informe o nome.", 400, "INVALID_NAME");
  const resolved = resolveOrgTarget(input);
  if (!resolved) throw new RhHttpError("Posição inválida no organograma.", 400, "INVALID_TARGET");
  if (input.tier != null && (!Number.isInteger(input.tier) || input.tier < 0 || input.tier > 50)) {
    throw new RhHttpError("Nível inválido.", 400, "INVALID_TIER");
  }
  return { displayName, role: input.role?.trim() ?? "", ...resolved };
}

async function nextSlot(
  db: SupabaseClient,
  target: { placement: OrgPlacement; divisionKey: string | null; teamKey: string | null },
  groupLabel: string | null,
  tier: number | null | undefined,
  role: string,
  ignoreId?: string
): Promise<{ tier: number; sortOrder: number }> {
  let query = db
    .from("org_chart_members")
    .select("id, role, tier, sort_order, group_label")
    .eq("placement", target.placement);
  query = target.divisionKey ? query.eq("division_key", target.divisionKey) : query.is("division_key", null);
  query = target.teamKey ? query.eq("team_key", target.teamKey) : query.is("team_key", null);
  const { data, error } = await query;
  if (error) throw new RhHttpError("Falha ao calcular a posição.", 500, "QUERY_FAILED");
  const peers = (data ?? []).filter((r) => r.id !== ignoreId);
  // Mesmo cargo no mesmo grupo fica sempre no mesmo nível, ignorando o nível pedido.
  const sameGroup = peers
    .filter((r) => ((r.group_label as string | null) ?? null) === groupLabel)
    .map((r) => ({ role: r.role as string, tier: r.tier as number }));
  const aligned = alignedTierFor(sameGroup, role);
  const resolvedTier =
    aligned ?? tier ?? (peers.length ? Math.max(...peers.map((r) => r.tier as number)) + 1 : 0);
  const sameTier = peers.filter(
    (r) => r.tier === resolvedTier && ((r.group_label as string | null) ?? null) === groupLabel
  );
  const sortOrder = sameTier.length ? Math.max(...sameTier.map((r) => r.sort_order as number)) + 1 : 0;
  return { tier: resolvedTier, sortOrder };
}

export async function createOrgMember(input: OrgMemberInput): Promise<void> {
  const manager = await requireHrManager();
  const { displayName, role, target, groupLabel } = validateInput(input);
  if (!input.employeeId) throw new RhHttpError("Colaborador não informado.", 400, "INVALID_EMPLOYEE");
  const db = createOrgChartAdminClient();

  const { data: employee, error: employeeError } = await db
    .from("hr_employees")
    .select("id, user_id")
    .eq("id", input.employeeId)
    .maybeSingle();
  if (employeeError || !employee) throw new RhHttpError("Colaborador não encontrado.", 404, "NOT_FOUND");

  // Reaproveita a foto que a pessoa já tem em outra posição.
  const { data: existing } = await db
    .from("org_chart_members")
    .select("photo_url")
    .eq("employee_id", input.employeeId)
    .not("photo_url", "is", null)
    .limit(1);

  const slot = await nextSlot(db, target, groupLabel, input.tier, role);
  const { error } = await db.from("org_chart_members").insert({
    employee_id: input.employeeId,
    display_name: displayName,
    role,
    placement: target.placement,
    division_key: target.divisionKey,
    team_key: target.teamKey,
    group_label: groupLabel,
    tier: slot.tier,
    sort_order: slot.sortOrder,
    photo_url: (existing?.[0]?.photo_url as string | undefined) ?? null,
    updated_by: manager.profileId,
  });
  if (error) {
    if (error.code === "23505") {
      throw new RhHttpError("Essa pessoa já está nessa posição.", 409, "DUPLICATE");
    }
    console.error("[organograma] inserir:", error);
    throw new RhHttpError("Não foi possível salvar.", 500, "WRITE_FAILED");
  }
}

export async function updateOrgMember(id: string, input: OrgMemberInput): Promise<void> {
  const manager = await requireHrManager();
  const { displayName, role, target, groupLabel } = validateInput(input);
  const db = createOrgChartAdminClient();

  const { data: current, error: currentError } = await db
    .from("org_chart_members")
    .select("id, employee_id, placement, division_key, team_key, group_label, tier, sort_order")
    .eq("id", id)
    .maybeSingle();
  if (currentError || !current) throw new RhHttpError("Posição não encontrada.", 404, "NOT_FOUND");

  const sameScope =
    current.placement === target.placement &&
    current.division_key === target.divisionKey &&
    current.team_key === target.teamKey &&
    ((current.group_label as string | null) ?? null) === groupLabel;

  // Recalcula sempre: trocar o cargo pode puxar a pessoa para o nível dos pares.
  const computed = await nextSlot(
    db,
    target,
    groupLabel,
    input.tier ?? (sameScope ? (current.tier as number) : null),
    role,
    id
  );
  const slot =
    sameScope && computed.tier === current.tier
      ? { tier: computed.tier, sortOrder: current.sort_order as number }
      : computed;

  const { error } = await db
    .from("org_chart_members")
    .update({
      display_name: displayName,
      role,
      placement: target.placement,
      division_key: target.divisionKey,
      team_key: target.teamKey,
      group_label: groupLabel,
      tier: slot.tier,
      sort_order: slot.sortOrder,
      updated_by: manager.profileId,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throw new RhHttpError("Essa pessoa já está nessa posição.", 409, "DUPLICATE");
    }
    console.error("[organograma] atualizar:", error);
    throw new RhHttpError("Não foi possível salvar.", 500, "WRITE_FAILED");
  }

  // Nome e cargo valem para todas as posições da pessoa.
  await db
    .from("org_chart_members")
    .update({ display_name: displayName, role })
    .eq("employee_id", current.employee_id as string)
    .neq("id", id)
    .neq("placement", "hidden");
}

export async function deleteOrgMember(id: string): Promise<void> {
  await requireHrManager();
  const db = createOrgChartAdminClient();
  const { error } = await db.from("org_chart_members").delete().eq("id", id);
  if (error) {
    console.error("[organograma] remover:", error);
    throw new RhHttpError("Não foi possível remover.", 500, "WRITE_FAILED");
  }
}

/** Remove todas as posições de quem saiu do escritório. */
export async function removeEmployeeFromOrgChart(employeeId: string): Promise<void> {
  await requireHrManager();
  const db = createOrgChartAdminClient();
  const { error } = await db
    .from("org_chart_members")
    .delete()
    .eq("employee_id", employeeId)
    .neq("placement", "hidden");
  if (error) {
    console.error("[organograma] remover colaborador:", error);
    throw new RhHttpError("Não foi possível remover.", 500, "WRITE_FAILED");
  }
}
