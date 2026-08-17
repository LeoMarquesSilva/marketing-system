import { supabase as browserSupabase } from "@/utils/supabase/client";
import type { UserAuthActivity } from "@/lib/users-auth-activity";

export interface User {
  id: string;
  name: string;
  email: string | null;
  department: string;
  avatar_url: string | null;
  photo_onedrive_url?: string | null;
  photo_collected?: boolean;
  photo_collected_at?: string | null;
  is_active: boolean;
  role?: string | null;
  auth_id?: string | null;
  permissions?: string[] | null;
  must_change_password?: boolean | null;
  last_seen_at?: string | null;
  auth_activity?: UserAuthActivity | null;
}

const USER_LIST_SELECT =
  "id, name, email, department, avatar_url, photo_onedrive_url, photo_collected, photo_collected_at, is_active, role, auth_id, permissions, must_change_password, last_seen_at";

const ACTIVE_USER_SELECT = "id, name, email, department, avatar_url, is_active";

const DESIGNER_SELECT = "id, name, email, department, avatar_url, is_active, role";

/** Browser: cliente com sessão. Servidor: service role (sem importar next/headers). */
async function getUsersDb() {
  if (typeof window !== "undefined") return browserSupabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(url, serviceKey);
  }

  console.warn("SUPABASE_SERVICE_ROLE_KEY ausente — fetchUsers no servidor usando chave anon.");
  const { createClient } = await import("@supabase/supabase-js");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
  return createClient(url, anonKey);
}

export async function fetchUsers(): Promise<User[]> {
  const db = await getUsersDb();
  const { data, error } = await db.from("users").select(USER_LIST_SELECT).order("name");

  if (error) {
    console.error("Erro ao buscar usuários:", error.message, error.code, error.details);
    return [];
  }
  return (data ?? []).map((u) => ({ ...u, is_active: u.is_active ?? true })) as User[];
}

export async function fetchActiveUsers(): Promise<User[]> {
  const db = await getUsersDb();
  const { data, error } = await db
    .from("users")
    .select(ACTIVE_USER_SELECT)
    .or("is_active.eq.true,is_active.is.null")
    .order("name");

  if (error) {
    console.error("Erro ao buscar usuários ativos:", error.message, error.code, error.details);
    return [];
  }
  return (data ?? []) as User[];
}

/**
 * Busca usuários que podem ser designados como designers.
 * Filtra no banco por role = 'designer' OU department = 'Marketing'.
 */
export async function fetchDesigners(): Promise<User[]> {
  const db = await getUsersDb();
  const { data: byRole, error: roleError } = await db
    .from("users")
    .select(DESIGNER_SELECT)
    .eq("role", "designer")
    .or("is_active.eq.true,is_active.is.null")
    .order("name");

  if (!roleError && byRole && byRole.length > 0) {
    return byRole as User[];
  }

  const { data: byDept, error: deptError } = await db
    .from("users")
    .select(DESIGNER_SELECT)
    .eq("department", "Marketing")
    .or("is_active.eq.true,is_active.is.null")
    .order("name");

  if (deptError) {
    console.error("Erro ao buscar designers:", deptError.message, deptError.code, deptError.details);
    return [];
  }
  return (byDept ?? []) as User[];
}

export interface CreateUserInput {
  name: string;
  email?: string | null;
  department: string;
  avatar_url?: string | null;
}

type UserMutationResult = { data: User | null; error: string | null };

async function parseMutationResponse(response: Response): Promise<UserMutationResult> {
  const payload = (await response.json().catch(() => ({}))) as {
    user?: User;
    error?: string;
  };
  if (!response.ok) {
    return { data: null, error: payload.error ?? "Erro ao salvar usuário." };
  }
  return { data: payload.user ?? null, error: null };
}

async function userMutation(
  url: string,
  method: "POST" | "PATCH",
  body?: Record<string, unknown>
): Promise<UserMutationResult> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return parseMutationResponse(response);
}

export async function createUser(
  input: CreateUserInput
): Promise<{ data: User | null; error: string | null }> {
  return userMutation("/api/admin/users", "POST", { ...input });
}

export interface UpdateUserInput {
  name?: string;
  email?: string | null;
  department?: string;
  avatar_url?: string | null;
  photo_onedrive_url?: string | null;
  photo_collected?: boolean;
  photo_collected_at?: string | null;
  is_active?: boolean;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<{ data: User | null; error: string | null }> {
  return userMutation(`/api/admin/users/${encodeURIComponent(id)}`, "PATCH", {
    ...input,
  });
}

export async function toggleUserActive(
  id: string
): Promise<{ data: User | null; error: string | null }> {
  return userMutation(
    `/api/admin/users/${encodeURIComponent(id)}/toggle-active`,
    "POST"
  );
}

export async function deleteUser(
  id: string
): Promise<{ error: string | null }> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return { error: response.ok ? null : payload.error ?? "Erro ao excluir usuário." };
}

export type UpdateOwnProfileInput = Pick<
  UpdateUserInput,
  "name" | "email" | "department" | "avatar_url"
>;

export async function updateOwnProfile(input: UpdateOwnProfileInput): Promise<UserMutationResult> {
  return userMutation("/api/account/profile", "PATCH", { ...input });
}
