/**
 * Normalização de nomes de áreas jurídicas vindos do SIOE / Meus Clientes.
 * Mantém "Recuperação de Crédito" como subárea (agrupada sob Cível na UI).
 *
 * Nomenclatura oficial:
 * - Reestruturação (não usar mais "Insolvência")
 * - Societário e Contratos (não usar mais "Contratos")
 */

function areaKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const AREA_CANONICAL: Record<string, string> = {
  // Reestruturação (legado: Insolvência)
  insolvencia: "Reestruturação",
  "civel | insolvencia": "Reestruturação",
  "civel|insolvencia": "Reestruturação",
  "reestruturacao (insolvencia)": "Reestruturação",
  reestruturacao: "Reestruturação",
  // Societário e Contratos (legado: Contratos / Societário e Contrato)
  contratos: "Societário e Contratos",
  "societario e contrato": "Societário e Contratos",
  "societario e contratos": "Societário e Contratos",
};

/** Áreas cadastradas só como subárea — gestores vêm da área pai. */
export const SUBAREA_ONLY = new Set(["Recuperação de Crédito"]);

export function isSubareaOnlyManagerArea(area: string): boolean {
  const normalized = normalizeLegalArea(area);
  return SUBAREA_ONLY.has(normalized ?? area);
}

export function normalizeLegalArea(area: string | null | undefined): string | null {
  if (!area) return null;
  const trimmed = area.trim();
  if (!trimmed) return null;
  return AREA_CANONICAL[areaKey(trimmed)] ?? trimmed;
}

export function normalizeLegalAreas(areas: string[] | null | undefined): string[] {
  if (!areas?.length) return [];
  const set = new Set<string>();
  for (const area of areas) {
    const normalized = normalizeLegalArea(area);
    if (normalized) set.add(normalized);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Traduz o "department" do usuário (nome interno da área de prática) para o
 * vocabulário de área usado no SIOE/Meus Clientes.
 */
const DEPARTMENT_TO_SIOE_AREA: Record<string, string> = {
  Cível: "Cível",
  Trabalhista: "Trabalhista",
  "Operações Legais": "Operações Legais",
  Tributário: "Tributário",
  Reestruturação: "Reestruturação",
  Insolvência: "Reestruturação",
  "Societário e Contratos": "Societário e Contratos",
  Contratos: "Societário e Contratos",
  "Distressed Deals - Special Situations": "Special Situations",
};

/** Departamentos internos que não são área de prática jurídica — sem área correspondente. */
export function departmentToSioeArea(department: string | null | undefined): string | null {
  if (!department) return null;
  return DEPARTMENT_TO_SIOE_AREA[department.trim()] ?? null;
}
