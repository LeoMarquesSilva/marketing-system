import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  getContentScheduleAssigneeReview: vi.fn(),
  associateContentScheduleAssignee: vi.fn(),
  toContentScheduleApiError: vi.fn((error: unknown) => ({
    message: error instanceof Error ? error.message : "erro",
    status: 403,
  })),
}));

vi.mock("@/lib/content-schedule/server", async () => {
  const { z } = await import("zod");
  return {
    ...server,
    assigneeReviewYearSchema: z.coerce.number().int().min(2020).max(2100),
    associateContentScheduleAssigneeSchema: z.object({
      area: z.string().trim().min(1).max(120),
      source_name: z.string().trim().min(1).max(500),
      collaborator_id: z.string().uuid(),
      mode: z.enum(["identity", "future_replacement"]),
    }).strict(),
  };
});

import { GET, POST } from "./route";

describe("content schedule assignee API validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita ano inválido antes de consultar pendências", async () => {
    const response = await GET(new Request("http://local/api/content-schedule/assignees?year=1900"));
    expect(response.status).toBe(400);
    expect(server.getContentScheduleAssigneeReview).not.toHaveBeenCalled();
  });

  it("consulta o ano validado", async () => {
    server.getContentScheduleAssigneeReview.mockResolvedValue({ year: 2026, issues: [] });
    const response = await GET(new Request("http://local/api/content-schedule/assignees?year=2026"));
    expect(response.status).toBe(200);
    expect(server.getContentScheduleAssigneeReview).toHaveBeenCalledWith(2026);
  });

  it("rejeita modo ou campos extras na associação", async () => {
    const response = await POST(new Request("http://local/api/content-schedule/assignees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        area: "Cível",
        source_name: "Carol Abdalla",
        collaborator_id: "11111111-1111-4111-8111-111111111111",
        mode: "all",
        force: true,
      }),
    }));
    expect(response.status).toBe(400);
    expect(server.associateContentScheduleAssignee).not.toHaveBeenCalled();
  });

  it("envia somente a associação validada ao serviço", async () => {
    const input = {
      area: "Cível",
      source_name: "Carol Abdalla",
      collaborator_id: "11111111-1111-4111-8111-111111111111",
      mode: "identity" as const,
    };
    server.associateContentScheduleAssignee.mockResolvedValue({ updated: 6 });
    const response = await POST(new Request("http://local/api/content-schedule/assignees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }));
    expect(response.status).toBe(200);
    expect(server.associateContentScheduleAssignee).toHaveBeenCalledWith(input);
    await expect(response.json()).resolves.toEqual({ updated: 6 });
  });
});
