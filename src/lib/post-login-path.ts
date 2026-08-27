import { supabase } from "@/utils/supabase/client";
import { firstAllowedPath, resolveAllowedSections } from "@/lib/access-control";
import { isContentCollaborator, isContentManager } from "@/lib/content-areas";

export interface PostLoginProfile {
  department?: string | null;
  role?: string | null;
  must_change_password?: boolean | null;
  permissions?: string[] | null;
}

/** Destino interno seguro para `?next=`. Rejeita URL absoluta, protocol-relative e /login. */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  const pathOnly = trimmed.split("?")[0] ?? "";
  if (pathOnly === "/login" || pathOnly.startsWith("/login/")) return null;
  return trimmed;
}

/** Login com retorno para a página que a pessoa tentou abrir. */
export function loginPathWithReturn(pathname: string, search = ""): string {
  if (pathname === "/login" || pathname.startsWith("/login/")) return "/login";
  const safe = sanitizeNextPath(`${pathname}${search}`);
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}

/** Destino após login — mesma regra usada no AuthGuard e no formulário de login. */
export function resolvePostLoginPathFromProfile(
  profile: PostLoginProfile | null | undefined,
  next?: string | null
): string {
  if (profile?.must_change_password) return "/alterar-senha";

  const safeNext = sanitizeNextPath(next);
  if (safeNext) return safeNext;

  const allowed = resolveAllowedSections(profile);
  if (allowed && allowed.length > 0) return firstAllowedPath(profile);

  if (isContentCollaborator(profile)) return "/conteudo/inicio";
  if (isContentManager(profile)) return "/";
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
