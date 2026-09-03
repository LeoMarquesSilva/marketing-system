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
  resolveUserMeusClientesAreas,
  resolveContactAssigneeAreas,
  userBelongsToClientArea,
  userManagesClientGroupArea,
  resolveCollectionAreaForClientGroup,
  inferResponsibleAreasToPersist,
  resolveEffectiveResponsibleArea,
} from "@/lib/meus-clientes";
import { personNameKey } from "@/lib/email-marketing-normalize";
import {
  departmentToSioeArea,
  mergeAreaManagerPickerAreas,
  normalizeLegalArea,
  normalizeLegalAreas,
} from "@/lib/legal-areas";
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

  it("sempre oferece as áreas de prática no seletor de gestor", () => {
    const areas = mergeAreaManagerPickerAreas(["Insolvência"]);
    expect(areas).toEqual(
      expect.arrayContaining(["Cível", "Reestruturação", "Recuperação de Crédito"])
    );
    expect(areas.filter((area) => area === "Reestruturação")).toHaveLength(1);
  });

  it("mapeia department Recuperação de Crédito para a área SIOE homônima", () => {
    expect(departmentToSioeArea("Recuperação de Crédito")).toBe("Recuperação de Crédito");
    expect(departmentToSioeArea("Cível")).toBe("Cível");
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

  it("Recuperação de Crédito é área autônoma, não subárea de Cível", () => {
    expect(expandRootArea("Cível")).toEqual(["Cível"]);
    expect(getAreaParent("Recuperação de Crédito")).toBe("Recuperação de Crédito");
    expect(expandRootArea("Recuperação de Crédito")).toEqual(["Recuperação de Crédito"]);
  });

  it("gestor de Cível não cobre Recuperação de Crédito", () => {
    const areas = new Set(["Cível"]);
    expect(userCoversEntityArea(areas, "Recuperação de Crédito")).toBe(false);
    expect(userCoversEntityArea(new Set(["Recuperação de Crédito"]), "Recuperação de Crédito")).toBe(
      true
    );
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

  it("área responsável tira o grupo de Sem área e entra no filtro da área", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g3",
        clientGroupName: "Grupo Marcado",
        legalAreas: [] as string[],
        responsibleArea: "Cível",
      },
    ] as EmailCompany[];

    expect(buildClientGroupKeysWithoutArea(companies, [], new Map(), []).has("g3")).toBe(false);
    expect(
      buildClientGroupKeysForAreaFilter("Cível", companies, [], new Map(), []).has("g3")
    ).toBe(true);
  });

  it("filtro Cível não inclui grupo com responsável Recuperação de Crédito", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g-rec",
        clientGroupName: "Grupo Ma7",
        legalAreas: ["Recuperação de Crédito"],
        responsibleArea: "Recuperação de Crédito",
      },
      {
        id: "c2",
        clientGroupId: "g-civel",
        clientGroupName: "Grupo Cível",
        legalAreas: ["Cível"],
        responsibleArea: "Cível",
      },
    ] as EmailCompany[];

    const civel = buildClientGroupKeysForAreaFilter("Cível", companies, [], new Map(), []);
    const rec = buildClientGroupKeysForAreaFilter(
      "Recuperação de Crédito",
      companies,
      [],
      new Map(),
      []
    );

    expect(civel.has("g-rec")).toBe(false);
    expect(civel.has("g-civel")).toBe(true);
    expect(rec.has("g-rec")).toBe(true);
    expect(rec.has("g-civel")).toBe(false);
  });

  it("área de quem envia o NPS tira o grupo de Sem área", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g4",
        clientGroupName: "Grupo Contato",
        legalAreas: [] as string[],
        responsibleArea: null,
      },
    ] as EmailCompany[];

    expect(buildClientGroupKeysWithoutArea(companies, [], new Map(), []).has("g4")).toBe(true);
    expect(
      buildClientGroupKeysWithoutArea(companies, [], new Map(), [], new Map([["g4", "Cível"]])).has(
        "g4"
      )
    ).toBe(false);
    expect(
      buildClientGroupKeysForAreaFilter(
        "Cível",
        companies,
        [],
        new Map(),
        [],
        new Map([["g4", "Cível"]])
      ).has("g4")
    ).toBe(true);
  });
});

