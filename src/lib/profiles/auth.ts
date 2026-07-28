import "server-only";

/**
 * Fronteira de autorização da administração de perfis profissionais.
 *
 * Intencionalmente NÃO reutiliza `requireNfcManager()`: aquele portão também
 * aceita quem tem apenas a permissão de seção `/nfc`, e perfis carregam dado
 * pessoal de colaborador (contato, foto, trajetória). Aqui só passa o papel
 * `admin` de verdade — a mesma régua usada nas policies da migração.
 */

import { createClient as createSsrClient } from "@/utils/supabase/server";
import {
  ProfileHttpError,
  assertProfileAdminRole,
  createProfileAdminClient,
} from "@/lib/profiles/admin";

export { createProfileAdminClient };

export interface ProfessionalProfileAdmin {
  authUserId: string;
  userId: string;
  role: "admin";
  name: string;
}

/** Exige papel `admin`. A permissão `/nfc` sozinha resulta em 403. */
export async function requireProfessionalProfileAdmin(): Promise<ProfessionalProfileAdmin> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) {
    throw new ProfileHttpError("Não autenticado.", 401, "PROFILE_UNAUTHENTICATED");
  }

  const admin = createProfileAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, name, role, permissions")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error) {
    throw new ProfileHttpError(
      "Não foi possível validar o acesso.",
      500,
      "PROFILE_ACCESS_LOOKUP_FAILED"
    );
  }
  if (!data) {
    throw new ProfileHttpError("Usuário sem cadastro no sistema.", 403, "PROFILE_FORBIDDEN");
  }

  assertProfileAdminRole({
    role: (data.role as string | null) ?? null,
    permissions: (data.permissions as string[] | null) ?? [],
  });

  return {
    authUserId: user.id,
    userId: data.id as string,
    role: "admin",
    name: (data.name as string | null) ?? "",
  };
}
