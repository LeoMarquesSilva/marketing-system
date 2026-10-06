import { describe, expect, it } from "vitest";
import {
  canAssignContentScheduleArea,
  canManageContentScheduleAssignments,
  canReadContentScheduleSlot,
  findAutomaticSlotMatch,
  findContentSimilarityWarnings,
  findViosCandidatesForSlot,
  normalizeScheduleArea,
  reconcileAutomaticViosLinks,
  resolveContentScheduleAreaFilterLabel,
  resolveContentScheduleAreaLabel,
  resolveContentScheduleAccess,
  type ContentScheduleSlot,
  type SchedulableContentEvent,
} from "@/lib/content-schedule/domain";

const event: SchedulableContentEvent = {
  id: "content-1",
  date: "2026-09-09",
  area: "Insolvência",
  format: "post",
  collaboratorId: "person-1",
};

function slot(overrides: Partial<ContentScheduleSlot> = {}): ContentScheduleSlot {
  return {
    id: "slot-1",
    date: "2026-09-10",
    area: "Reestruturação",
    format: "post",
    collaboratorId: "person-1",
    contentId: null,
    cancelled: false,
    ...overrides,
  };
}

describe("findAutomaticSlotMatch", () => {
  it("escolhe deterministicamente o único slot mais próximo em até 14 dias", () => {
    expect(findAutomaticSlotMatch(event, [slot(), slot({ id: "slot-2", date: "2026-09-05" })]))
      .toEqual({ status: "matched", slotId: "slot-1", distanceDays: 1 });
  });

  it("marca empate na menor distância como ambíguo", () => {
    expect(findAutomaticSlotMatch(event, [
      slot({ id: "before", date: "2026-09-08" }),
      slot({ id: "after", date: "2026-09-10" }),
    ])).toEqual({
      status: "ambiguous",
      candidateSlotIds: ["after", "before"],
      distanceDays: 1,
    });
  });

  it("detecta primeiro vínculo existente e torna retries idempotentes", () => {
    expect(findAutomaticSlotMatch(event, [
      slot({ id: "new-nearer", date: "2026-09-09" }),
      slot({ id: "linked", date: "2027-01-01", contentId: "content-1", cancelled: true }),
    ])).toEqual({ status: "already_linked", slotId: "linked" });
  });

  it("só considera vínculo existente da mesma pessoa e formato", () => {
    expect(findAutomaticSlotMatch(event, [
      slot({ id: "other-person", contentId: "content-1", collaboratorId: "person-2" }),
      slot({ id: "other-format", contentId: "content-1", format: "reel" }),
      slot({ id: "available", contentId: null }),
    ])).toEqual({ status: "matched", slotId: "available", distanceDays: 1 });
  });

  it("não confunde Marketing com Legal Ops ao comparar área de conteúdo", () => {
    expect(findAutomaticSlotMatch(event, [slot({ area: "Marketing" })])).toEqual({ status: "not_found" });
    expect(normalizeScheduleArea("Operações Legais (Legal Ops)")).toBe("operacoes legais");
    expect(normalizeScheduleArea("Distressed Deals - Special Situations")).toBe("special situations");
    expect(normalizeScheduleArea("Distressed Deals")).toBe("special situations");
  });

  it.each(["post", "reel"] as const)(
    "vincula %s de Recuperação de Crédito somente à área canônica correspondente",
    (format) => {
      const recoveryEvent = {
        ...event,
        area: "Recuperação de Crédito",
        format,
      };

      expect(findAutomaticSlotMatch(recoveryEvent, [
        slot({ id: "civil", area: "Cível", format }),
        slot({ id: "recovery", area: "Recuperação de Crédito", format }),
      ])).toEqual({ status: "matched", slotId: "recovery", distanceDays: 1 });
    }
  );

  it("rejeita data civil inválida em vez de aceitar rollover do Date.parse", () => {
    expect(findAutomaticSlotMatch({ ...event, date: "2026-02-30" }, [slot({ date: "2026-03-02" })]))
      .toEqual({ status: "not_found" });
  });

  it.each([
    ["pessoa errada", slot({ collaboratorId: "person-2" })],
    ["área errada", slot({ area: "Cível" })],
    ["formato errado", slot({ format: "reel" })],
    ["já ocupado", slot({ contentId: "other-content" })],
    ["cancelado", slot({ cancelled: true })],
    ["fora da janela", slot({ date: "2026-09-24" })],
  ])("não combina slot de %s", (_name, candidate) => {
    expect(findAutomaticSlotMatch(event, [candidate])).toEqual({ status: "not_found" });
  });
});

