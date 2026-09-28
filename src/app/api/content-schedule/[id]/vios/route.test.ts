import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  linkContentScheduleViosTask: vi.fn(),
  toContentScheduleApiError: vi.fn((error: unknown) => ({
    message: error instanceof Error ? error.message : "erro",
    status: 409,
    code: "TEST_ERROR",
  })),
}));

vi.mock("@/lib/content-schedule/server", async () => {
  const { z } = await import("zod");
  return {
    ...server,
    linkContentScheduleViosSchema: z.object({
      vios_task_id: z.string().uuid().nullable(),
      confirm: z.boolean().optional(),
    }).strict(),
  };
});

import { POST } from "./route";

describe("POST /api/content-schedule/[id]/vios", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita corpo arbitrário antes de chamar o serviço", async () => {
    const response = await POST(new Request("http://local/api/content-schedule/slot/vios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vios_task_id: null, created_by: "forjado" }),
    }), { params: Promise.resolve({ id: "slot" }) });

    expect(response.status).toBe(400);
    expect(server.linkContentScheduleViosTask).not.toHaveBeenCalled();
  });

  it("aceita vínculo e desvínculo explícitos", async () => {
    const taskId = "11111111-1111-4111-8111-111111111111";
    for (const viosTaskId of [taskId, null]) {
      const response = await POST(new Request("http://local/api/content-schedule/slot/vios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vios_task_id: viosTaskId }),
      }), { params: Promise.resolve({ id: "slot" }) });
      expect(response.status).toBe(200);
    }
    expect(server.linkContentScheduleViosTask).toHaveBeenNthCalledWith(1, "slot", {
      vios_task_id: taskId,
    });
    expect(server.linkContentScheduleViosTask).toHaveBeenNthCalledWith(2, "slot", {
      vios_task_id: null,
    });
  });
});
