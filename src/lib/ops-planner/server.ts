import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { OPS_PLANNER_KEY } from "@/lib/access-control";
import { canViewSpace, todayInSaoPaulo, type OpsAccess } from "./domain";
import type { OpsList, OpsMember, OpsPerson, OpsPlannerContext, OpsSpace } from "./types";

export class OpsPlannerHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "OpsPlannerHttpError";
  }
}

export function toOpsApiError(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof OpsPlannerHttpError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  console.error("[ops-planner]", error);
  return { status: 500, body: { error: "Erro interno.", code: "INTERNAL" } };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let cachedDb: SupabaseClient | null = null;

export function getOpsDb(): SupabaseClient {
  if (!serviceKey) {
    throw new OpsPlannerHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  }
  cachedDb ??= createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cachedDb;
}

/** Falha de consulta vira 500 com mensagem genérica (o detalhe fica no log). */
export function dbFail(context: string, error: { message: string } | null): never {
  console.error(`[ops-planner] ${context}`, error?.message);
  throw new OpsPlannerHttpError(`Não foi possível ${context}.`, 500, "QUERY_FAILED");
}

export interface OpsActor extends OpsAccess {
  name: string;
  email: string | null;
}

export const PERSON_SELECT = "id, name, email, department, avatar_url, is_active";
export const SPACE_SELECT = "id, slug, name, description, color, wip_limit, sort_order";
export const LIST_SELECT = "id, space_id, name, color, sort_order";

/** Usuário logado com os papéis nos espaços. Sem espaço, sem permissão e sem admin: 403. */
export async function requireOpsActor(): Promise<OpsActor> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new OpsPlannerHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const db = getOpsDb();
  const { data: profile, error } = await db
    .from("users")
    .select("id, name, email, role, permissions, is_active")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (error || !profile) {
    throw new OpsPlannerHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  }
  if (profile.is_active === false) throw new OpsPlannerHttpError("Usuário inativo.", 403, "INACTIVE");

  const { data: memberships, error: membershipError } = await db
    .from("ops_space_members")
    .select("space_id, user_id, role")
    .eq("user_id", profile.id);
  if (membershipError) dbFail("carregar os seus espaços", membershipError);

  const isAdmin = String(profile.role ?? "").toLowerCase() === "admin";
  const permissions = (profile.permissions as string[] | null) ?? [];
  const actor: OpsActor = {
    userId: profile.id as string,
    name: profile.name as string,
    email: (profile.email as string | null) ?? null,
    isAdmin,
    memberships: (memberships ?? []) as OpsMember[],
  };
  if (!isAdmin && actor.memberships.length === 0 && !permissions.includes(OPS_PLANNER_KEY)) {
    throw new OpsPlannerHttpError("Você não tem acesso ao Planner de Operações Legais.", 403, "FORBIDDEN");
  }
  return actor;
}

/** Espaços que o usuário enxerga (admin: todos). */
export async function listVisibleSpaces(actor: OpsActor): Promise<OpsSpace[]> {
  const { data, error } = await getOpsDb()
    .from("ops_spaces")
    .select(SPACE_SELECT)
    .is("archived_at", null)
    .order("sort_order");
  if (error) dbFail("carregar os espaços", error);
  return ((data ?? []) as OpsSpace[]).filter((space) => canViewSpace(actor, space.id));
}

export async function loadPeople(): Promise<OpsPerson[]> {
  const { data, error } = await getOpsDb().from("users").select(PERSON_SELECT).order("name");
  if (error) dbFail("carregar as pessoas", error);
  return ((data ?? []) as OpsPerson[]).map((person) => ({ ...person, is_active: person.is_active !== false }));
}

/** Tudo o que as telas do Planner precisam para montar seletores, filtros e permissões. */
export async function getPlannerContext(actor: OpsActor): Promise<OpsPlannerContext> {
  const db = getOpsDb();
  const spaces = await listVisibleSpaces(actor);
  const spaceIds = spaces.map((space) => space.id);
  const [lists, members, people] = await Promise.all([
    spaceIds.length
      ? db.from("ops_lists").select(LIST_SELECT).in("space_id", spaceIds).is("archived_at", null).order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    // Responsável pode ser de outro espaço: os seletores mostram todos os membros do Planner.
    db.from("ops_space_members").select("space_id, user_id, role"),
    loadPeople(),
  ]);
  if (lists.error) dbFail("carregar as listas", lists.error);
  if (members.error) dbFail("carregar os membros", members.error);
  const me = people.find((person) => person.id === actor.userId) ?? {
    id: actor.userId,
    name: actor.name,
    email: actor.email,
    department: null,
    avatar_url: null,
    is_active: true,
  };
  return {
    me,
    is_admin: actor.isAdmin,
    spaces,
    lists: (lists.data ?? []) as OpsList[],
    memberships: actor.memberships,
    members: (members.data ?? []) as OpsMember[],
    people,
    today: todayInSaoPaulo(),
  };
}

export async function getSpaceBySlug(actor: OpsActor, slug: string): Promise<OpsSpace> {
  const { data, error } = await getOpsDb()
    .from("ops_spaces")
    .select(SPACE_SELECT)
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (error) dbFail("carregar o espaço", error);
  if (!data) throw new OpsPlannerHttpError("Espaço não encontrado.", 404, "NOT_FOUND");
  if (!canViewSpace(actor, data.id as string)) {
    throw new OpsPlannerHttpError("Você não participa deste espaço.", 403, "FORBIDDEN");
  }
  return data as OpsSpace;
}

/** Ids de todos os membros do Planner (responsáveis válidos). */
export async function plannerMemberIds(): Promise<Set<string>> {
  const { data, error } = await getOpsDb().from("ops_space_members").select("user_id");
  if (error) dbFail("carregar os membros", error);
  return new Set((data ?? []).map((row) => row.user_id as string));
}

/** Líderes e gestores por espaço (escaladas e tarefas sem responsável). */
export async function loadSpaceManagers(): Promise<Map<string, string[]>> {
  const { data, error } = await getOpsDb()
    .from("ops_space_members")
    .select("space_id, user_id, role")
    .in("role", ["lider", "gestor"]);
  if (error) dbFail("carregar a liderança dos espaços", error);
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = map.get(row.space_id as string) ?? [];
    list.push(row.user_id as string);
    map.set(row.space_id as string, list);
  }
  return map;
}
