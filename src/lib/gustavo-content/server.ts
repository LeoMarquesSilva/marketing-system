import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isAdminRole } from "@/lib/access-control";
import {
  canAccessGustavoContent,
  type GustavoMemberRole,
} from "@/lib/gustavo-content/access";
import { GustavoContentError } from "@/lib/gustavo-content/errors";

export { GustavoContentError };

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function getGustavoContentAdmin() {
  if (!supabaseServiceKey) {
    throw new GustavoContentError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 500);
  }
  return createAdminClient(supabaseUrl, supabaseServiceKey);
}

export interface GustavoContentActor {
  authId: string;
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  isAdmin: boolean;
  memberRole: GustavoMemberRole | null;
}

export async function requireGustavoContentAccess(): Promise<GustavoContentActor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new GustavoContentError("Não autenticado.", 401);
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    throw new GustavoContentError("Perfil não encontrado.", 403);
  }

  const isAdmin = isAdminRole(profile);
  let memberRole: GustavoMemberRole | null = null;

  if (!isAdmin) {
    const admin = getGustavoContentAdmin();
    const { data: membership } = await admin
      .from("gustavo_content_members")
      .select("member_role")
      .eq("user_id", profile.id)
      .maybeSingle();
    const role = membership?.member_role;
    memberRole = role === "owner" || role === "editor" ? role : null;
  }

  if (
    !canAccessGustavoContent({
      role: profile.role,
      gustavo_content_member: isAdmin || memberRole !== null,
    })
  ) {
    throw new GustavoContentError("Sem permissão para o módulo de posicionamento.", 403);
  }

  return {
    authId: user.id,
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    isAdmin,
    memberRole,
  };
}

export function gustavoContentErrorResponse(err: unknown): Response {
  const status = err instanceof GustavoContentError ? err.status : 500;
  const message =
    err instanceof GustavoContentError
      ? err.message
      : "Erro no módulo de posicionamento.";
  return Response.json({ error: message }, { status });
}
