/** Áreas jurídicas usadas em content_roteiros (classificação IA). */
export const LEGAL_AREAS = [
  "Cível",
  "Trabalhista",
  "Reestruturação",
  "Societário e Contratos",
  "Operações Legais (Legal Ops)",
] as const;

export type LegalArea = (typeof LEGAL_AREAS)[number];

/** Mapeia department (tabela users / areas) → áreas jurídicas de conteúdo. */
const DEPARTMENT_TO_LEGAL_AREAS: Record<string, LegalArea[]> = {
  Cível: ["Cível"],
  Trabalhista: ["Trabalhista"],
  Reestruturação: ["Reestruturação"],
  Insolvência: ["Reestruturação"],
  "Societário e Contratos": ["Societário e Contratos"],
  Contratos: ["Societário e Contratos"],
  "Operações Legais": ["Operações Legais (Legal Ops)"],
};

/** Departamentos com visão de todas as áreas (sócios, marketing, etc.). */
const ALL_AREAS_DEPARTMENTS = new Set(["Marketing", "Institucional", "Sócio"]);

/**
 * Reverso de DEPARTMENT_TO_LEGAL_AREAS: dada uma área jurídica (usada em
 * content_roteiros.area), retorna os nomes de departamento correspondentes
 * (como aparecem em instagram_posts.area). Usado para cruzar performance.
 */
export function getDepartmentsForLegalArea(area: LegalArea | string): string[] {
  return Object.entries(DEPARTMENT_TO_LEGAL_AREAS)
    .filter(([, areas]) => areas.includes(area as LegalArea))
    .map(([department]) => department)
    .filter((department) => department !== "Insolvência" && department !== "Contratos");
}

export function getLegalAreasForDepartment(department: string): LegalArea[] {
  const trimmed = department.trim();
  if (!trimmed) return [];

  const exact = DEPARTMENT_TO_LEGAL_AREAS[trimmed];
  if (exact) return exact;

  if (ALL_AREAS_DEPARTMENTS.has(trimmed)) {
    return [...LEGAL_AREAS];
  }

  // Fallback: correspondência parcial (ex.: variações de nome)
  const lower = trimmed.toLowerCase();
  const matched = LEGAL_AREAS.filter(
    (area) =>
      area.toLowerCase().includes(lower) || lower.includes(area.toLowerCase().split(" ")[0] ?? "")
  );
  return matched.length > 0 ? matched : [];
}

export interface ContentAccessProfile {
  role?: string | null;
  department?: string | null;
}

/** Marketing, admin e designer gerenciam conteúdo (busca RSS, filtros globais). */
export function isContentManager(profile: ContentAccessProfile | null | undefined): boolean {
  if (!profile) return false;
  const role = (profile.role ?? "").toLowerCase();
  return role === "admin" || role === "designer" || profile.department === "Marketing";
}

/** Colaborador de área jurídica — vê e aprova posts da sua área. */
export function isContentCollaborator(profile: ContentAccessProfile | null | undefined): boolean {
  if (!profile || isContentManager(profile)) return false;
  return getLegalAreasForDepartment(profile.department ?? "").length > 0;
}

/**
 * Quem pode colar um link e gerar post: gestores de conteúdo e colaboradores
 * de área (ex.: Operações Legais). A IA classifica a área; o post entra
 * aguardando aprovação.
 */
export function canCreateRoteiroFromLink(
  profile: ContentAccessProfile | null | undefined
): boolean {
  return isContentManager(profile) || isContentCollaborator(profile);
}

/** null = acesso a todas as áreas; array vazio = sem acesso a conteúdo por área. */
export function getAllowedLegalAreas(profile: ContentAccessProfile | null | undefined): LegalArea[] | null {
  if (!profile) return [];
  if (isContentManager(profile)) return null;

  const areas = getLegalAreasForDepartment(profile.department ?? "");
  return areas;
}

export function canAccessContentArea(
  profile: ContentAccessProfile | null | undefined,
  area: string
): boolean {
  const allowed = getAllowedLegalAreas(profile);
  if (allowed === null) return true;
  return allowed.includes(area as LegalArea);
}

export const AREA_COLORS: Record<string, string> = {
  Cível: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200/60",
  Trabalhista: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60",
  Reestruturação:
    "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/60",
  "Societário e Contratos":
    "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/60",
  "Operações Legais (Legal Ops)":
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60",
  // Legado — área inativa, só para exibir posts antigos.
  "Distressed Deals":
    "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200/60",
};

export const DEFAULT_AREA_STYLE =
  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/60";

export function getAreaStyle(area: string) {
  return AREA_COLORS[area] ?? DEFAULT_AREA_STYLE;
}

/** Cor sólida (bg-*) por área, para usar como ponto/acento discreto. */
export const AREA_DOT_COLORS: Record<string, string> = {
  Cível: "bg-violet-500",
  Trabalhista: "bg-amber-500",
  Reestruturação: "bg-rose-500",
  "Societário e Contratos": "bg-sky-500",
  "Operações Legais (Legal Ops)": "bg-emerald-500",
  "Distressed Deals": "bg-orange-500",
};

export function getAreaDotColor(area: string) {
  return AREA_DOT_COLORS[area] ?? "bg-slate-400";
}

export const STATUS_LABELS: Record<string, string> = {
  aguardando_aprovacao: "A validar",
  em_revisao: "Em revisão",
  aprovado_revisor: "Gestor aprovou",
  enviado_mkt: "Enviado ao MKT",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};
