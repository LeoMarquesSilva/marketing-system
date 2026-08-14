import {
  departmentMatchesAreaFilter,
  resolveCanonicalAreaLabel,
  resolveAreaFilterLabel,
} from "@/lib/ferias/filters";

/** Sócios isentos de férias que devem aparecer na gestão de fotos. */
export const PHOTO_ROSTER_INCLUDED_VACATION_EXEMPT_IDS = [
  "3da9c5f0-cf80-4743-aea9-76ec5c80ddb2", // Gustavo Bismarchi Motta
  "1948ec31-133f-402d-9f66-27b6b5eea093", // Ricardo Viscardi Pires
] as const;

/** Pessoa da lista de Fotos Colaboradores — mesma base RH de Férias (`hr_employees`). */
export interface PhotoRosterPerson {
  employeeId: string;
  /** Id em `users` para galeria/storage; null se ainda não tem login no sistema. */
  userId: string | null;
  name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  isActive: boolean;
  avatarUrl: string | null;
}

/** Mesma situação do filtro de Férias. */
export type PhotoRosterSituation = "ativos" | "inativos" | "all";

export type PhotoGalleryFilter = "all" | "com_fotos" | "sem_fotos";

const PHOTO_ROSTER_INCLUDED_VACATION_EXEMPT_ID_SET = new Set<string>(
  PHOTO_ROSTER_INCLUDED_VACATION_EXEMPT_IDS
);

/** Área exibida no módulo; os dois sócios permanecem exclusivamente em "Sócio". */
export function resolvePhotoRosterAreaLabel(
  person: Pick<PhotoRosterPerson, "employeeId" | "department">
): string | null {
  if (PHOTO_ROSTER_INCLUDED_VACATION_EXEMPT_ID_SET.has(person.employeeId)) return "Sócio";
  return resolveCanonicalAreaLabel(person.department);
}

/**
 * Áreas para os botões — mesma regra de Férias
 * (Marketing/Financeiro/Facilities/Limpeza/RH → Operações Legais).
 */
export function listPhotoRosterAreas(people: PhotoRosterPerson[]): string[] {
  const set = new Set<string>();
  for (const person of people) {
    const label = resolveAreaFilterLabel(resolvePhotoRosterAreaLabel(person));
    if (label) set.add(label);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function filterPhotoRoster(
  people: PhotoRosterPerson[],
  opts: {
    search: string;
    department: string;
    situation: PhotoRosterSituation;
    gallery: PhotoGalleryFilter;
    photoCountByUserId: Record<string, number>;
  }
): PhotoRosterPerson[] {
  const q = opts.search.trim().toLowerCase();
  return people
    .filter((person) => {
      if (opts.situation === "ativos" && !person.isActive) return false;
      if (opts.situation === "inativos" && person.isActive) return false;
      const areaLabel = resolvePhotoRosterAreaLabel(person);
      if (!departmentMatchesAreaFilter(areaLabel, opts.department)) return false;
      const count = person.userId ? opts.photoCountByUserId[person.userId] ?? 0 : 0;
      if (opts.gallery === "com_fotos" && count === 0) return false;
      if (opts.gallery === "sem_fotos" && count > 0) return false;
      if (!q) return true;
      const canonicalArea = areaLabel ?? "";
      const haystack = `${person.name} ${person.department ?? ""} ${canonicalArea} ${person.position ?? ""}`;
      return haystack.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const aCount = a.userId ? opts.photoCountByUserId[a.userId] ?? 0 : 0;
      const bCount = b.userId ? opts.photoCountByUserId[b.userId] ?? 0 : 0;
      if ((aCount === 0) !== (bCount === 0)) return aCount === 0 ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

export function computePhotoRosterStats(
  people: PhotoRosterPerson[],
  photoCountByUserId: Record<string, number>
) {
  const withPhotos = people.filter(
    (person) => (person.userId ? photoCountByUserId[person.userId] ?? 0 : 0) > 0
  ).length;
  return {
    total: people.length,
    withPhotos,
    withoutPhotos: people.length - withPhotos,
  };
}
