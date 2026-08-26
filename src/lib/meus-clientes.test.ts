import { describe, expect, it } from "vitest";
import {
  buildClientGroupKeysForAreaFilter,
  buildClientGroupKeysWithoutArea,
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
  applyEffectiveResponsibleAreas,
  computeMyClientScope,
  resolveEffectiveResponsibleArea,
} from "@/lib/meus-clientes";
import { personNameKey } from "@/lib/email-marketing-normalize";
import { normalizeLegalArea, normalizeLegalAreas } from "@/lib/legal-areas";
import type { EmailCompany, EmailContact, EmailGroupResponsible, EmailPerson } from "@/lib/email-marketing";

describe("legal-areas", () => {
  it("normaliza Insolvência e aliases para Reestruturação", () => {
    expect(normalizeLegalArea("Insolvência")).toBe("Reestruturação");
    expect(normalizeLegalArea("Cível | Insolvência")).toBe("Reestruturação");
    expect(normalizeLegalArea("Reestruturação (Insolvência)")).toBe("Reestruturação");
  });

  it("normaliza Contratos para Societário e Contratos", () => {
    expect(normalizeLegalArea("Contratos")).toBe("Societário e Contratos");
    expect(normalizeLegalArea("Societário e Contrato")).toBe("Societário e Contratos");
  });

  it("deduplica áreas normalizadas", () => {
    expect(normalizeLegalAreas(["Cível | Insolvência", "Insolvência", "Reestruturação"])).toEqual([
      "Reestruturação",
    ]);
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

describe("buildClientGroupKeysWithoutArea", () => {
  it("exclui grupo quando alguma empresa do grupo tem área", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g1",
        clientGroupName: "Grupo Misto",
        legalAreas: ["Trabalhista"],
      },
      {
        id: "c2",
        clientGroupId: "g1",
        clientGroupName: "Grupo Misto",
        legalAreas: [],
      },
    ] as EmailCompany[];

    const withoutArea = buildClientGroupKeysWithoutArea(companies, [], new Map(), []);
    expect(withoutArea.has("g1")).toBe(false);
  });

  it("inclui grupo apenas quando nenhuma entidade tem área", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g2",
        clientGroupName: "Grupo Limpo",
        legalAreas: [] as string[],
      },
    ] as EmailCompany[];
    const people = [
      {
        id: "p1",
        clientGroupId: "g2",
        clientGroupName: "Grupo Limpo",
      },
    ] as EmailPerson[];

    const withoutArea = buildClientGroupKeysWithoutArea(companies, people, new Map(), []);
    expect(withoutArea.has("g2")).toBe(true);
  });
});

describe("buildClientGroupKeysForAreaFilter", () => {
  it("inclui o grupo inteiro quando só uma empresa tem a área", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "gy",
        clientGroupName: "Grupo Y",
        legalAreas: ["Trabalhista"],
      },
      {
        id: "c2",
        clientGroupId: "gy",
        clientGroupName: "Grupo Y",
        legalAreas: [],
      },
    ] as EmailCompany[];

    const matching = buildClientGroupKeysForAreaFilter(
      "Trabalhista",
      companies,
      [],
      new Map(),
      []
    );
    expect(matching.has("gy")).toBe(true);
  });

  it("sem área só quando nenhuma entidade do grupo tem área", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "gy",
        clientGroupName: "Grupo Y",
        legalAreas: ["Trabalhista"],
      },
      {
        id: "c2",
        clientGroupId: "gy",
        clientGroupName: "Grupo Y",
        legalAreas: [],
      },
    ] as EmailCompany[];

    const semArea = buildClientGroupKeysForAreaFilter(
      "__sem_area__",
      companies,
      [],
      new Map(),
      []
    );
    expect(semArea.has("gy")).toBe(false);
  });
});

