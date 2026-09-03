/**
 * Normalização de nomes de áreas jurídicas vindos do SIOE / Meus Clientes.
 *
 * Nomenclatura oficial:
 * - Reestruturação (não usar mais "Insolvência")
 * - Societário e Contratos (não usar mais "Contratos")
 * - Recuperação de Crédito é área autônoma (não agrupa sob Cível)
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

/**
 * Áreas que o processo do SIOE deve preservar mesmo quando o advogado
 * casado tem outro department (ex.: processo de Recuperação de Crédito
 * com advogado cadastrado no Cível).
 */
export const KEEP_SIOE_PROCESS_AREA = new Set(["Recuperação de Crédito"]);

/** @deprecated Use KEEP_SIOE_PROCESS_AREA — Recuperação de Crédito não é mais subárea. */
export const SUBAREA_ONLY = KEEP_SIOE_PROCESS_AREA;

export function isSubareaOnlyManagerArea(area: string): boolean {
  const normalized = normalizeLegalArea(area);
  return KEEP_SIOE_PROCESS_AREA.has(normalized ?? area);
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
  "Recuperação de Crédito": "Recuperação de Crédito",
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

/** Áreas de prática sempre oferecidas no seletor de gestor, mesmo sem clientes cadastrados. */
export const DEFAULT_AREA_MANAGER_AREAS = [
  "Cível",
  "Trabalhista",
  "Reestruturação",
  "Societário e Contratos",
  "Recuperação de Crédito",
  "Operações Legais",
  "Tributário",
  "Special Situations",
];

export function mergeAreaManagerPickerAreas(known: string[]): string[] {
  return normalizeLegalAreas([...DEFAULT_AREA_MANAGER_AREAS, ...known]);
}