describe("vínculo VIOS com o cronograma", () => {
  const viosSlot = {
    id: "slot-1",
    date: "2026-09-18",
    area: "Reestruturação",
    collaboratorId: "person-1",
    cancelled: false,
    viosTaskId: null,
  };
  const viosTask = {
    id: "task-1",
    ci: "1001",
    date: "2026-09-18",
    area: "Insolvência",
    assigneeId: "person-1",
    label: "PROTOCOLO",
    cancelled: false,
  };

  it("prioriza o par inequívoco com mesma identidade", () => {
    expect(reconcileAutomaticViosLinks(
      [viosTask, { ...viosTask, id: "task-2", ci: "1002", assigneeId: "person-2" }],
      [viosSlot, { ...viosSlot, id: "slot-2", collaboratorId: "person-2" }]
    ).matches).toEqual([
      { taskId: "task-1", slotId: "slot-1", strategy: "identity" },
      { taskId: "task-2", slotId: "slot-2", strategy: "identity" },
    ]);
  });

  it("vincula grupo 1:1 sem identidade e preserva ambiguidades", () => {
    expect(reconcileAutomaticViosLinks(
      [{ ...viosTask, assigneeId: null }],
      [{ ...viosSlot, collaboratorId: null }]
    ).matches).toEqual([
      { taskId: "task-1", slotId: "slot-1", strategy: "group" },
    ]);

    const ambiguous = reconcileAutomaticViosLinks(
      [{ ...viosTask, assigneeId: null }],
      [
        { ...viosSlot, collaboratorId: null },
        { ...viosSlot, id: "slot-2", collaboratorId: null },
      ]
    );
    expect(ambiguous.matches).toEqual([]);
    expect(ambiguous.ambiguousTaskIds).toEqual(["task-1"]);
  });

  it("não usa REVISAR, cancelada, outra data ou identidade conflitante", () => {
    for (const task of [
      { ...viosTask, label: "REVISAR" },
      { ...viosTask, cancelled: true },
      { ...viosTask, date: "2026-09-19", assigneeId: null },
      { ...viosTask, assigneeId: "person-2" },
    ]) {
      expect(reconcileAutomaticViosLinks([task], [viosSlot]).matches).toEqual([]);
    }
  });

  it("acompanha a remarcação do VIOS pela data anterior", () => {
    expect(reconcileAutomaticViosLinks(
      [{ ...viosTask, date: "2026-09-25", previousDate: "2026-09-18" }],
      [viosSlot]
    ).matches).toEqual([
      { taskId: "task-1", slotId: "slot-1", strategy: "rescheduled", moveSlotTo: "2026-09-25" },
    ]);
  });

  it("liga em pares tarefas sem responsável do mesmo dia e área", () => {
    const tasks = [
      { ...viosTask, id: "task-b", ci: "1010", assigneeId: null },
      { ...viosTask, id: "task-a", ci: "1002", assigneeId: null },
    ];
    const slots = [
      { ...viosSlot, id: "slot-reel", collaboratorId: "person-2" },
      { ...viosSlot, id: "slot-post", collaboratorId: "person-1" },
    ];
    expect(reconcileAutomaticViosLinks(tasks, slots).matches).toEqual([
      { taskId: "task-a", slotId: "slot-post", strategy: "pair" },
      { taskId: "task-b", slotId: "slot-reel", strategy: "pair" },
    ]);
    // Sobra vaga ou tarefa: não chuta.
    expect(reconcileAutomaticViosLinks(tasks, [...slots, { ...viosSlot, id: "slot-extra", collaboratorId: null }]).matches).toEqual([]);
    expect(reconcileAutomaticViosLinks([...tasks, { ...viosTask, id: "task-c", ci: "1020", assigneeId: null }], slots).matches).toEqual([]);
  });

  it("liga a mesma pessoa em até 14 dias e move a data", () => {
    expect(reconcileAutomaticViosLinks([{ ...viosTask, date: "2026-09-24" }], [viosSlot]).matches).toEqual([
      { taskId: "task-1", slotId: "slot-1", strategy: "nearby", moveSlotTo: "2026-09-24" },
    ]);
    expect(reconcileAutomaticViosLinks([{ ...viosTask, date: "2026-10-05" }], [viosSlot]).matches).toEqual([]);
    expect(reconcileAutomaticViosLinks(
      [{ ...viosTask, date: "2026-09-24" }],
      [viosSlot, { ...viosSlot, id: "slot-2", date: "2026-09-28" }]
    ).matches).toEqual([]);
  });

  it("ordena candidatos manuais por data exata e identidade", () => {
    const candidates = findViosCandidatesForSlot(viosSlot, [
      { ...viosTask, id: "near", ci: "1003", date: "2026-09-19" },
      { ...viosTask, id: "exact-other", ci: "1002", assigneeId: "person-2" },
      { ...viosTask, id: "exact-person", ci: "1001" },
      { ...viosTask, id: "far", date: "2026-10-10" },
    ]);
    expect(candidates.map((item) => item.id)).toEqual([
      "exact-person",
      "exact-other",
      "near",
    ]);
  });
});

