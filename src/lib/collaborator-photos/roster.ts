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

export type PhotoRosterSituation = "ativos" | "todos";

export function filterPhotoRoster(
  people: PhotoRosterPerson[],
  opts: {
    search: string;
    department: string;
    situation: PhotoRosterSituation;
    gallery: "all" | "com_fotos" | "sem_fotos";
    photoCountByUserId: Record<string, number>;
  }
): PhotoRosterPerson[] {
  const q = opts.search.trim().toLowerCase();
  return people
    .filter((person) => {
      if (opts.situation === "ativos" && !person.isActive) return false;
      if (q && !person.name.toLowerCase().includes(q)) return false;
      if (opts.department !== "all" && person.department !== opts.department) return false;
      const count = person.userId ? opts.photoCountByUserId[person.userId] ?? 0 : 0;
      if (opts.gallery === "com_fotos" && count === 0) return false;
      if (opts.gallery === "sem_fotos" && count > 0) return false;
      return true;
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
