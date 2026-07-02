import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import type { UserAuthActivity } from "@/lib/users-auth-activity";
import type { User } from "@/lib/users";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const USER_SELECT =
  "id, name, email, department, avatar_url, photo_onedrive_url, photo_collected, photo_collected_at, is_active, role, auth_id, permissions, must_change_password, last_seen_at";

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createAdminClient(supabaseUrl, supabaseServiceKey);
}

/** Lista usuários no servidor (sem cache estático do Next). */
export async function fetchUsersServer(): Promise<User[]> {
  const db = supabaseServiceKey
    ? getAdminClient()
    : await createServerClient();

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
