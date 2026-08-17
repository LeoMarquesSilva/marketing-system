export interface LawyerIdentificationTarget {
  name?: string | null;
  user_name?: string | null;
  position?: string | null;
  department?: string | null;
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Contas ou pessoas que não entram na lista de advogados, mesmo com cargo jurídico. */
const EXCLUDED_NAME_TOKENS = ["zamboni", "camila", "consul"] as const;

function isExcludedLawyerName(target: LawyerIdentificationTarget): boolean {
  const haystack = `${normalizeKey(target.name)} ${normalizeKey(target.user_name)}`;
  return EXCLUDED_NAME_TOKENS.some((token) => haystack.includes(token));
}

function isFinanceiroDepartment(department: string | null | undefined): boolean {
  return normalizeKey(department) === "financeiro";
}

/**
 * Identifica advogados pelo cargo do cadastro de RH:
 * - qualquer cargo que comece com "Advogado"
 * - Gerente
 * - Coordenador, exceto o do Financeiro
 *
 * Zamboni, Camila e Gabriela Consul ficam de fora por nome.
 * A área financeira é lida do departamento bruto, não do agrupamento canônico.
 */
export function isLawyerCollaborator(
  target: LawyerIdentificationTarget
): boolean {
  if (isExcludedLawyerName(target)) return false;

  const position = normalizeKey(target.position);
  if (!position) return false;
  if (position.startsWith("advogad")) return true;
  if (position === "gerente") return true;
  if (position === "coordenador") {
    return !isFinanceiroDepartment(target.department);
  }
  return false;
}
