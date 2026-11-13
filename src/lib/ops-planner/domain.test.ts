import { describe, expect, it } from "vitest";
import { criarCalendario } from "@/lib/vistagem/dias-uteis";
import {
  businessDaysSince,
  canArchiveTask,
  canEditTask,
  canManageSpace,
  canViewSpace,
  computeKpis,
  dateInSaoPaulo,
  dueBucket,
  finishedOnTime,
  isReschedule,
  managedSpaceIds,
  myTaskGroup,
  sortOrderBetween,
  todayInSaoPaulo,
  wipByPerson,
  type OpsAccess,
} from "./domain";
import type { OpsTask } from "./types";

const ehDiaUtil = criarCalendario(["2026-11-02"]);

function task(overrides: Partial<OpsTask>): OpsTask {
  return {
    id: "t1",
    space_id: "rh",
    list_id: null,
    parent_task_id: null,
    routine_id: null,
    occurrence_date: null,
    title: "Tarefa",
    description: null,
    status: "a_fazer",
    priority: "media",
    tipo: "operacional",
    assignee_ids: [],
    requested_by: null,
    start_date: null,
    due_date: null,
    due_time: null,
    next_step: null,
    waiting_on: null,
    waiting_since: null,
    reschedule_count: 0,
    sort_order: 0,
    completed_at: null,
    completed_by: null,
    created_by: null,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    ...overrides,
  };
}

describe("datas em São Paulo", () => {
  it("usa o dia de Brasília, não o de UTC", () => {
    // 01h UTC de 24/10 ainda é 22h de 23/10 em São Paulo.
    expect(todayInSaoPaulo(new Date("2026-10-24T01:00:00Z"))).toBe("2026-10-23");
    expect(dateInSaoPaulo("2026-10-24T01:00:00Z")).toBe("2026-10-23");
    expect(dateInSaoPaulo(null)).toBeNull();
  });

  it("conta dias úteis sem o dia de partida", () => {
    // Sexta 30/10 → terça 03/11 (segunda é Finados): só 03/11 conta.
    expect(businessDaysSince("2026-10-30", "2026-11-03", ehDiaUtil)).toBe(1);
    expect(businessDaysSince("2026-11-03", "2026-11-03", ehDiaUtil)).toBe(0);
  });
});

describe("permissões por papel no espaço", () => {
  const membro: OpsAccess = { userId: "ana", isAdmin: false, memberships: [{ space_id: "rh", user_id: "ana", role: "membro" }] };
  const lider: OpsAccess = { userId: "bia", isAdmin: false, memberships: [{ space_id: "rh", user_id: "bia", role: "lider" }] };
  const admin: OpsAccess = { userId: "adm", isAdmin: true, memberships: [] };

  it("membro vê e edita o espaço, mas não administra", () => {
    expect(canViewSpace(membro, "rh")).toBe(true);
    expect(canViewSpace(membro, "financeiro")).toBe(false);
    expect(canManageSpace(membro, "rh")).toBe(false);
    expect(canEditTask(membro, task({ space_id: "rh" }))).toBe(true);
  });

  it("responsável de outro espaço edita a própria tarefa", () => {
    expect(canEditTask(membro, task({ space_id: "financeiro", assignee_ids: ["ana"] }))).toBe(true);
    expect(canEditTask(membro, task({ space_id: "financeiro" }))).toBe(false);
  });

  it("arquiva quem administra o espaço ou quem criou a tarefa", () => {
    expect(canArchiveTask(lider, task({ space_id: "rh" }))).toBe(true);
    expect(canArchiveTask(membro, task({ space_id: "rh", created_by: "ana" }))).toBe(true);
    expect(canArchiveTask(membro, task({ space_id: "rh", created_by: "bia" }))).toBe(false);
  });

  it("Gestão mostra os espaços liderados; admin vê todos", () => {
    expect(managedSpaceIds(lider, ["rh", "financeiro"])).toEqual(["rh"]);
    expect(managedSpaceIds(membro, ["rh", "financeiro"])).toEqual([]);
    expect(managedSpaceIds(admin, ["rh", "financeiro"])).toEqual(["rh", "financeiro"]);
  });
});

describe("faixas de prazo", () => {
  it("separa atrasadas, hoje, 7 dias, depois e sem prazo", () => {
    expect(dueBucket("2026-10-22", "2026-10-23")).toBe("atrasada");
    expect(dueBucket("2026-10-23", "2026-10-23")).toBe("hoje");
    expect(dueBucket("2026-10-30", "2026-10-23")).toBe("proximos_7");
    expect(dueBucket("2026-10-31", "2026-10-23")).toBe("depois");
    expect(dueBucket(null, "2026-10-23")).toBe("sem_prazo");
  });

  it("aguardando vai para um grupo próprio, salvo se já venceu", () => {
    expect(myTaskGroup(task({ status: "aguardando", due_date: "2026-10-30" }), "2026-10-23")).toBe("aguardando");
    expect(myTaskGroup(task({ status: "aguardando", due_date: "2026-10-20" }), "2026-10-23")).toBe("atrasada");
  });

  it("concluída no prazo compara a data de São Paulo", () => {
    expect(finishedOnTime(task({ status: "concluida", due_date: "2026-10-23", completed_at: "2026-10-24T01:00:00Z" }))).toBe(true);
    expect(finishedOnTime(task({ status: "concluida", due_date: "2026-10-23", completed_at: "2026-10-24T15:00:00Z" }))).toBe(false);
    expect(finishedOnTime(task({ status: "concluida" }))).toBeNull();
  });

  it("mudar um prazo existente é reprogramação; definir o primeiro não", () => {
    expect(isReschedule("2026-10-23", "2026-10-30")).toBe(true);
    expect(isReschedule(null, "2026-10-30")).toBe(false);
    expect(isReschedule("2026-10-23", "2026-10-23")).toBe(false);
  });
});

describe("indicadores da Gestão", () => {
  it("conta abertas, atrasadas, paradas e % no prazo do mês", () => {
    const kpis = computeKpis(
      [
        task({ due_date: "2026-11-02" }),
        task({ due_date: "2026-11-10" }),
        task({ status: "aguardando", waiting_since: "2026-10-23", due_date: null }),
        task({ status: "concluida", due_date: "2026-11-05", completed_at: "2026-11-04T15:00:00Z" }),
        task({ status: "concluida", due_date: "2026-11-01", completed_at: "2026-11-03T15:00:00Z" }),
        task({ status: "concluida", due_date: "2026-10-01", completed_at: "2026-10-01T15:00:00Z" }),
        task({ status: "cancelada", due_date: "2026-11-01" }),
      ],
      "2026-11-05",
      ehDiaUtil
    );
    expect(kpis).toEqual({ open: 3, overdue: 1, dueNext7: 1, waitingStale: 1, doneThisMonth: 2, onTimePct: 50 });
  });

  it("WIP soma cada responsável das tarefas em andamento", () => {
    const wip = wipByPerson([
      task({ status: "em_andamento", assignee_ids: ["ana", "bia"] }),
      task({ status: "em_andamento", assignee_ids: ["ana"] }),
      task({ status: "a_fazer", assignee_ids: ["ana"] }),
    ]);
    expect(wip.get("ana")).toBe(2);
    expect(wip.get("bia")).toBe(1);
  });

  it("ordem manual fica entre os vizinhos", () => {
    expect(sortOrderBetween(1, 2)).toBe(1.5);
    expect(sortOrderBetween(null, 2)).toBe(1);
    expect(sortOrderBetween(4, null)).toBe(5);
    expect(sortOrderBetween(null, null)).toBe(0);
  });
});
