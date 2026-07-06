import { describe, expect, it } from "vitest";
import {
  compareGroupsByPendingFirst,
  countGroupMembers,
  countGroupPendingMembers,
  filterPeopleNotInContacts,
  groupHasNoContacts,
  groupIsPending,
  mergeGroupMembers,
  expandRootArea,
  filterOutInternalClientGroups,
  getAreaParent,
  isInternalClientGroupName,
  userCoversEntityArea,
} from "@/lib/meus-clientes";
import { personNameKey } from "@/lib/email-marketing-normalize";
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

  it("grupo sem contatos conta como pendente, não completo", () => {
    expect(groupHasNoContacts([], [])).toBe(true);
    expect(groupIsPending([], [])).toBe(true);
    expect(countGroupPendingMembers([], [])).toBe(1);
  });

  it("ordena grupos vazios antes dos completos", () => {
    const contactsByGroup = new Map<string, EmailContact[]>([
      [
        "g2",
        [
          {
            id: "2",
            email: "b@test.com",
            name: "Completo",
            phone: "11999999999",
            cargo: "CEO",
            invitesClassifiedByUserId: "u1",
          } as EmailContact,
        ],
      ],
    ]);
    const groups = [
      { key: "g-empty", name: "Vazio", groupPeople: [] as EmailPerson[] },
      { key: "g2", name: "Beta", groupPeople: [] as EmailPerson[] },
    ];
    const sorted = [...groups].sort((a, b) => compareGroupsByPendingFirst(a, b, contactsByGroup, (g) => g.key));
    expect(sorted[0].key).toBe("g-empty");
  });
});

describe("RD × SIOE deduplication", () => {
  const metalcastyContacts = [
    {
      id: "c-andre",
      email: "andre@metalcasty.com.br",
      name: "ANDRE ANSELMO CASTILHO",
    },
    {
      id: "c-fernanda",
      email: "fernanda@metalcasty.com.br",
      name: "Fernanda Anselmo Castilho Gasparotto",
    },
  ] as EmailContact[];

  const metalcastyPeople = [
    { id: "p-andre", name: "Andre Anselmo Castilho", email: null },
    { id: "p-fernanda", name: "FERNANDA ANSELMO CASTILHO GASPAROTTO", email: null },
    { id: "p-clovis", name: "CLOVIS CASTILHO", email: null },
  ] as EmailPerson[];

  it("normaliza nomes RD e SIOE para a mesma chave", () => {
    expect(personNameKey("ANDRE ANSELMO CASTILHO")).toBe(personNameKey("Andre Anselmo Castilho"));
    expect(personNameKey("Fernanda Anselmo Castilho Gasparotto")).toBe(
      personNameKey("FERNANDA ANSELMO CASTILHO GASPAROTTO")
    );
  });

  it("remove pessoas SIOE duplicadas de contatos RD (Metalcasty)", () => {
    const deduped = filterPeopleNotInContacts(metalcastyPeople, metalcastyContacts);
    expect(deduped.map((p) => p.id)).toEqual(["p-clovis"]);
  });

  it("conta membros do grupo sem duplicar Andre/Fernanda", () => {
    expect(countGroupMembers(metalcastyPeople, metalcastyContacts)).toBe(3);
    const { contacts, people } = mergeGroupMembers(metalcastyContacts, metalcastyPeople);
    expect(contacts).toHaveLength(2);
    expect(people).toHaveLength(1);
  });
});