describe("findContentSimilarityWarnings", () => {
  const input = {
    sourceUrl: "https://example.com/article/?utm_source=newsletter",
    title: "STJ muda entendimento sobre recuperação judicial",
    text: "A decisão altera o tratamento de créditos na recuperação judicial.",
  };

  it("distingue fonte exata de tema semelhante e inclui evidências sem bloquear", () => {
    const warnings = findContentSimilarityWarnings(input, [
      {
        id: "published",
        status: "published",
        sourceUrl: "https://example.com/article",
        title: "Outro título",
        text: null,
      },
      {
        id: "production",
        status: "in_production",
        sourceUrl: "https://other.test/news",
        title: "Recuperação judicial: STJ altera tratamento de créditos",
        text: "Entenda a nova decisão sobre recuperação judicial.",
      },
    ]);

    expect(warnings.map(({ candidateId, kind }) => ({ candidateId, kind }))).toEqual([
      { candidateId: "published", kind: "exact_source" },
      { candidateId: "production", kind: "similar_topic" },
    ]);
    expect(warnings[0].evidence).toContain("source_url");
    expect(warnings[1].evidence).toContain("shared_terms");
    expect(warnings.every((warning) => warning.blocking === false)).toBe(true);
  });

  it("remove tracking, mas preserva query semântica ao comparar fontes", () => {
    const candidates = [{
      id: "candidate",
      status: "published" as const,
      sourceUrl: "https://example.com/article?id=2&utm_source=x",
      title: null,
      text: null,
    }];
    expect(findContentSimilarityWarnings({
      sourceUrl: "https://example.com/article?utm_medium=email&id=1",
      title: null,
      text: null,
    }, candidates)).toEqual([]);
    expect(findContentSimilarityWarnings({
      sourceUrl: "https://example.com/article?fbclid=abc&id=2",
      title: null,
      text: null,
    }, candidates)[0]?.kind).toBe("exact_source");
  });
});

