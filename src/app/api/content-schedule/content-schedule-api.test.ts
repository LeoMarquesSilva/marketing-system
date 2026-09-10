import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  createContentScheduleSlots: vi.fn(),
  getContentSchedule: vi.fn(),
  updateContentScheduleSlot: vi.fn(),
  toContentScheduleApiError: vi.fn((error: unknown) => ({
    message: error instanceof Error ? error.message : "erro",
    status: 403,
  })),
}));

vi.mock("@/lib/content-schedule/server", async () => {
  const { z } = await import("zod");
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const create = z.object({
    area: z.string().trim().min(1), due_date: date, format: z.enum(["post", "reel"]),
    collaborator_id: z.string().uuid().nullable().optional(), source_key: z.string().optional(),
    source_name: z.string().nullable().optional(), source_status: z.string().nullable().optional(),
    source_notes: z.string().nullable().optional(),
  }).strict();
  return {
    ...server,
    createContentScheduleSlotSchema: create,
    updateContentScheduleSlotSchema: create.omit({ source_key: true }).partial()
      .extend({ cancelled: z.boolean().optional() }).strict()
      .refine((value) => Object.keys(value).length > 0),
  };
});

import { POST } from "./route";
import { PATCH } from "./[id]/route";

describe("content schedule API validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita campos arbitrários antes de gravar uma vaga", async () => {
    const response = await POST(new Request("http://local/api/content-schedule", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ area: "Cível", due_date: "2026-09-20", format: "post", created_by: "forjado" }),
    }));
    expect(response.status).toBe(400);
    expect(server.createContentScheduleSlots).not.toHaveBeenCalled();
  });

  it("rejeita formato nulo no PATCH antes de chamar o serviço", async () => {
    const response = await PATCH(new Request("http://local/api/content-schedule/slot", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: null }),
    }), { params: Promise.resolve({ id: "slot" }) });
    expect(response.status).toBe(400);
    expect(server.updateContentScheduleSlot).not.toHaveBeenCalled();
  });
});
