/**
 * Acesso ao módulo Operações Legais no ORQESTRAI.
 *
 * Só a área Operações Legais (department no cadastro) e admin.
 * Não inclui Marketing / Facilities / RH — esses agrupam em Ops só no filtro de Férias.
 */

export const OPERACOES_LEGAIS_PERMISSION_KEY = "/operacoes-legais";

function departmentKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Department de prática = Operações Legais (não os braços administrativos). */
export function isOperacoesLegaisDepartment(
  department: string | null | undefined
): boolean {
  return departmentKey(department) === "operacoes legais";
}

export function isOperacoesLegaisPath(pathname: string): boolean {
  return (
    pathname === OPERACOES_LEGAIS_PERMISSION_KEY ||
    pathname.startsWith(`${OPERACOES_LEGAIS_PERMISSION_KEY}/`)
  );
}

export type OperacoesLegaisAccessProfile = {
  role?: string | null;
  department?: string | null;
  permissions?: string[] | null;
};

export function hasOperacoesLegaisAccess(
  profile: OperacoesLegaisAccessProfile | null | undefined
): boolean {
  if (!profile) return false;
  if ((profile.role ?? "").toLowerCase() === "admin") return true;
  if (profile.permissions?.includes(OPERACOES_LEGAIS_PERMISSION_KEY)) return true;
  return isOperacoesLegaisDepartment(profile.department);
}
