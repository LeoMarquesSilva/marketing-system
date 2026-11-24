import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { employeeMatchesFeriasAccess, resolveFeriasAccess, type FeriasAccessMode } from "@/lib/ferias/access";
import { hasHrAccess } from "@/lib/rh/access";
import { loadPeopleDirectory, type DirectoryPerson } from "@/lib/rh/people-directory";
import { collectReports, type EmployeeLink } from "@/lib/rh/pdi/team";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import type { PdiPerson } from "@/lib/rh/pdi/types";

/**
 * Quem está usando e quem ela lidera — base do PDI e das 1:1.
 * Equipe = liderados diretos e indiretos (gestor direto) + liderança por área (a mesma de Férias).
 */
export interface TeamContext {
  db: SupabaseClient;
  userId: string;
  name: string;
  isAdmin: boolean;
  isHr: boolean;
  employeeId: string | null;
  /** Quem a pessoa lidera. Nunca inclui ela mesma. */
  team: Set<string>;
  people: Map<string, PdiPerson>;
  links: Map<string, EmployeeLink>;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function createRhServiceClient(): SupabaseClient {
  if (!serviceKey) throw new RhHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function toPerson(person: DirectoryPerson): PdiPerson {
  return {
    id: person.id,
    name: person.short_name,
    full_name: person.full_name,
    department: person.department,
    position: person.position,
    avatar_url: person.avatar_url,
    is_active: person.is_active,
  };
}

export const UNKNOWN_PERSON: PdiPerson = {
  id: "",
  name: "Colaborador removido",
  full_name: "Colaborador removido",
  department: null,
  position: null,
  avatar_url: null,
  is_active: false,
};

export function personOf(ctx: TeamContext, id: string | null): PdiPerson | null {
  if (!id) return null;
  return ctx.people.get(id) ?? { ...UNKNOWN_PERSON, id };
}

/**
 * Monta o contexto da sessão. `gate` recebe o perfil antes de carregar o cadastro e pode
 * barrar o acesso (ex.: módulo em teste só para admin ou RH).
 */
export async function resolveTeamContext(
  tag: string,
  gate?: (profile: { isAdmin: boolean; isHr: boolean }) => void
): Promise<TeamContext> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new RhHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const db = createRhServiceClient();
  const { data: profile, error: profileError } = await db
    .from("users")
    .select("id, name, role, permissions, ferias_access_mode, ferias_area_scope")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (profileError || !profile) throw new RhHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");

  const role = (profile.role as string | null) ?? null;
  const permissions = (profile.permissions as string[] | null) ?? [];
  const isAdmin = (role ?? "").toLowerCase() === "admin";
  const isHr = hasHrAccess(role, permissions);
  gate?.({ isAdmin, isHr });

  const [directory, linksResult] = await Promise.all([
    loadPeopleDirectory(db, tag),
    db.from("hr_employees").select("id, user_id, manager_employee_id, department, position, is_active, is_automation"),
  ]);
  if (linksResult.error) {
    console.error(`[${tag}] vínculos:`, linksResult.error);
    throw new RhHttpError("Falha ao carregar o cadastro.", 500, "QUERY_FAILED");
  }

  const people = new Map(directory.map((person) => [person.id, toPerson(person)]));
  const links = new Map<string, EmployeeLink>();
  let self: { id: string; position: string | null; department: string | null } | null = null;
  for (const row of linksResult.data ?? []) {
    if (row.is_automation) continue;
    links.set(row.id as string, {
      id: row.id as string,
      manager_employee_id: (row.manager_employee_id as string | null) ?? null,
      department: (row.department as string | null) ?? null,
      is_active: Boolean(row.is_active),
    });
    if (row.user_id === profile.id) {
      self = { id: row.id as string, position: row.position as string | null, department: row.department as string | null };
    }
  }

  const team = new Set<string>();
  if (self) {
    for (const id of collectReports(self.id, links.values())) team.add(id);
    const area = resolveFeriasAccess({
      role: null,
      permissions: [],
      accessMode: profile.ferias_access_mode as FeriasAccessMode | null,
      areaScope: profile.ferias_area_scope as string[] | null,
      position: self.position,
      department: self.department,
    });
    if (area.level === "viewer") {
      for (const link of links.values()) {
        if (link.is_active && employeeMatchesFeriasAccess(link.department, area)) team.add(link.id);
      }
    }
    team.delete(self.id);
  }

  return {
    db,
    userId: profile.id as string,
    name: profile.name as string,
    isAdmin,
    isHr,
    employeeId: self?.id ?? null,
    team,
    people,
    links,
  };
}
