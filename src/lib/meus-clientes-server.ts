/**
 * Meus Clientes — leitura no servidor com escopo por gestor/área.
 */

import { createClient as createPublicClient } from "@/utils/supabase/server";
import { getAdminClient } from "@/lib/email-marketing-server";
import {
  mapCompany,
  mapContact,
  mapGroupResponsible,
  mapPerson,
  type EmailAreaManagerRow,
  type EmailCompany,
  type EmailContact,
  type EmailGroupResponsible,
  type EmailPerson,
} from "@/lib/email-marketing";
import type { User } from "@/lib/users";
import {
  computeMyClientScope,
  filterInternalContacts,
  filterInternalResponsibles,
  filterOutInternalClientGroups,
  resolveClientGroupKey,
  resolveContactGroupKey,
  type MyClientScope,
} from "@/lib/meus-clientes";
import { normalizeLegalArea } from "@/lib/legal-areas";
import { canAccessPath, type AccessProfile } from "@/lib/access-control";
import { fetchSioeClienteAtividadeIndex } from "@/lib/sioe-cliente-atividade-server";
import type { SioeClienteAtividadeIndex } from "@/lib/sioe-cliente-atividade";
import {
  mapClientGroupGestorStatus,
  validateClientGroupGestorStatusInput,
  type ClientGroupGestorStatus,
  type UpdateClientGroupGestorStatusInput,
} from "@/lib/client-group-gestor-status";
import { fetchActiveCampaignNpsSentMap } from "@/lib/nps/server";

export interface MeusClientesSyncMeta {
  lastSyncedAt: string | null;
  groupsWithoutArea: number;
  configured: boolean;
}

export interface MeusClientesPayload {
  companies: EmailCompany[];
  contacts: EmailContact[];
  people: EmailPerson[];
  responsibles: EmailGroupResponsible[];
  areaManagers: EmailAreaManagerRow[];
  systemUsers: Pick<User, "id" | "name" | "avatar_url">[];
  scope: MyClientScope | null;
  isAdmin: boolean;
  syncMeta: MeusClientesSyncMeta;
  clienteAtividade: SioeClienteAtividadeIndex;
  clientGroupStatusById: Record<string, ClientGroupGestorStatus>;
  npsSentByGroupId: Record<string, { sentAt: string; sentByName: string }>;
}

async function resolveProfile(authUserId: string): Promise<AccessProfile & { id: string }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, role, permissions")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário sem cadastro no sistema.");
  return data as AccessProfile & { id: string };
}

