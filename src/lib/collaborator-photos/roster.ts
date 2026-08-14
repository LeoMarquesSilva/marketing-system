import {
  departmentMatchesAreaFilter,
  resolveAreaFilterLabel,
} from "@/lib/ferias/filters";

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

/**
 * Áreas para os botões — mesma regra de Férias
 * (Marketing/Financeiro/Facilities/Limpeza/RH → Operações Legais).
 */
export function listPhotoRosterAreas(people: PhotoRosterPerson[]): string[] {
  const set = new Set<string>();
  for (const person of people) {
    const label = resolveAreaFilterLabel(person.department);
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
      if (!departmentMatchesAreaFilter(person.department, opts.department)) return false;
      const count = person.userId ? opts.photoCountByUserId[person.userId] ?? 0 : 0;
      if (opts.gallery === "com_fotos" && count === 0) return false;
      if (opts.gallery === "sem_fotos" && count > 0) return false;
      if (!q) return true;
      const haystack = `${person.name} ${person.department ?? ""} ${person.position ?? ""}`;
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
