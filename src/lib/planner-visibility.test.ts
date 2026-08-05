import { describe, expect, it } from "vitest";
import { filterRequestsByKanbanVisibility } from "@/lib/planner-visibility";
import type { MarketingRequest } from "@/lib/marketing-requests";

function req(partial: Partial<MarketingRequest> & { id: string; assignee_id?: string | null }) {
  return partial as MarketingRequest;
}

const list = [
  req({ id: "1", assignee_id: "designer-1" }),
  req({ id: "2", assignee_id: "designer-2" }),
  req({ id: "3", assignee_id: "2f08c695-770e-47ce-b4e4-ce27fa414df8" }),
];

describe("filterRequestsByKanbanVisibility", () => {
  it("admin vê todas as tarefas mesmo com departamento Marketing", () => {
    const filtered = filterRequestsByKanbanVisibility(list, {
      kanbanVisibility: "designer_own_admin_all",
      userId: "2f08c695-770e-47ce-b4e4-ce27fa414df8",
      role: "admin",
      department: "Marketing",
    });
    expect(filtered).toHaveLength(3);
  });

  it("designer de Marketing vê só as próprias", () => {
    const filtered = filterRequestsByKanbanVisibility(list, {
      kanbanVisibility: "designer_own_admin_all",
      userId: "designer-1",
      role: "designer",
      department: "Marketing",
    });
    expect(filtered.map((r) => r.id)).toEqual(["1"]);
  });

  it("everyone_all não filtra por assignee", () => {
    const filtered = filterRequestsByKanbanVisibility(list, {
      kanbanVisibility: "everyone_all",
      userId: "designer-1",
      role: "designer",
      department: "Marketing",
    });
    expect(filtered).toHaveLength(3);
  });
});
