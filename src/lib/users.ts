import { supabase } from "@/utils/supabase/client";

export interface User {
  id: string;
  name: string;
  email: string | null;
  department: string;
  avatar_url: string | null;
  is_active: boolean;
  role?: string | null;
}

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, department, avatar_url, is_active")
    .order("name");

  if (error) {
    console.error("Erro ao buscar usuários:", error);
    return [];
  }
  return (data ?? []).map((u) => ({ ...u, is_active: u.is_active ?? true })) as User[];
}

export async function fetchActiveUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, department, avatar_url, is_active")
    .or("is_active.eq.true,is_active.is.null")
    .order("name");

  if (error) {
    console.error("Erro ao buscar usuários ativos:", error);
    return [];
  }
  return (data ?? []) as User[];
}

/**
 * Busca usuários que podem ser designados como designers.
 * Filtra no banco por role = 'designer' OU department = 'Marketing'.
 */
export async function fetchDesigners(): Promise<User[]> {
  // Primeiro tenta filtrar por role (requer coluna role na tabela)
  const { data: byRole, error: roleError } = await supabase
    .from("users")
    .select("id, name, email, department, avatar_url, is_active, role")
    .eq("role", "designer")
    .or("is_active.eq.true,is_active.is.null")
    .order("name");

  if (!roleError && byRole && byRole.length > 0) {
    return byRole as User[];
  }

  // Fallback: filtra por department = 'Marketing'
  const { data: byDept, error: deptError } = await supabase
    .from("users")
    .select("id, name, email, department, avatar_url, is_active, role")
    .eq("department", "Marketing")
    .or("is_active.eq.true,is_active.is.null")
    .order("name");

  if (deptError) {
    console.error("Erro ao buscar designers:", deptError);
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

export async function createUser(
  input: CreateUserInput
): Promise<{ data: User | null; error: string | null }> {
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: crypto.randomUUID(),
      name: input.name.trim(),
      email: input.email?.trim() || null,
      department: input.department.trim(),
      avatar_url: input.avatar_url || null,
      is_active: true,
    })
    .select("id, name, email, department, avatar_url, is_active")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as User, error: null };
}

export interface UpdateUserInput {
  name?: string;
  email?: string | null;
  department?: string;
  avatar_url?: string | null;
  is_active?: boolean;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<{ data: User | null; error: string | null }> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.email !== undefined) updates.email = input.email?.trim() || null;
  if (input.department !== undefined) updates.department = input.department.trim();
  if (input.avatar_url !== undefined) updates.avatar_url = input.avatar_url || null;
  if (input.is_active !== undefined) updates.is_active = input.is_active;

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("id, name, email, department, avatar_url, is_active")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as User, error: null };
}

export async function toggleUserActive(
  id: string
): Promise<{ data: User | null; error: string | null }> {
  const { data: current } = await supabase
    .from("users")
    .select("is_active")
    .eq("id", id)
    .single();

  if (!current) return { data: null, error: "Usuário não encontrado" };
  const newActive = !(current.is_active ?? true);

  return updateUser(id, { is_active: newActive });
}

export async function deleteUser(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}