describe("content schedule access", () => {
  const base = {
    userId: "person-1",
    isActive: true,
    role: null,
    permissions: [] as string[],
    accessMode: "auto" as const,
    areaScope: null,
    position: "Advogado",
    department: "Cível",
  };

  it("dá gestão global a admin, designer e ao departamento de Marketing", () => {
    expect(resolveContentScheduleAccess({ ...base, role: "admin" }).manageAll).toBe(true);
    expect(resolveContentScheduleAccess({ ...base, role: "designer", department: "Operações Legais" }).manageAll).toBe(true);
    expect(resolveContentScheduleAccess({ ...base, department: "marketing" }).manageAll).toBe(true);
  });

  it("reutiliza escopo automático e customizado de liderança para atribuir área", () => {
    const leader = resolveContentScheduleAccess({
      ...base,
      position: "Gerente",
      department: "Insolvência",
    });
    expect(canAssignContentScheduleArea(leader, "Reestruturação")).toBe(true);
    expect(canAssignContentScheduleArea(leader, "Cível")).toBe(false);

    const custom = resolveContentScheduleAccess({
      ...base,
      accessMode: "custom",
      areaScope: ["Contratos"],
    });
    expect(canAssignContentScheduleArea(custom, "Societário e Contratos")).toBe(true);
  });

  it("usa o agrupamento canônico de Férias para acesso e filtros de colaboradores", () => {
    const custom = resolveContentScheduleAccess({
      ...base,
      accessMode: "custom",
      areaScope: ["Operações Legais"],
    });

    expect(canAssignContentScheduleArea(custom, "Marketing")).toBe(true);
    expect(resolveContentScheduleAreaLabel("Marketing")).toBe("Operações Legais");
    expect(resolveContentScheduleAreaLabel("Insolvência")).toBe("Reestruturação");
    expect(resolveContentScheduleAreaFilterLabel("Distressed Deals")).toBeNull();
  });

  it("não transforma permissão RH em administração global de marketing", () => {
    const rh = resolveContentScheduleAccess({ ...base, permissions: ["/rh"] });
    expect(rh.manageAll).toBe(false);
    expect(rh.manageableAreas).toEqual([]);
  });

  it("nega toda gestão e leitura própria para perfil inativo, inclusive admin e liderança", () => {
    for (const inactive of [
      { ...base, isActive: false, role: "admin" },
      { ...base, isActive: false, position: "Gerente" },
    ]) {
      expect(resolveContentScheduleAccess(inactive)).toEqual({
        manageAll: false,
        manageableAreas: [],
        canReadOwn: false,
        ownCollaboratorId: null,
      });
    }
  });

  it("permite a colaborador ativo ler somente os próprios slots", () => {
    const access = resolveContentScheduleAccess(base);
    expect(canReadContentScheduleSlot(access, slot())).toBe(true);
    expect(canReadContentScheduleSlot(access, slot({ collaboratorId: "person-2" }))).toBe(false);
    expect(canReadContentScheduleSlot(resolveContentScheduleAccess({ ...base, isActive: false }), slot())).toBe(false);
  });

  it("limita gestor às áreas da gestão, inclusive quando há tarefa própria fora do escopo", () => {
    const manager = resolveContentScheduleAccess({
      ...base,
      position: "Gerente",
      department: "Cível",
    });

    expect(canManageContentScheduleAssignments(manager)).toBe(true);
    expect(canReadContentScheduleSlot(manager, slot({ area: "Cível", collaboratorId: "person-2" }))).toBe(true);
    expect(canReadContentScheduleSlot(manager, slot({ area: "Trabalhista", collaboratorId: "person-1" }))).toBe(false);
    expect(canAssignContentScheduleArea(manager, "Cível")).toBe(true);
    expect(canAssignContentScheduleArea(manager, "Trabalhista")).toBe(false);
  });
});
