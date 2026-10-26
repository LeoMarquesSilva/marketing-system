import { describe, expect, it } from "vitest";
import {
  ageBand,
  applyPeopleFilters,
  averageAge,
  NOT_INFORMED,
  peopleFilterOptions,
  profileDistribution,
  tenureBand,
  yearsSince,
} from "./people-filters";
import type { EmployeeRegistrationRow } from "./types";

const NOW = new Date("2026-10-26T12:00:00Z");

function row(overrides: Partial<EmployeeRegistrationRow>): EmployeeRegistrationRow {
  return {
    employeeId: Math.random().toString(36).slice(2),
    fullName: "Pessoa",
    email: null,
    avatarUrl: null,
    department: "Cível",
    position: null,
    employmentType: "CLT",
    vinculoLabel: "CLT",
    kind: "clt",
    isActive: true,
    admissionDate: null,
    formId: null,
    formOrigin: null,
    status: "sem_envio",
    submittedAt: null,
    approvedAt: null,
    requiredCount: 26,
    filledCount: 10,
    missingFields: ["bankName"],
    gender: "",
    raceColor: "",
    age: null,
    residenceCity: "",
    residenceState: "",
    dietaryRestrictions: [],
    oab: "na",
    ...overrides,
  };
}

describe("faixas", () => {
  it("idade e tempo de casa em anos completos", () => {
    expect(yearsSince("1990-10-27", NOW)).toBe(35);
    expect(yearsSince("1990-10-26", NOW)).toBe(36);
    expect(ageBand(24)).toBe("ate24");
    expect(ageBand(25)).toBe("25a34");
    expect(ageBand(60)).toBe("55mais");
    expect(ageBand(null)).toBe(NOT_INFORMED);
    expect(tenureBand("2026-03-01", NOW)).toBe("menos1");
    expect(tenureBand("2023-10-26", NOW)).toBe("3a5");
    expect(tenureBand(null, NOW)).toBe(NOT_INFORMED);
  });
});

describe("filtros de pessoas", () => {
  const rows = [
    row({ fullName: "Ana", gender: "feminino", raceColor: "parda", age: 30, department: "Cível" }),
    row({ fullName: "Bia", gender: "feminino", raceColor: "branca", age: 41, department: "Trabalhista" }),
    row({ fullName: "Caio", gender: "masculino", raceColor: "preta", age: 22, department: "Cível" }),
    row({ fullName: "Davi", gender: "", raceColor: "", age: null, department: "Cível", dietaryRestrictions: ["vegano", "lactose"] }),
  ];

  it("soma dentro do filtro e restringe entre filtros", () => {
    const names = (selection: Parameters<typeof applyPeopleFilters>[1]) =>
      applyPeopleFilters(rows, selection, NOW).map((item) => item.fullName);
    expect(names({ race: ["parda", "preta"] })).toEqual(["Ana", "Caio"]);
    expect(names({ race: ["parda", "preta"], gender: ["feminino"] })).toEqual(["Ana"]);
    expect(names({ gender: [NOT_INFORMED] })).toEqual(["Davi"]);
    expect(names({ diet: ["lactose"] })).toEqual(["Davi"]);
  });

  it("conta cada opção considerando os outros filtros", () => {
    const gender = peopleFilterOptions("gender", rows, { area: ["Cível"] }, NOW);
    expect(gender.map((option) => [option.value, option.count])).toEqual([
      ["feminino", 1],
      ["masculino", 1],
      [NOT_INFORMED, 1],
    ]);
    // A opção marcada aparece mesmo zerada.
    const zero = peopleFilterOptions("gender", rows, { area: ["Trabalhista"], gender: ["masculino"] }, NOW);
    expect(zero.find((option) => option.value === "masculino")?.count).toBe(0);
  });

  it("perfil da equipe mostra percentuais e o não informado", () => {
    const race = profileDistribution("race", rows, NOW);
    expect(race.find((bucket) => bucket.value === NOT_INFORMED)).toMatchObject({ count: 1, percent: 25 });
    expect(averageAge(rows)).toBe(31);
  });
});
