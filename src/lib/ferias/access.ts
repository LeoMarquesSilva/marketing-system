import { departmentMatchesAreaFilter, resolveCanonicalAreaLabel } from "@/lib/ferias/filters";
import { hasHrAccess } from "@/lib/rh/access";

export type FeriasAccessMode = "auto" | "disabled" | "custom";
export type FeriasAccessLevel = "denied" | "viewer" | "editor";

export interface FeriasAccess {
  level: FeriasAccessLevel;
  /** `null` representa visão global; array vazio representa acesso negado. */
  areas: string[] | null;
}

export interface FeriasAccessInput {
  role: string | null | undefined;
  permissions: string[] | null | undefined;
  accessMode: FeriasAccessMode | null | undefined;
  areaScope: string[] | null | undefined;
  position: string | null | undefined;
  department: string | null | undefined;
}

const AUTO_VIEWER_POSITIONS = new Set([
  "gerente",
  "coordenador",
  "coordenador comercial",
  "supervisor",
  "socio",
  "socio de area",
  "socio patrimonial",
]);

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function canonicalizeAreas(areas: string[]): string[] {
  const canonical = areas
    .map((area) => resolveCanonicalAreaLabel(area))
    .filter((area): area is string => Boolean(area));
  return [...new Set(canonical)];
}

export function resolveFeriasAccess(input: FeriasAccessInput): FeriasAccess {
  if (hasHrAccess(input.role, input.permissions)) {
    return { level: "editor", areas: null };
  }

  const mode = input.accessMode ?? "auto";
  if (mode === "disabled") return { level: "denied", areas: [] };

  if (mode === "custom") {
    const scope = input.areaScope ?? [];
    if (scope.includes("*")) return { level: "viewer", areas: null };
    const areas = canonicalizeAreas(scope);
    return areas.length > 0
      ? { level: "viewer", areas }
      : { level: "denied", areas: [] };
  }

  if (!AUTO_VIEWER_POSITIONS.has(normalize(input.position))) {
    return { level: "denied", areas: [] };
  }

  const area = resolveCanonicalAreaLabel(input.department);
  return area
    ? { level: "viewer", areas: [area] }
    : { level: "denied", areas: [] };
}

export function employeeMatchesFeriasAccess(
  department: string | null | undefined,
  access: FeriasAccess
): boolean {
  if (access.level === "denied") return false;
  if (access.areas === null) return true;
  return access.areas.some((area) => departmentMatchesAreaFilter(department, area));
}

export function isFeriasEditor(access: FeriasAccess): boolean {
  return access.level === "editor";
}

export function redactFeriasEmployee<
  T extends {
    user_id: string | null;
    cpf: string | null;
    email: string | null;
    notes: string | null;
    vios_ci: string | null;
  },
>(employee: T, access: FeriasAccess): T {
  if (isFeriasEditor(access)) return employee;
  return {
    ...employee,
    user_id: null,
    cpf: null,
    email: null,
    notes: null,
    vios_ci: null,
  };
}
