/**
 * Predicado compartilhado de acesso ao módulo RH (Férias + Qualificações).
 *
 * Chave canônica: `/rh`. A chave legada `/ferias` foi migrada e removida —
 * quem ainda tinha só ela já foi atualizado para `/rh` no banco.
 */

export const RH_PERMISSION_KEY = "/rh";

export function hasHrAccess(
  role: string | null | undefined,
  permissions: string[] | null | undefined
): boolean {
  if ((role ?? "").toLowerCase() === "admin") return true;
  const list = permissions ?? [];
  return list.includes(RH_PERMISSION_KEY);
}
