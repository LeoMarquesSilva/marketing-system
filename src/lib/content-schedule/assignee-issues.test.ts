import { describe, expect, it } from "vitest";
import { classifyScheduleAssigneeIssues } from "./assignee-issues";

const slot = (sourceName: string, area = "Cível", dueDate = "2026-10-10") => ({
  id: `${sourceName}-${dueDate}`,
  area,
  sourceName,
  dueDate,
  cancelled: false,
});

const person = (id: string, name: string, department: string, isActive = true) => ({
  id,
  name,
  department,
  isActive,
  avatarUrl: null,
});

describe("classifyScheduleAssigneeIssues", () => {
  it("sugere um único colaborador ativo da área para nome abreviado", () => {
    const result = classifyScheduleAssigneeIssues({
      slots: [slot("Carol Abdalla", "Trabalhista")],
      people: [person("carol", "Caroline Simel Abdalla", "Trabalhista")],
      today: "2026-09-09",
    });
    expect(result[0]).toMatchObject({ reason: "abbreviated", suggestedCollaboratorId: "carol", mode: "identity", affectedSlotCount: 1 });
  });

  it("marca pessoa inativa e preserva tarefas passadas na substituição", () => {
    const result = classifyScheduleAssigneeIssues({
      slots: [slot("Gabriela Consul", "Cível", "2026-03-01"), slot("Gabriela Consul", "Cível", "2026-10-01")],
      people: [person("gabriela", "Gabriela Nicolau Olmedo Consul", "Cível", false)],
      today: "2026-09-09",
    });
    expect(result[0]).toMatchObject({ reason: "inactive", mode: "future_replacement", slotCount: 2, affectedSlotCount: 1, pastSlotCount: 1, futureSlotCount: 1 });
  });

  it("marca mudança de área sem sugerir associação histórica", () => {
    const result = classifyScheduleAssigneeIssues({
      slots: [slot("Renato Vallim", "Trabalhista")],
      people: [person("renato", "Renato Rossetti Vallim de Castro", "Recuperação de Crédito")],
      today: "2026-09-09",
    });
    expect(result[0]).toMatchObject({ reason: "moved_area", mode: "future_replacement", affectedSlotCount: 1 });
    expect(result[0].suggestedCollaboratorId).toBeNull();
  });

  it("trata a definir como substituição futura", () => {
    const result = classifyScheduleAssigneeIssues({ slots: [slot("A DEFINIR")], people: [], today: "2026-09-09" });
    expect(result[0]).toMatchObject({ reason: "placeholder", mode: "future_replacement" });
  });

  it("não sugere quando mais de uma pessoa ativa da área combina", () => {
    const result = classifyScheduleAssigneeIssues({
      slots: [slot("Letícia")],
      people: [person("one", "Letícia Silva", "Cível"), person("two", "Letícia Souza", "Cível")],
      today: "2026-09-09",
    });
    expect(result[0]).toMatchObject({ reason: "ambiguous", suggestedCollaboratorId: null, mode: "identity" });
  });
});
