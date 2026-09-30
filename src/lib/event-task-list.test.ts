import { describe, expect, it } from "vitest";
import type { EventTask } from "./eventos";
import { filterEventTasks, groupEventTasks } from "./event-task-list";

const task = (partial: Partial<EventTask>): EventTask => ({
  id: "t1", eventId: "e1", title: "Conferir contrato", description: null,
  assigneeId: null, dueDate: null, status: "pendente", phase: null,
  sortOrder: 0, marketingRequestId: null, createdAt: "", updatedAt: "", ...partial,
});

describe("lista de tarefas do evento", () => {
  it("encontra participantes e cardápio na descrição, ignorando acentos", () => {
    const tasks = [task({ description: "Degustação às 12h com Ana no buffet" }), task({ id: "t2" })];
    expect(filterEventTasks(tasks, { search: "degustacao", status: "all", assignee: "all" }, "2026-09-30").map((t) => t.id)).toEqual(["t1"]);
    expect(filterEventTasks(tasks, { search: "Ana", status: "all", assignee: "all" }, "2026-09-30")).toHaveLength(1);
  });
  it("exclui tarefas concluídas e prazos de hoje do filtro de atraso", () => {
    const tasks = [task({ dueDate: "2026-09-29" }), task({ id: "done", status: "concluida", dueDate: "2026-09-01" }), task({ id: "today", dueDate: "2026-09-30" })];
    expect(filterEventTasks(tasks, { search: "", status: "overdue", assignee: "all" }, "2026-09-30").map((t) => t.id)).toEqual(["t1"]);
  });
  it("combina responsável e status e mantém tarefas sem etapa", () => {
    const tasks = [task({ phase: "pre_evento" }), task({ id: "assigned", assigneeId: "u1", status: "em_andamento" }), task({ id: "no-phase" })];
    expect(filterEventTasks(tasks, { search: "", status: "em_andamento", assignee: "u1" }, "2026-09-30").map((t) => t.id)).toEqual(["assigned"]);
    expect(filterEventTasks(tasks, { search: "", status: "all", assignee: "unassigned" }, "2026-09-30")).toHaveLength(2);
    expect(groupEventTasks(tasks).map((g) => [g.value, g.tasks.length])).toEqual([["pre_evento", 1], ["sem_etapa", 2]]);
  });
  it("ordena por prazo, deixa sem prazo e concluídas no final sem alterar o original", () => {
    const tasks = [task({ id: "no-date" }), task({ id: "done", dueDate: "2026-09-01", status: "concluida" }), task({ id: "first", dueDate: "2026-10-10" })];
    expect(filterEventTasks(tasks, { search: "", status: "all", assignee: "all" }, "2026-09-30").map((t) => t.id)).toEqual(["first", "no-date", "done"]);
    expect(tasks[0].id).toBe("no-date");
  });
});
