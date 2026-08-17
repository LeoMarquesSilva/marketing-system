/**
 * Predicado compartilhado de acesso ao módulo RH (Férias + Qualificações).
 *
 * Chave canônica: `/rh`. Aceita `/ferias` durante o rollout para quem ainda
 * tenha a permissão antiga salva em `users.permissions`.
 */

export const RH_PERMISSION_KEY = "/rh";
/** Compatibilidade com permissões legadas do módulo de Férias. */
export const FERIAS_LEGACY_PERMISSION_KEY = "/ferias";

export function hasHrAccess(
  role: string | null | undefined,
  permissions: string[] | null | undefined
): boolean {
  if ((role ?? "").toLowerCase() === "admin") return true;
  const list = permissions ?? [];
  return list.includes(RH_PERMISSION_KEY) || list.includes(FERIAS_LEGACY_PERMISSION_KEY);
}
