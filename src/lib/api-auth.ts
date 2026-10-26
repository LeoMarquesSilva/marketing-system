import { createClient as createPublicClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  hasCafeCulturaAccess,
  hasIcpAccess,
  hasOperacoesLegaisAccess,
  papelVistagem,
  type PapelVistagem,
} from "@/lib/access-control";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createServiceClient(supabaseUrl, supabaseServiceKey);
}

export async function requireAuthenticatedUser() {
  const supabase = await createPublicClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Não autenticado.");
  }

  const admin = getAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("is_active")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile || profile.is_active === false) {
    throw new Error("Usuário inativo.");
  }
  return user;
}

export async function requireAdminUser(authUserId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.is_active === false) {
    throw new Error("Usuário inativo.");
  }
  const role = (data?.role as string | undefined)?.toLowerCase();
  if (role !== "admin") {
    throw new Error("Apenas administradores podem executar esta ação.");
  }
}

export async function requireCafeCulturaAccess(authUserId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("role, permissions, is_active")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.is_active === false) {
    throw new Error("Usuário inativo.");
  }
  if (
    !hasCafeCulturaAccess({
      role: data.role,
      permissions: (data.permissions as string[] | null) ?? null,
    })
  ) {
    throw new Error("Sem permissão para o Café com Cultura.");
  }
}

export async function requireIcpAccess(authUserId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("role, permissions, is_active")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.is_active === false) {
    throw new Error("Usuário inativo.");
  }
  if (
    !hasIcpAccess({
      role: data.role,
      permissions: (data.permissions as string[] | null) ?? null,
    })
  ) {
    throw new Error("Sem permissão para o ICP.");
  }
}

export async function requireOperacoesLegaisAccess(authUserId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("role, permissions, is_active")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.is_active === false) {
    throw new Error("Usuário inativo.");
  }
  if (
    !hasOperacoesLegaisAccess({
      role: data.role,
      permissions: (data.permissions as string[] | null) ?? null,
    })
  ) {
    throw new Error("Sem permissão para Operações Legais.");
  }
}

/**
 * Papel do usuário na Vistagem e as áreas (escritórios) que ele vista; `areas` null
 * é a controladoria, que vê todas.
 */
export async function requireVistagemAccess(
  authUserId: string
): Promise<{ papel: PapelVistagem; areas: string[] | null }> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("role, permissions, is_active, vistagem_papel, vistagem_areas")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.is_active === false) {
    throw new Error("Usuário inativo.");
  }
  const papel = papelVistagem({
    role: data.role,
    permissions: (data.permissions as string[] | null) ?? null,
    vistagem_papel: data.vistagem_papel as string | null,
  });
  if (!papel) {
    throw new Error("Sem permissão para Vistagem e agendamento.");
  }
  return { papel, areas: papel === "juridico" ? ((data.vistagem_areas as string[] | null) ?? []) : null };
}
