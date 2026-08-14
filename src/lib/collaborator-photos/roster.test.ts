import { describe, expect, it } from "vitest";
import {
  computePhotoRosterStats,
  filterPhotoRoster,
  listPhotoRosterAreas,
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
    expect(listPhotoRosterAreas(people)).toEqual(["Insolvência", "Operações Legais"]);
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