describe("área responsável exclusiva", () => {
  const trabalhistaGestor = { area: "Trabalhista", userId: "u-trab" };
  const civelGestor = { area: "Cível", userId: "u-civel" };

  function company(partial: Partial<EmailCompany> & { id: string }): EmailCompany {
    return {
      name: "Empresa",
      city: null,
      state: null,
      country: null,
      website: null,
      linkedin: null,
      cnpj: null,
      source: null,
      clientGroupId: "g1",
      clientGroupName: "Grupo",
      legalAreas: ["Trabalhista", "Cível"],
      responsibleUserIds: [],
      responsibleArea: null,
      customFields: {},
      createdAt: "",
      updatedAt: "",
      ...partial,
    };
  }

  it("sem marcação, gestores não veem o grupo", () => {
    const companies = [company({ id: "c1" })];
    const trab = computeMyClientScope(companies, [], "u-trab", [trabalhistaGestor, civelGestor]);
    const civel = computeMyClientScope(companies, [], "u-civel", [trabalhistaGestor, civelGestor]);
    expect(trab.companyIds.has("c1")).toBe(false);
    expect(civel.companyIds.has("c1")).toBe(false);
  });

  it("sem marcação e com várias áreas, vínculo de advogado não libera o grupo", () => {
    const companies = [
      company({
        id: "c1",
        legalAreas: ["Cível", "Trabalhista"],
        responsibleUserIds: ["u-civel"],
      }),
    ];
    const civel = computeMyClientScope(companies, [], "u-civel", [trabalhistaGestor, civelGestor]);
    expect(civel.companyIds.has("c1")).toBe(false);
  });

  it("com uma única área envolvida, essa área vira responsável automaticamente", () => {
    const companies = [company({ id: "c1", legalAreas: ["Trabalhista"] })];
    const trab = computeMyClientScope(companies, [], "u-trab", [trabalhistaGestor, civelGestor]);
    const civel = computeMyClientScope(companies, [], "u-civel", [trabalhistaGestor, civelGestor]);
    expect(trab.companyIds.has("c1")).toBe(true);
    expect(civel.companyIds.has("c1")).toBe(false);
  });

  it("com uma única área no grupo, todas as empresas do grupo entram no escopo", () => {
    const companies = [
      company({ id: "c1", legalAreas: ["Trabalhista"] }),
      company({ id: "c2", legalAreas: [] }),
    ];
    const trab = computeMyClientScope(companies, [], "u-trab", [trabalhistaGestor, civelGestor]);
    expect(trab.companyIds.has("c1")).toBe(true);
    expect(trab.companyIds.has("c2")).toBe(true);
  });

  it("com uma única área só nos responsáveis, essa área vira responsável", () => {
    const companies = [company({ id: "c1", legalAreas: [] })];
    const responsibles: EmailGroupResponsible[] = [
      {
        id: "r1",
        clientGroupId: "g1",
        companyId: "c1",
        personId: null,
        area: "Cível",
        advogadoResponsavelName: null,
        responsibleUserId: "u-civel",
        openProcessesCount: 1,
      },
    ];
    const civel = computeMyClientScope(companies, responsibles, "u-civel", [
      trabalhistaGestor,
      civelGestor,
    ]);
    const trab = computeMyClientScope(companies, responsibles, "u-trab", [
      trabalhistaGestor,
      civelGestor,
    ]);
    expect(civel.companyIds.has("c1")).toBe(true);
    expect(trab.companyIds.has("c1")).toBe(false);
  });

  it("com uma única área, inclui pessoas do grupo sem marcação", () => {
    const companies = [company({ id: "c1", legalAreas: ["Trabalhista"] })];
    const people = [
      {
        id: "p1",
        name: "Pessoa",
        clientGroupId: "g1",
        responsibleArea: null,
      } as EmailPerson,
    ];
    const trab = computeMyClientScope(
      companies,
      [],
      "u-trab",
      [trabalhistaGestor, civelGestor],
      people
    );
    expect(trab.personIds.has("p1")).toBe(true);
  });

  it("marcação explícita prevalece sobre a única área envolvida", () => {
    const companies = [company({ id: "c1", legalAreas: ["Cível"], responsibleArea: "Trabalhista" })];
    const trab = computeMyClientScope(companies, [], "u-trab", [trabalhistaGestor, civelGestor]);
    const civel = computeMyClientScope(companies, [], "u-civel", [trabalhistaGestor, civelGestor]);
    expect(trab.companyIds.has("c1")).toBe(true);
    expect(civel.companyIds.has("c1")).toBe(false);
  });

  it("com área responsável, só o gestor da área marcada vê o grupo", () => {
    const companies = [company({ id: "c1", responsibleArea: "Trabalhista" })];
    const trab = computeMyClientScope(companies, [], "u-trab", [trabalhistaGestor, civelGestor]);
    const civel = computeMyClientScope(companies, [], "u-civel", [trabalhistaGestor, civelGestor]);
    expect(trab.companyIds.has("c1")).toBe(true);
    expect(civel.companyIds.has("c1")).toBe(false);
  });

  it("advogado responsável de outra área deixa de ver o cliente marcado", () => {
    const companies = [
      company({
        id: "c1",
        responsibleArea: "Trabalhista",
        responsibleUserIds: ["u-advogado-civel"],
      }),
    ];
    const scope = computeMyClientScope(companies, [], "u-advogado-civel", [trabalhistaGestor, civelGestor]);
    expect(scope.companyIds.has("c1")).toBe(false);
  });

  it("inclui pessoas do grupo marcado mesmo sem processo na área dona", () => {
    const companies = [company({ id: "c1", responsibleArea: "Trabalhista" })];
    const people = [
      {
        id: "p1",
        name: "Pessoa",
        clientGroupId: "g1",
        responsibleArea: "Trabalhista",
      } as EmailPerson,
    ];
    const trab = computeMyClientScope(
      companies,
      [],
      "u-trab",
      [trabalhistaGestor, civelGestor],
      people
    );
    const civel = computeMyClientScope(
      companies,
      [],
      "u-civel",
      [trabalhistaGestor, civelGestor],
      people
    );
    expect(trab.personIds.has("p1")).toBe(true);
    expect(civel.personIds.has("p1")).toBe(false);
  });

  it("com área responsável Recuperação de Crédito, só o gestor dessa área vê o grupo", () => {
    const recuperacaoGestor = { area: "Recuperação de Crédito", userId: "u-rec" };
    const companies = [company({ id: "c1", responsibleArea: "Recuperação de Crédito" })];
    const rec = computeMyClientScope(
      companies,
      [],
      "u-rec",
      [trabalhistaGestor, civelGestor, recuperacaoGestor]
    );
    const civel = computeMyClientScope(
      companies,
      [],
      "u-civel",
      [trabalhistaGestor, civelGestor, recuperacaoGestor]
    );
    expect(rec.companyIds.has("c1")).toBe(true);
    expect(civel.companyIds.has("c1")).toBe(false);
  });
});

