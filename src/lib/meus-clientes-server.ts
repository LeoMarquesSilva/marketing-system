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
import { isSubareaOnlyManagerArea } from "@/lib/legal-areas";
import { canAccessPath, type AccessProfile } from "@/lib/access-control";

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
  return (rows ?? [])
    .map((row) => {
      const joined = (row as { users?: { name: string } | { name: string }[] | null }).users;
      const userName = Array.isArray(joined) ? (joined[0]?.name ?? null) : (joined?.name ?? null);
      return {
        area: row.area as string,
        userId: row.user_id as string,
        userName,
      };
    })
    .filter((row) => !isSubareaOnlyManagerArea(row.area));
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
  ] = await Promise.all([
    admin
      .from("email_companies")
      .select("*, email_contacts(count), email_client_groups(id, name)")
      .order("name"),
    admin
      .from("email_contacts")
      .select("*, email_companies(id, name), email_client_groups(id, name)")
      .order("created_at", { ascending: false }),
    admin.from("email_people").select("*, email_client_groups(id, name)").order("name"),
    admin
      .from("email_group_responsibles")
      .select(
        "id, client_group_id, company_id, person_id, area, advogado_responsavel_name, responsible_user_id, open_processes_count"
      ),
    admin
      .from("email_area_managers")
      .select("area, user_id, users!email_area_managers_user_id_fkey(name)")
      .order("area"),
    admin.from("users").select("id, name, avatar_url").or("is_active.eq.true,is_active.is.null").order("name"),
    fetchSyncMeta(admin),
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
    : computeMyClientScope(allCompanies, allResponsibles, scopeUserId, areaManagers);

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
  };
}
