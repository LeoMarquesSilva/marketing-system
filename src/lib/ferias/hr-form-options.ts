/**
 * Opções fechadas da ficha de colaborador (RH).
 * Área e cargo não são texto livre — evita divergência com o que o sistema
 * usa em filtros, cronograma e cadastro de usuários.
 */

export const HR_DEPARTMENT_OPTIONS = [
  "Cível",
  "Geral",
  "Institucional",
  "Marketing",
  "Operações Legais",
  "Recuperação de Crédito",
  "Recursos Humanos",
  "Reestruturação",
  "Societário e Contratos",
  "Sócio",
  "Trabalhista",
  "Tributário",
] as const;

export const HR_POSITION_OPTIONS = [
  "Advogado",
  "Advogado Júnior",
  "Advogado Pleno",
  "Advogado Sênior",
  "Advogada Pleno Controller",
  "Analista de Desenvolvimento de Soluções",
  "Analista de Processos Gerenciais",
  "Analista Júnior",
  "Assistente Administrativo",
  "Assistente Financeiro Pleno",
  "Assistente Jurídico",
  "Auxiliar de Limpeza",
  "Coordenador",
  "Coordenador Comercial",
  "Especialista em Gestão Operacional",
  "Estagiário",
  "Estagiário de Marketing",
  "Gerente",
  "Sócio de Área",
  "Sócio Patrimonial",
  "Supervisor",
] as const;

function withCurrentValue(
  options: readonly string[],
  current: string | null | undefined
): string[] {
  const trimmed = current?.trim() ?? "";
  const set = new Set<string>(options);
  if (trimmed) set.add(trimmed);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Opções de área, incluindo valor legado ainda cadastrado. */
export function listHrDepartmentOptions(current?: string | null): string[] {
  return withCurrentValue(HR_DEPARTMENT_OPTIONS, current);
}

/** Opções de cargo, incluindo valor legado ainda cadastrado. */
export function listHrPositionOptions(current?: string | null): string[] {
  return withCurrentValue(HR_POSITION_OPTIONS, current);
}