describe("resolveEffectiveResponsibleArea", () => {
  it("usa a área marcada quando existe", () => {
    expect(resolveEffectiveResponsibleArea("Trabalhista", ["Cível"])).toBe("Trabalhista");
  });

  it("infere a área quando o grupo tem exatamente uma envolvida", () => {
    expect(resolveEffectiveResponsibleArea(null, ["Cível"])).toBe("Cível");
  });

  it("não infere quando há mais de uma área envolvida", () => {
    expect(resolveEffectiveResponsibleArea(null, ["Cível", "Trabalhista"])).toBeNull();
  });

  it("trata a mesma área repetida como uma só", () => {
    expect(resolveEffectiveResponsibleArea(null, ["Cível", "Cível"])).toBe("Cível");
  });

  it("normaliza aliases da mesma área para uma só", () => {
    expect(resolveEffectiveResponsibleArea(null, ["Insolvência", "Reestruturação"])).toBe(
      "Reestruturação"
    );
  });
});

describe("applyEffectiveResponsibleAreas", () => {
  it("preenche responsibleArea quando o grupo tem uma única área", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g1",
        legalAreas: ["Trabalhista"],
        responsibleArea: null,
      } as EmailCompany,
    ];
    const { companies: next } = applyEffectiveResponsibleAreas(companies, []);
    expect(next[0].responsibleArea).toBe("Trabalhista");
  });

  it("não altera grupo que já tem área responsável marcada", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g1",
        legalAreas: ["Cível"],
        responsibleArea: "Trabalhista",
      } as EmailCompany,
    ];
    const { companies: next } = applyEffectiveResponsibleAreas(companies, []);
    expect(next[0].responsibleArea).toBe("Trabalhista");
  });
});