describe("área responsável exclusiva", () => {
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

  it("sem marcação, usuários da área não veem o grupo", () => {
    const companies = [company({ id: "c1" })];
    const trab = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Trabalhista"));
    const civel = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Cível"));
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
    const civel = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Cível"));
    expect(civel.companyIds.has("c1")).toBe(false);
  });

  it("com uma única área envolvida, essa área vira responsável automaticamente", () => {
    const companies = [company({ id: "c1", legalAreas: ["Trabalhista"] })];
    const trab = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Trabalhista"));
    const civel = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Cível"));
    expect(trab.companyIds.has("c1")).toBe(true);
    expect(civel.companyIds.has("c1")).toBe(false);
  });

  it("com uma única área no grupo, todas as empresas do grupo entram no escopo", () => {
    const companies = [
      company({ id: "c1", legalAreas: ["Trabalhista"] }),
      company({ id: "c2", legalAreas: [] }),
    ];
    const trab = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Trabalhista"));
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
    const civel = computeMyClientScope(
      companies,
      responsibles,
      resolveUserMeusClientesAreas("Cível")
    );
    const trab = computeMyClientScope(
      companies,
      responsibles,
      resolveUserMeusClientesAreas("Trabalhista")
    );
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
      resolveUserMeusClientesAreas("Trabalhista"),
      people
    );
    expect(trab.personIds.has("p1")).toBe(true);
  });

  it("marcação explícita prevalece sobre a única área envolvida", () => {
    const companies = [company({ id: "c1", legalAreas: ["Cível"], responsibleArea: "Trabalhista" })];
    const trab = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Trabalhista"));
    const civel = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Cível"));
    expect(trab.companyIds.has("c1")).toBe(true);
    expect(civel.companyIds.has("c1")).toBe(false);
  });

  it("com área responsável, só usuários da área marcada veem o grupo", () => {
    const companies = [company({ id: "c1", responsibleArea: "Trabalhista" })];
    const trab = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Trabalhista"));
    const civel = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Cível"));
    expect(trab.companyIds.has("c1")).toBe(true);
    expect(civel.companyIds.has("c1")).toBe(false);
  });

  it("advogado de outra área não vê cliente marcado para área diferente", () => {
    const companies = [
      company({
        id: "c1",
        responsibleArea: "Trabalhista",
        responsibleUserIds: ["u-advogado-civel"],
      }),
    ];
    const scope = computeMyClientScope(
      companies,
      [],
      resolveUserMeusClientesAreas("Cível")
    );
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
      resolveUserMeusClientesAreas("Trabalhista"),
      people
    );
    const civel = computeMyClientScope(
      companies,
      [],
      resolveUserMeusClientesAreas("Cível"),
      people
    );
    expect(trab.personIds.has("p1")).toBe(true);
    expect(civel.personIds.has("p1")).toBe(false);
  });

  it("Cível e Recuperação de Crédito não compartilham clientes pelo department", () => {
    const companies = [company({ id: "c1", responsibleArea: "Recuperação de Crédito" })];
    const rec = computeMyClientScope(
      companies,
      [],
      resolveUserMeusClientesAreas("Recuperação de Crédito")
    );
    const civel = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Cível"));
    const trab = computeMyClientScope(companies, [], resolveUserMeusClientesAreas("Trabalhista"));
    expect(rec.companyIds.has("c1")).toBe(true);
    expect(civel.companyIds.has("c1")).toBe(false);
    expect(trab.companyIds.has("c1")).toBe(false);
  });
});

describe("contato da área por gestor", () => {
  it("limita colaboradores elegíveis à área responsável exata do grupo", () => {
    const areas = resolveContactAssigneeAreas("Cível");
    expect(areas.has("Cível")).toBe(true);
    expect(areas.has("Recuperação de Crédito")).toBe(false);
    expect(resolveContactAssigneeAreas("Recuperação de Crédito")).toEqual(
      new Set(["Recuperação de Crédito"])
    );
  });

  it("identifica colaborador da área", () => {
    expect(userBelongsToClientArea("Cível", "Cível")).toBe(true);
    expect(userBelongsToClientArea("Recuperação de Crédito", "Cível")).toBe(false);
    expect(userBelongsToClientArea("Recuperação de Crédito", "Recuperação de Crédito")).toBe(true);
    expect(userBelongsToClientArea("Trabalhista", "Cível")).toBe(false);
  });

  it("só gestor oficial da mesma área pode gerenciar o grupo", () => {
    const managers = [
      { area: "Cível", userId: "gestor-civel" },
      { area: "Trabalhista", userId: "gestor-trab" },
    ];
    expect(userManagesClientGroupArea("gestor-civel", "Cível", managers)).toBe(true);
    expect(userManagesClientGroupArea("gestor-civel", "Recuperação de Crédito", managers)).toBe(
      false
    );
    expect(userManagesClientGroupArea("gestor-trab", "Cível", managers)).toBe(false);
    expect(userManagesClientGroupArea("advogado-civel", "Cível", managers)).toBe(false);
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

describe("resolveCollectionAreaForClientGroup", () => {
  it("infere a área quando a coluna está vazia e o grupo tem uma só área envolvida", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g-buritis",
        legalAreas: ["Insolvência"],
        responsibleArea: null,
      } as EmailCompany,
    ];
    expect(resolveCollectionAreaForClientGroup("g-buritis", companies, [], [])).toBe(
      "Reestruturação"
    );
  });

  it("não infere quando o grupo tem mais de uma área e a coluna está vazia", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g1",
        legalAreas: ["Cível", "Trabalhista"],
        responsibleArea: null,
      } as EmailCompany,
    ];
    expect(resolveCollectionAreaForClientGroup("g1", companies, [], [])).toBeNull();
  });

  it("usa a área marcada mesmo se as envolvidas forem outras", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g1",
        legalAreas: ["Cível"],
        responsibleArea: "Reestruturação",
      } as EmailCompany,
    ];
    expect(resolveCollectionAreaForClientGroup("g1", companies, [], [])).toBe("Reestruturação");
  });
});

describe("inferResponsibleAreasToPersist", () => {
  it("grava só grupos com coluna vazia e uma única área envolvida", () => {
    const companies = [
      {
        id: "c1",
        clientGroupId: "g-buritis",
        legalAreas: ["Insolvência"],
        responsibleArea: null,
      } as EmailCompany,
      {
        id: "c2",
        clientGroupId: "g-misto",
        legalAreas: ["Cível", "Trabalhista"],
        responsibleArea: null,
      } as EmailCompany,
      {
        id: "c3",
        clientGroupId: "g-marcado",
        legalAreas: ["Cível"],
        responsibleArea: "Reestruturação",
      } as EmailCompany,
    ];
    const updates = inferResponsibleAreasToPersist(
      [
        { id: "g-buritis", name: "Buritis", responsibleArea: null },
        { id: "g-misto", name: "Misto", responsibleArea: null },
        { id: "g-marcado", name: "Já marcado", responsibleArea: "Reestruturação" },
        { id: "g-interno", name: "Bismarchi Pires", responsibleArea: null },
      ],
      companies,
      [],
      []
    );
    expect(updates).toEqual([{ id: "g-buritis", name: "Buritis", area: "Reestruturação" }]);
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

