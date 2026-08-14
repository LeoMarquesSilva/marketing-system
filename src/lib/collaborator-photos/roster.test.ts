import { describe, expect, it } from "vitest";
import {
  computePhotoRosterStats,
  filterPhotoRoster,
  listPhotoRosterAreas,
  PHOTO_ROSTER_INCLUDED_VACATION_EXEMPT_IDS,
  resolvePhotoRosterAreaLabel,
  type PhotoRosterPerson,
} from "@/lib/collaborator-photos/roster";

const people: PhotoRosterPerson[] = [
  {
    employeeId: "e1",
    userId: "u1",
    name: "Ana",
    email: "ana@x.com",
    department: "Limpeza",
    position: null,
    isActive: true,
    avatarUrl: null,
  },
  {
    employeeId: "e2",
    userId: "u2",
    name: "Bruno",
    email: null,
    department: "Insolvência",
    position: "Advogado",
    isActive: true,
    avatarUrl: null,
  },
  {
    employeeId: "e3",
    userId: null,
    name: "Carla",
    email: null,
    department: "Marketing",
    position: null,
    isActive: false,
    avatarUrl: null,
  },
];

describe("listPhotoRosterAreas", () => {
  it("agrupa Limpeza/Marketing em Operações Legais como em Férias", () => {
    expect(listPhotoRosterAreas(people)).toEqual(["Operações Legais", "Reestruturação"]);
  });
});

describe("filterPhotoRoster", () => {
  it("filtra Operações Legais incluindo Limpeza e Marketing", () => {
    const filtered = filterPhotoRoster(people, {
      search: "",
      department: "Operações Legais",
      situation: "all",
      gallery: "all",
      photoCountByUserId: {},
    });
    expect(filtered.map((p) => p.name).sort()).toEqual(["Ana", "Carla"]);
  });

  it("usa ativos por padrão e prioriza quem ainda não tem foto", () => {
    const filtered = filterPhotoRoster(people, {
      search: "",
      department: "all",
      situation: "ativos",
      gallery: "all",
      photoCountByUserId: { u1: 2, u2: 0 },
    });
    expect(filtered.map((p) => p.name)).toEqual(["Bruno", "Ana"]);
  });

  it("filtra por galeria e busca área/cargo", () => {
    const filtered = filterPhotoRoster(people, {
      search: "advogado",
      department: "all",
      situation: "ativos",
      gallery: "sem_fotos",
      photoCountByUserId: { u1: 2, u2: 0 },
    });
    expect(filtered.map((p) => p.name)).toEqual(["Bruno"]);
  });
});

describe("computePhotoRosterStats", () => {
  it("conta quem tem fotos na galeria", () => {
    expect(computePhotoRosterStats(people.slice(0, 2), { u1: 1, u2: 0 })).toEqual({
      total: 2,
      withPhotos: 1,
      withoutPhotos: 1,
    });
  });
});

describe("PHOTO_ROSTER_INCLUDED_VACATION_EXEMPT_IDS", () => {
  it("inclui Gustavo Bismarchi e Ricardo Pires na gestão de fotos", () => {
    expect(PHOTO_ROSTER_INCLUDED_VACATION_EXEMPT_IDS).toEqual([
      "3da9c5f0-cf80-4743-aea9-76ec5c80ddb2",
      "1948ec31-133f-402d-9f66-27b6b5eea093",
    ]);
  });

  it("busca Insolvência pelo nome canônico Reestruturação", () => {
    const filtered = filterPhotoRoster(people, {
      search: "reestruturação",
      department: "all",
      situation: "ativos",
      gallery: "all",
      photoCountByUserId: {},
    });
    expect(filtered.map((p) => p.name)).toEqual(["Bruno"]);
  });

  it("mantém Gustavo e Ricardo apenas na área Sócio", () => {
    const gustavo: PhotoRosterPerson = {
      ...people[0],
      employeeId: "3da9c5f0-cf80-4743-aea9-76ec5c80ddb2",
      name: "Gustavo Bismarchi Motta",
      department: "Facilities",
    };
    const ricardo: PhotoRosterPerson = {
      ...people[0],
      employeeId: "1948ec31-133f-402d-9f66-27b6b5eea093",
      name: "Ricardo Viscardi Pires",
      department: "Sócio",
    };

    expect(resolvePhotoRosterAreaLabel(gustavo)).toBe("Sócio");
    expect(resolvePhotoRosterAreaLabel(ricardo)).toBe("Sócio");
    expect(listPhotoRosterAreas([gustavo, ricardo])).toEqual(["Sócio"]);

    const socios = filterPhotoRoster([gustavo, ricardo], {
      search: "",
      department: "Sócio",
      situation: "ativos",
      gallery: "all",
      photoCountByUserId: {},
    });
    expect(socios.map((person) => person.name)).toEqual([
      "Gustavo Bismarchi Motta",
      "Ricardo Viscardi Pires",
    ]);
  });
});
