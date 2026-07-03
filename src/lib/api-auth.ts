import { createClient as createPublicClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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
  return user;
}

export async function requireAdminUser(authUserId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const role = (data?.role as string | undefined)?.toLowerCase();
  if (role !== "admin") {
    throw new Error("Apenas administradores podem executar esta ação.");
  }
}
