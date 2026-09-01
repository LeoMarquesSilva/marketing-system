export const GUSTAVO_CONTENT_PATH = "/conteudo/gustavo";

export type GustavoMemberRole = "owner" | "editor";

export interface GustavoContentProfile {
  role?: string | null;
  /** Membership explícita em `gustavo_content_members`. Nunca inferir por nome. */
  gustavo_content_member?: boolean | null;
  gustavo_content_member_role?: GustavoMemberRole | null;
  id?: string;
  name?: string | null;
  department?: string | null;
  permissions?: string[] | null;
}

export function isGustavoContentPath(pathname: string): boolean {
  return pathname === GUSTAVO_CONTENT_PATH || pathname.startsWith(`${GUSTAVO_CONTENT_PATH}/`);
}

/**
 * Acesso ao módulo de posicionamento do Gustavo.
 * Somente admin ou membership em `gustavo_content_members`.
 * Marketing, designer, sócio e permissões de `/conteudo/roteiros` NÃO liberam.
 */
export function canAccessGustavoContent(
  profile: GustavoContentProfile | null | undefined
): boolean {
  if (!profile) return false;
  if ((profile.role ?? "").toLowerCase() === "admin") return true;
  return profile.gustavo_content_member === true;
}
