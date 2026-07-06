import { supabase } from "@/utils/supabase/client";
import { firstAllowedPath, resolveAllowedSections } from "@/lib/access-control";
import { isContentCollaborator, isContentManager } from "@/lib/content-areas";

export interface PostLoginProfile {
  department?: string | null;
  role?: string | null;
  must_change_password?: boolean | null;
  permissions?: string[] | null;
}

/** Destino após login — mesma regra usada no AuthGuard e no formulário de login. */
export function resolvePostLoginPathFromProfile(
  profile: PostLoginProfile | null | undefined
): string {
  if (profile?.must_change_password) return "/alterar-senha";

  const allowed = resolveAllowedSections(profile);
  if (allowed && allowed.length > 0) return firstAllowedPath(profile);

  if (isContentCollaborator(profile)) return "/conteudo/inicio";
  if (isContentManager(profile)) return "/";
  return "/conteudo/inicio";
}

/** Busca perfil na sessão atual e devolve a rota pós-login. */
export async function resolvePostLoginPath(next?: string | null): Promise<string> {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return "/";

  const { data: profile } = await supabase
    .from("users")
    .select("department, role, must_change_password, permissions")
    .eq("auth_id", session.user.id)
    .maybeSingle();

  return resolvePostLoginPathFromProfile(profile);
}
