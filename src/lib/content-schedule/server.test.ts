import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

type Query = { table: string; operation: string; payload?: Record<string, unknown>; filters: [string, string, unknown][] };
type Result = { data: unknown; error: { code?: string; message?: string } | null };

function database(answer: (query: Query) => Result) {
  const calls: Query[] = [];
  return { calls, from(table: string) {
    const query: Query = { table, operation: "select", filters: [] };
    const chain = {
      select: () => chain,
      update: (payload: Record<string, unknown>) => { query.operation = "update"; query.payload = payload; return chain; },
      insert: (payload: Record<string, unknown>) => { query.operation = "insert"; query.payload = payload; return chain; },
      eq: (key: string, value: unknown) => { query.filters.push(["eq", key, value]); return chain; },
      is: (key: string, value: unknown) => { query.filters.push(["is", key, value]); return chain; },
      maybeSingle: () => chain,
      single: () => chain,
      then: (resolve: (value: Result) => unknown, reject?: (error: unknown) => unknown) => {
        calls.push(query);
        return Promise.resolve(answer(query)).then(resolve, reject);
      },
    };
    return chain;
  } };
}

const event = { collaboratorId: "person", area: "Cível", format: "post" as const, contentRoteiroId: "content", eventDate: "2026-09-10T01:30:00Z" };
const source = { id: "content", approved_by_id: "person", area: "Cível" };

describe("content schedule server integration rules", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key-not-a-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  });

  it("registra a data civil de São Paulo e mantém pendências Post separadas de Reel", async () => {
    const db = database((query) => ({ data: query.table === "content_roteiros" ? source : query.table === "content_schedule_slots" ? [] : null, error: null }));
    mocks.createClient.mockReturnValue(db);
    const { autoLinkContentSchedule } = await import("./server");
    await autoLinkContentSchedule(event);
    const pending = db.calls.find((query) => query.operation === "insert");
    expect(pending?.payload).toMatchObject({ event_date: "2026-09-09", format: "post", collaborator_id: "person", reason: "no_slot" });
    const lookup = db.calls.find((query) => query.table === "content_schedule_links" && query.operation === "select");
    expect(lookup?.filters).toContainEqual(["eq", "format", "post"]);
    expect(lookup?.filters).toContainEqual(["eq", "content_roteiro_id", "content"]);
  });

  it("retry de conteúdo já ligado não ocupa outra vaga e encerra somente sua pendência", async () => {
    const db = database((query) => ({ data: query.table === "content_roteiros" ? source : query.table === "content_schedule_slots" ? [{ id: "slot", due_date: "2026-09-09", area: "Cível", format: "post", collaborator_id: "person", cancelled: false, content_roteiro_id: "content", reel_studio_id: null }] : null, error: null }));
    mocks.createClient.mockReturnValue(db);
    const { autoLinkContentSchedule } = await import("./server");
    expect(await autoLinkContentSchedule(event)).toMatchObject({ status: "already_linked", slotId: "slot" });
    expect(db.calls.some((query) => query.table === "content_schedule_slots" && query.operation === "update")).toBe(false);
    const cleanup = db.calls.find((query) => query.table === "content_schedule_links" && query.operation === "update");
    expect(cleanup?.payload).toMatchObject({ status: "resolved", resolved_slot_id: "slot" });
    expect(cleanup?.filters).toContainEqual(["eq", "format", "post"]);
    expect(cleanup?.filters).toContainEqual(["eq", "collaborator_id", "person"]);
  });

  it("rejeita identidade forjada antes de procurar ou alterar vagas", async () => {
    const db = database(() => ({ data: { ...source, approved_by_id: "other-person" }, error: null }));
    mocks.createClient.mockReturnValue(db);
    const { autoLinkContentSchedule } = await import("./server");
    await expect(autoLinkContentSchedule(event)).rejects.toMatchObject({ status: 403 });
    expect(db.calls).toHaveLength(1);
  });

  it("reconhece o vencedor concorrente sem criar pendência fantasma", async () => {
    let slotReads = 0;
    const db = database((query) => {
      if (query.table === "content_roteiros") return { data: source, error: null };
      if (query.table === "content_schedule_slots" && query.operation === "select") {
        slotReads += 1;
        return { data: slotReads === 1 ? [{ id: "slot", due_date: "2026-09-09", area: "Cível", format: "post", collaborator_id: "person", cancelled: false, content_roteiro_id: null, reel_studio_id: null }] : { id: "slot" }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { autoLinkContentSchedule } = await import("./server");
    expect(await autoLinkContentSchedule(event)).toMatchObject({ status: "already_linked", slotId: "slot" });
    expect(db.calls.some((query) => query.operation === "insert")).toBe(false);
    const attempt = db.calls.find((query) => query.table === "content_schedule_slots" && query.operation === "update");
    expect(attempt?.filters).toEqual(expect.arrayContaining([["eq", "collaborator_id", "person"], ["eq", "format", "post"], ["eq", "area", "Cível"], ["eq", "cancelled", false], ["is", "content_roteiro_id", null]]));
  });

  it("usa schemas reais para rejeitar datas inexistentes e campos arbitrários", async () => {
    const { createContentScheduleSlotSchema, updateContentScheduleSlotSchema } = await import("./server");
    expect(createContentScheduleSlotSchema.safeParse({ area: "Cível", due_date: "2026-02-30", format: "post" }).success).toBe(false);
    expect(updateContentScheduleSlotSchema.safeParse({ created_by: "person" }).success).toBe(false);
    expect(updateContentScheduleSlotSchema.safeParse({ due_date: "2026-09-10", cancelled: false }).success).toBe(true);
  });
});
