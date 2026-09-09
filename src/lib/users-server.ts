import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import type { UserAuthActivity } from "@/lib/users-auth-activity";
import type { HrEmployeeSummary, User } from "@/lib/users";
import { hasHrAccess } from "@/lib/rh/access";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const USER_SELECT =
  "id, name, email, department, avatar_url, photo_onedrive_url, photo_collected, photo_collected_at, is_active, role, auth_id, permissions, ferias_access_mode, ferias_area_scope, ferias_view_enabled, must_change_password, last_seen_at";

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createAdminClient(supabaseUrl, supabaseServiceKey);
}

/** Cliente Supabase no servidor: service role quando disponível, senão sessão via cookies. */
export async function getServerDb() {
  if (supabaseServiceKey) return getAdminClient();
  return createServerClient();
}

/** Lista usuários no servidor (sem cache estático do Next). */
export async function fetchUsersServer(): Promise<User[]> {
  const db = await getServerDb();

  if (!supabaseServiceKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY ausente — fetchUsersServer usando cliente anon.");
  }

  const { data, error } = await db.from("users").select(USER_SELECT).order("name");

  if (error) {
    console.error("Erro ao buscar usuários (server):", error);
    return [];
  }

  return (data ?? []).map((u) => ({ ...u, is_active: u.is_active ?? true })) as User[];
}

/** Fichas de RH (`hr_employees`) já vinculadas a um login, indexadas por `user_id`. */
export async function fetchHrEmployeesByUserId(): Promise<Record<string, HrEmployeeSummary>> {
  const db = await getServerDb();
  const { data, error } = await db
    .from("hr_employees")
    .select("id, user_id, position, employment_type, department, admission_date")
    .not("user_id", "is", null);

  if (error) {
    console.error("Erro ao buscar fichas de RH:", error);
    return {};
  }

  const result: Record<string, HrEmployeeSummary> = {};
  for (const row of (data ?? []) as HrEmployeeSummary[]) {
    if (row.user_id) result[row.user_id] = row;
  }
  return result;
}

/** O usuário logado (via cookies de sessão) tem acesso ao módulo de RH? */
export async function resolveViewerHasHrAccess(): Promise<boolean> {
  const ssr = await createServerClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return false;

  const db = await getServerDb();
  const { data } = await db
    .from("users")
    .select("role, permissions")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!data) return false;

  return hasHrAccess(data.role as string | null, data.permissions as string[] | null);
}

/** Dados de login do Supabase Auth, indexados pelo id da tabela `users`. */
export async function fetchUsersAuthActivity(): Promise<Record<string, UserAuthActivity>> {
  if (!supabaseServiceKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY ausente — atividade de login indisponível.");
    return {};
  }

  const db = getAdminClient();
  const { data: linkedUsers, error: usersError } = await db
    .from("users")
    .select("id, auth_id")
    .not("auth_id", "is", null);

  if (usersError) {
    console.error("Erro ao buscar usuários com login:", usersError);
    return {};
  }

  const authIdToUserId = new Map<string, string>();
  for (const row of linkedUsers ?? []) {
    if (row.auth_id) authIdToUserId.set(row.auth_id, row.id);
  }
  if (authIdToUserId.size === 0) return {};

  const result: Record<string, UserAuthActivity> = {};
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Erro ao listar usuários do Auth:", error);
      break;
    }

    for (const authUser of data.users) {
      const userId = authIdToUserId.get(authUser.id);
      if (!userId) continue;
      result[userId] = {
        account_created_at: authUser.created_at ?? null,
        last_sign_in_at: authUser.last_sign_in_at ?? null,
        email_confirmed_at: authUser.email_confirmed_at ?? null,
      };
    }

    if (data.users.length < perPage) break;
    page += 1;
  }

  return result;
}
