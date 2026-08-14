import { describe, expect, it } from "vitest";
import {
  computePhotoRosterStats,
  filterPhotoRoster,
  type PhotoRosterPerson,
} from "@/lib/collaborator-photos/roster";

const people: PhotoRosterPerson[] = [
  {
    employeeId: "e1",
    userId: "u1",
    name: "Ana",
    email: "ana@x.com",
    department: "RH",
    position: null,
    isActive: true,
    avatarUrl: null,
  },
  {
    employeeId: "e2",
    userId: "u2",
    name: "Bruno",
    email: null,
    department: "Marketing",
    position: null,
    isActive: true,
    avatarUrl: null,
  },
  {
    employeeId: "e3",
    userId: null,
    name: "Carla",
    email: null,
    department: "RH",
    position: null,
    isActive: false,
    avatarUrl: null,
  },
];

describe("filterPhotoRoster", () => {
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

  it("filtra por área e galeria", () => {
    const filtered = filterPhotoRoster(people, {
      search: "",
      department: "RH",
      situation: "todos",
      gallery: "sem_fotos",
      photoCountByUserId: { u1: 2 },
    });
    expect(filtered.map((p) => p.name)).toEqual(["Carla"]);
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
