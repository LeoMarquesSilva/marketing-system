import { supabase } from "@/utils/supabase/client";
import { canSeeHome, firstAllowedPath, isPe27OnlyProfile, resolveAllowedSections } from "@/lib/access-control";
import { isContentCollaborator, isContentManager } from "@/lib/content-areas";
import { sanitizeNextPath } from "@/lib/login-redirect";

export { loginPathWithReturn, resolveRequestedNext, sanitizeNextPath } from "@/lib/login-redirect";

export interface PostLoginProfile {
  department?: string | null;
  role?: string | null;
  must_change_password?: boolean | null;
  permissions?: string[] | null;
}

/** Destino após login — mesma regra usada no AuthGuard e no formulário de login. */
export function resolvePostLoginPathFromProfile(
  profile: PostLoginProfile | null | undefined,
  next?: string | null
): string {
  if (profile?.must_change_password) return "/alterar-senha";

  const safeNext = sanitizeNextPath(next);
  if (safeNext) return safeNext;

  // Quem enxerga a tela inicial entra por ela; quem tem seções liberadas, pela primeira delas.
  const allowed = resolveAllowedSections(profile);
  if (canSeeHome(profile) || isPe27OnlyProfile(profile) || (allowed && allowed.length > 0)) {
    return firstAllowedPath(profile);
  }

  // Sem permissões marcadas (modo legado): colaborador vai ao desempenho; gestor, ao dashboard de marketing.
  if (isContentCollaborator(profile)) return "/conteudo/inicio";
  if (isContentManager(profile)) return firstAllowedPath(profile);
  return "/conteudo/inicio";
}

/** Busca perfil na sessão atual e devolve a rota pós-login. */
export async function resolvePostLoginPath(next?: string | null): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return sanitizeNextPath(next) ?? "/";

  const { data: profile } = await supabase
    .from("users")
    .select("department, role, must_change_password, permissions")
    .eq("auth_id", session.user.id)
    .maybeSingle();

  return resolvePostLoginPathFromProfile(profile, next);
}
