import { describe, expect, it } from "vitest";
import {
  compareGroupsByPendingFirst,
  countGroupPendingMembers,
  expandRootArea,
  filterOutInternalClientGroups,
  getAreaParent,
  isInternalClientGroupName,
  userCoversEntityArea,
} from "@/lib/meus-clientes";
import { normalizeLegalArea, normalizeLegalAreas } from "@/lib/legal-areas";
import type { EmailCompany, EmailContact, EmailPerson } from "@/lib/email-marketing";

describe("legal-areas", () => {
  it("normaliza Cível | Insolvência para Insolvência", () => {
    expect(normalizeLegalArea("Cível | Insolvência")).toBe("Insolvência");
  });

  it("deduplica áreas normalizadas", () => {
    expect(normalizeLegalAreas(["Cível | Insolvência", "Insolvência"])).toEqual(["Insolvência"]);
  });
});

describe("meus-clientes scope", () => {
  it("identifica grupo interno Bismarchi Pires", () => {
    expect(isInternalClientGroupName("Bismarchi Pires")).toBe(true);
    expect(isInternalClientGroupName("Grupo ABC")).toBe(false);
  });

  it("filtra grupos internos", () => {
    const items = [
      { name: "Bismarchi Pires" },
      { name: "Grupo Cliente" },
    ] as EmailCompany[];
    expect(filterOutInternalClientGroups(items)).toHaveLength(1);
  });

  it("expande subárea Recuperação de Crédito sob Cível", () => {
    expect(expandRootArea("Cível")).toEqual(expect.arrayContaining(["Cível", "Recuperação de Crédito"]));
    expect(getAreaParent("Recuperação de Crédito")).toBe("Cível");
  });

  it("gestor de Cível cobre Recuperação de Crédito", () => {
    const areas = new Set(["Cível"]);
    expect(userCoversEntityArea(areas, "Recuperação de Crédito")).toBe(true);
  });
});

describe("group sorting", () => {
  it("ordena grupos com mais pendências primeiro", () => {
    const contactsByGroup = new Map<string, EmailContact[]>([
      [
        "g1",
        [
          {
            id: "1",
            email: "a@test.com",
            name: null,
            phone: null,
            cargo: null,
          } as EmailContact,
        ],
      ],
      [
        "g2",
        [
          {
            id: "2",
            email: "b@test.com",
            name: "Completo",
            phone: "11999999999",
            cargo: "CEO",
          } as EmailContact,
        ],
      ],
    ]);

    const groups = [
      { key: "g1", name: "Alpha", groupPeople: [] as EmailPerson[] },
      { key: "g2", name: "Beta", groupPeople: [] as EmailPerson[] },
    ];

    const sorted = [...groups].sort((a, b) => compareGroupsByPendingFirst(a, b, contactsByGroup, (g) => g.key));
    expect(sorted[0].key).toBe("g1");
    expect(countGroupPendingMembers([], contactsByGroup.get("g1") ?? [])).toBeGreaterThan(0);
  });
});