async function fetchSyncMeta(admin: ReturnType<typeof getAdminClient>): Promise<MeusClientesSyncMeta> {
  const [{ data: syncRow }, { count }] = await Promise.all([
    admin
      .from("email_client_groups")
      .select("sioe_synced_at")
      .order("sioe_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("email_client_groups")
      .select("id", { count: "exact", head: true })
      .or("legal_areas.is.null,legal_areas.eq.{}"),
  ]);

  return {
    lastSyncedAt: (syncRow?.sioe_synced_at as string | null) ?? null,
    groupsWithoutArea: count ?? 0,
    configured: Boolean(process.env.SIOE_SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };
}

function mapAreaManagers(rows: Record<string, unknown>[] | null): EmailAreaManagerRow[] {
  return (rows ?? []).flatMap((row) => {
    const joined = (
      row as {
        users?: { name: string; is_active: boolean | null } | { name: string; is_active: boolean | null }[] | null;
      }
    ).users;
    const user = Array.isArray(joined) ? joined[0] : joined;
    if (!user || user.is_active === false) return [];
    return [{
      area: row.area as string,
      userId: row.user_id as string,
      userName: user.name ?? null,
    }];
  });
}

export async function fetchMeusClientesPayload(options: {
  authUserId: string;
  viewAll?: boolean;
  filterGestorId?: string | null;
}): Promise<MeusClientesPayload> {
  const publicClient = await createPublicClient();
  const {
    data: { user },
  } = await publicClient.auth.getUser();
  if (!user || user.id !== options.authUserId) {
    throw new Error("Não autenticado.");
  }

  const profile = await resolveProfile(options.authUserId);
  if (!canAccessPath(profile, "/meus-clientes")) {
    throw new Error("Sem permissão para Meus Clientes.");
  }

  const isAdmin = (profile.role ?? "").toLowerCase() === "admin";
  const admin = getAdminClient();

  const [
    { data: companyRows },
    { data: contactRows },
    { data: peopleRows },
    { data: responsibleRows },
    { data: managerRows },
    { data: userRows },
    syncMeta,
    clienteAtividade,
  ] = await Promise.all([
    admin
      .from("email_companies")
      .select("*, email_contacts(count), email_client_groups(id, name, responsible_area)")
      .order("name"),
    admin
      .from("email_contacts")
      .select("*, email_companies(id, name), email_client_groups(id, name, responsible_area)")
      .order("created_at", { ascending: false }),
    admin.from("email_people").select("*, email_client_groups(id, name, responsible_area)").order("name"),
    admin
      .from("email_group_responsibles")
      .select(
        "id, client_group_id, company_id, person_id, area, advogado_responsavel_name, responsible_user_id, open_processes_count"
      ),
    admin
      .from("email_area_managers")
      .select("area, user_id, users!email_area_managers_user_id_fkey(name, is_active)")
      .order("area"),
    admin.from("users").select("id, name, avatar_url").or("is_active.eq.true,is_active.is.null").order("name"),
    fetchSyncMeta(admin),
    fetchSioeClienteAtividadeIndex(),
  ]);

  const allCompanies = filterOutInternalClientGroups(
    (companyRows ?? []).map((row) => mapCompany(row as Record<string, unknown>))
  );
  const allPeople = filterOutInternalClientGroups(
    (peopleRows ?? []).map((row) => mapPerson(row as Record<string, unknown>))
  );
  const allContacts = filterInternalContacts(
    (contactRows ?? []).map((row) => mapContact(row as Record<string, unknown>)),
    allCompanies
  );
  const allResponsibles = filterInternalResponsibles(
    (responsibleRows ?? []).map((row) => mapGroupResponsible(row as Record<string, unknown>)),
    allCompanies,
    allPeople
  );
  const areaManagers = mapAreaManagers(managerRows as Record<string, unknown>[] | null);

  const useFullDataset = isAdmin && options.viewAll && !options.filterGestorId;
  const scopeUserId =
    isAdmin && options.filterGestorId ? options.filterGestorId : profile.id;

  const scope = useFullDataset
    ? null
    : computeMyClientScope(allCompanies, allResponsibles, scopeUserId, areaManagers, allPeople);

  const companies = useFullDataset
    ? allCompanies
    : allCompanies.filter((c) => scope!.companyIds.has(c.id));
  const people = useFullDataset ? allPeople : allPeople.filter((p) => scope!.personIds.has(p.id));

  const companiesById = new Map(allCompanies.map((c) => [c.id, c]));
  const scopedGroupKeys = new Set([
    ...companies.map((c) => resolveClientGroupKey(c)),
    ...people.map((p) => resolveClientGroupKey(p)),
  ]);
  const scopedGroupIds = new Set([
    ...companies.map((c) => c.clientGroupId).filter(Boolean) as string[],
    ...people.map((p) => p.clientGroupId).filter(Boolean) as string[],
  ]);

  const contacts = useFullDataset
    ? allContacts
    : allContacts.filter((c) => scopedGroupKeys.has(resolveContactGroupKey(c, companiesById)));

  const responsibles = useFullDataset
    ? allResponsibles
    : allResponsibles.filter(
        (r) =>
          (r.clientGroupId && scopedGroupIds.has(r.clientGroupId)) ||
          (r.companyId && scope!.companyIds.has(r.companyId)) ||
          (r.personId && scope!.personIds.has(r.personId))
      );

  const systemUsers = (userRows ?? []).map((u) => ({
    id: u.id as string,
    name: u.name as string,
    avatar_url: (u.avatar_url as string | null) ?? null,
  }));

  const clientGroupStatusById: Record<string, ClientGroupGestorStatus> = {};
  if (scopedGroupIds.size > 0) {
    const { data: groupStatusRows, error: groupStatusError } = await admin
      .from("email_client_groups")
      .select(
        "id, gestor_atividade, inativo_encerramento_tipo, contrato_vigencia_termino, rescisao_contratual_data, rescisao_contratual, gestor_atividade_confirmed_at, gestor_atividade_confirmed_by_user_id"
      )
      .in("id", Array.from(scopedGroupIds));
    if (groupStatusError) throw new Error(groupStatusError.message);
    for (const row of groupStatusRows ?? []) {
      clientGroupStatusById[row.id as string] = mapClientGroupGestorStatus(
        row as Record<string, unknown>
      );
    }
  }

  const npsSentByGroupId = await fetchActiveCampaignNpsSentMap(Array.from(scopedGroupIds));

  return {
    companies,
    contacts,
    people,
    responsibles,
    areaManagers,
    systemUsers,
    scope,
    isAdmin,
    syncMeta,
    clienteAtividade,
    clientGroupStatusById,
    npsSentByGroupId,
  };
}

async function loadMeusClientesScopeContext(admin: ReturnType<typeof getAdminClient>) {
  const [{ data: companyRows }, { data: peopleRows }, { data: responsibleRows }, { data: managerRows }] =
    await Promise.all([
      admin.from("email_companies").select("*, email_client_groups(id, name, responsible_area)"),
      admin.from("email_people").select("*, email_client_groups(id, name, responsible_area)"),
      admin
        .from("email_group_responsibles")
        .select(
          "id, client_group_id, company_id, person_id, area, advogado_responsavel_name, responsible_user_id, open_processes_count"
        ),
      admin
        .from("email_area_managers")
        .select("area, user_id, users!email_area_managers_user_id_fkey(name, is_active)")
        .order("area"),
    ]);

  const allCompanies = filterOutInternalClientGroups(
    (companyRows ?? []).map((row) => mapCompany(row as Record<string, unknown>))
  );
  const allPeople = filterOutInternalClientGroups(
    (peopleRows ?? []).map((row) => mapPerson(row as Record<string, unknown>))
  );
  const allResponsibles = filterInternalResponsibles(
    (responsibleRows ?? []).map((row) => mapGroupResponsible(row as Record<string, unknown>)),
    allCompanies,
    allPeople
  );
  const areaManagers = mapAreaManagers(managerRows as Record<string, unknown>[] | null);
  return { allCompanies, allPeople, allResponsibles, areaManagers };
}

function userCanAccessClientGroup(
  clientGroupId: string,
  profile: AccessProfile & { id: string },
  isAdmin: boolean,
  context: Awaited<ReturnType<typeof loadMeusClientesScopeContext>>
): boolean {
  if (isAdmin) return true;
  const scope = computeMyClientScope(
    context.allCompanies,
    context.allResponsibles,
    profile.id,
    context.areaManagers,
    context.allPeople
  );
  for (const company of context.allCompanies) {
    if (company.clientGroupId !== clientGroupId) continue;
    if (scope.companyIds.has(company.id)) return true;
  }
  for (const person of context.allPeople) {
    if (person.clientGroupId !== clientGroupId) continue;
    if (scope.personIds.has(person.id)) return true;
  }
  return false;
}

export async function updateClientGroupGestorStatus(options: {
  authUserId: string;
  clientGroupId: string;
  input: UpdateClientGroupGestorStatusInput;
}): Promise<ClientGroupGestorStatus> {
  const publicClient = await createPublicClient();
  const {
    data: { user },
  } = await publicClient.auth.getUser();
  if (!user || user.id !== options.authUserId) {
    throw new Error("Não autenticado.");
  }

  const profile = await resolveProfile(options.authUserId);
  if (!canAccessPath(profile, "/meus-clientes")) {
    throw new Error("Sem permissão para Meus Clientes.");
  }

  const validationError = validateClientGroupGestorStatusInput(options.input);
  if (validationError) throw new Error(validationError);

  const isAdmin = (profile.role ?? "").toLowerCase() === "admin";
  const admin = getAdminClient();
  const context = await loadMeusClientesScopeContext(admin);

  if (!userCanAccessClientGroup(options.clientGroupId, profile, isAdmin, context)) {
    throw new Error("Sem permissão para editar este grupo.");
  }

  const payload: Record<string, unknown> = {
    gestor_atividade: options.input.gestorAtividade,
    gestor_atividade_confirmed_at: new Date().toISOString(),
    gestor_atividade_confirmed_by_user_id: profile.id,
    updated_at: new Date().toISOString(),
  };

  if (options.input.gestorAtividade === "ativo") {
    payload.inativo_encerramento_tipo = null;
    payload.contrato_vigencia_termino = null;
    payload.rescisao_contratual_data = null;
    payload.rescisao_contratual = false;
  } else if (options.input.inativoEncerramentoTipo === "termino_vigencia") {
    payload.inativo_encerramento_tipo = "termino_vigencia";
    payload.contrato_vigencia_termino = options.input.contratoVigenciaTermino?.trim() ?? null;
    payload.rescisao_contratual_data = null;
    payload.rescisao_contratual = false;
  } else {
    payload.inativo_encerramento_tipo = "rescisao_contratual";
    payload.contrato_vigencia_termino = null;
    payload.rescisao_contratual_data = options.input.rescisaoContratualData?.trim() ?? null;
    payload.rescisao_contratual = true;
  }

  const { data, error } = await admin
    .from("email_client_groups")
    .update(payload)
    .eq("id", options.clientGroupId)
    .select(
      "gestor_atividade, inativo_encerramento_tipo, contrato_vigencia_termino, rescisao_contratual_data, rescisao_contratual, gestor_atividade_confirmed_at, gestor_atividade_confirmed_by_user_id"
    )
    .single();

  if (error) throw new Error(error.message);
  return mapClientGroupGestorStatus(data as Record<string, unknown>);
}

export async function updateClientGroupResponsibleArea(options: {
  authUserId: string;
  clientGroupId: string;
  responsibleArea: string | null;
}): Promise<string | null> {
  const publicClient = await createPublicClient();
  const {
    data: { user },
  } = await publicClient.auth.getUser();
  if (!user || user.id !== options.authUserId) {
    throw new Error("Não autenticado.");
  }

  const profile = await resolveProfile(options.authUserId);
  if (!canAccessPath(profile, "/meus-clientes")) {
    throw new Error("Sem permissão para Meus Clientes.");
  }
  const isAdmin = (profile.role ?? "").toLowerCase() === "admin";
  if (!isAdmin) {
    throw new Error("Somente administradores podem definir a área responsável.");
  }

  const normalized = options.responsibleArea
    ? normalizeLegalArea(options.responsibleArea) ?? options.responsibleArea.trim()
    : null;
  const responsibleArea = normalized?.trim() ? normalized : null;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("email_client_groups")
    .update({
      responsible_area: responsibleArea,
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.clientGroupId)
    .select("responsible_area")
    .single();

  if (error) throw new Error(error.message);
  return normalizeLegalArea((data?.responsible_area as string | null) ?? null);
}
