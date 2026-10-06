import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createSsrClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/utils/supabase/server", () => ({ createClient: mocks.createSsrClient }));

type Query = { table: string; operation: string; payload?: Record<string, unknown>; filters: [string, string, unknown][] };
type Result = { data: unknown; error: { code?: string; message?: string } | null };

function database(answer: (query: Query) => Result) {
  const calls: Query[] = [];
  return { calls, rpc(name: string, payload: Record<string, unknown>) {
    const query: Query = { table: `rpc:${name}`, operation: "rpc", payload, filters: [] };
    calls.push(query);
    return Promise.resolve(answer(query));
  }, from(table: string) {
    const query: Query = { table, operation: "select", filters: [] };
    const chain = {
      select: () => chain,
      update: (payload: Record<string, unknown>) => { query.operation = "update"; query.payload = payload; return chain; },
      insert: (payload: Record<string, unknown>) => { query.operation = "insert"; query.payload = payload; return chain; },
      eq: (key: string, value: unknown) => { query.filters.push(["eq", key, value]); return chain; },
      in: (key: string, value: unknown) => { query.filters.push(["in", key, value]); return chain; },
      gte: (key: string, value: unknown) => { query.filters.push(["gte", key, value]); return chain; },
      lte: (key: string, value: unknown) => { query.filters.push(["lte", key, value]); return chain; },
      lt: (key: string, value: unknown) => { query.filters.push(["lt", key, value]); return chain; },
      is: (key: string, value: unknown) => { query.filters.push(["is", key, value]); return chain; },
      order: () => chain,
      or: (value: unknown) => { query.filters.push(["or", "", value]); return chain; },
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
    mocks.createSsrClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } } }) },
    });
  });

  it("expõe a tarefa VIOS do roteiro em lote e mantém nulo no slot sem roteiro", async () => {
    const db = database((query) => {
      if (query.table === "users" && query.filters.some((filter) => filter[1] === "auth_id")) {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "users") return { data: [], error: null };
      if (query.table === "content_schedule_slots") return { data: [
        { id: "linked", area: "Cível", due_date: "2026-09-10", format: "post", collaborator_id: null, source_key: "linked", source_name: null, source_status: null, source_notes: null, cancelled: false, content_roteiro_id: "roteiro", reel_studio_id: null, instagram_post_id: null, created_at: "2026-09-01", updated_at: "2026-09-01" },
        { id: "empty", area: "Cível", due_date: "2026-09-11", format: "post", collaborator_id: null, source_key: "empty", source_name: null, source_status: null, source_notes: null, cancelled: false, content_roteiro_id: null, reel_studio_id: null, instagram_post_id: null, created_at: "2026-09-01", updated_at: "2026-09-01" },
      ], error: null };
      if (query.table === "content_roteiros") return { data: [
        { id: "roteiro", title: "Conteúdo", marketing_request_id: null, vios_task_id: "vios-row-id" },
      ], error: null };
      if (query.table === "vios_tasks") return { data: [
        { id: "vios-row-id", vios_id: 12345, status: "Em andamento", tarefa: "Preparar conteúdo", data_limite: "2026-09-10", area_processo: "Cível", assignee_id: null, etiquetas_tarefa: "PROTOCOLO", is_cancelled: false },
      ], error: null };
      return { data: [], error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { getContentSchedule } = await import("./server");

    const result = await getContentSchedule("2026-09");
    const linkedSlot = result.slots.find((slot) => slot.id === "linked")!;
    const emptySlot = result.slots.find((slot) => slot.id === "empty")!;

    expect(linkedSlot.vios_task).toEqual({
      id: "vios-row-id",
      ci: "12345",
      status: "Em andamento",
      title: "Preparar conteúdo",
      due_date: "2026-09-10",
      area: "Cível",
      assignee_id: null,
      assignee_name: null,
    });
    expect(emptySlot.vios_task).toBeNull();
    const viosCalls = db.calls.filter((query) => query.table === "vios_tasks");
    expect(viosCalls.some((query) =>
      query.filters.some((filter) =>
        filter[0] === "in" && filter[1] === "id" && String(filter[2]).includes("vios-row-id")
      )
    )).toBe(true);
  });

  it("não herda a tarefa VIOS do Post no Reel derivado", async () => {
    const db = database((query) => {
      if (query.table === "users" && query.filters.some((filter) => filter[1] === "auth_id")) {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "users") return { data: [], error: null };
      if (query.table === "content_schedule_slots") return { data: [
        { id: "derived-reel", area: "Recuperação de Crédito", due_date: "2026-10-14", format: "reel", collaborator_id: null, source_key: "derived-reel", source_name: null, source_status: null, source_notes: null, cancelled: false, content_roteiro_id: "source-post", reel_studio_id: "reel", instagram_post_id: null, created_at: "2026-09-01", updated_at: "2026-09-01" },
      ], error: null };
      if (query.table === "content_roteiros") return { data: [
        { id: "source-post", title: "Post de origem", marketing_request_id: null, vios_task_id: "post-vios" },
      ], error: null };
      if (query.table === "reel_studio_items") return { data: [
        { id: "reel", title: "Reel derivado" },
      ], error: null };
      if (query.table === "vios_tasks") return { data: [
        { id: "post-vios", vios_id: 9876, status: "Concluído", tarefa: "Produzir Post" },
      ], error: null };
      return { data: [], error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { getContentSchedule } = await import("./server");

    const result = await getContentSchedule("2026-10");

    expect(result.slots[0].vios_task).toBeNull();
    expect(db.calls.filter((query) =>
      query.table === "vios_tasks" &&
      query.filters.some((filter) => filter[0] === "in" && filter[1] === "id")
    )).toHaveLength(0);
  });

  it("prioriza o vínculo VIOS direto do slot sobre o fallback do roteiro", async () => {
    const db = database((query) => {
      if (query.table === "users" && query.filters.some((filter) => filter[1] === "auth_id")) {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "users") return { data: [], error: null };
      if (query.table === "content_schedule_slots") return { data: [{
        id: "slot", area: "Cível", due_date: "2026-09-10", format: "post", collaborator_id: null,
        source_key: "slot", source_name: null, source_status: null, source_notes: null, cancelled: false,
        content_roteiro_id: "roteiro", reel_studio_id: null, instagram_post_id: null,
        vios_task_id: "direct", vios_link_origin: "manual", vios_linked_at: "2026-09-01", vios_linked_by: "profile",
        created_at: "2026-09-01", updated_at: "2026-09-01",
      }], error: null };
      if (query.table === "content_roteiros") return { data: [{
        id: "roteiro", title: "Conteúdo", marketing_request_id: null, vios_task_id: "fallback",
      }], error: null };
      if (query.table === "vios_tasks") return { data: [
        { id: "direct", vios_id: 111, status: "pendente", tarefa: "Direta", data_limite: "2026-09-10", area_processo: "Cível", assignee_id: null, etiquetas_tarefa: "PROTOCOLO", is_cancelled: false },
        { id: "fallback", vios_id: 222, status: "pendente", tarefa: "Legada", data_limite: "2026-09-10", area_processo: "Cível", assignee_id: null, etiquetas_tarefa: "PROTOCOLO", is_cancelled: false },
      ], error: null };
      return { data: [], error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { getContentSchedule } = await import("./server");

    const result = await getContentSchedule("2026-09");
    expect(result.slots[0].vios_task).toMatchObject({ id: "direct", ci: "111", title: "Direta" });
    expect(result.slots[0].vios_link_origin).toBe("manual");
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
    const slotLookup = db.calls.find((query) => query.table === "content_schedule_slots" && query.operation === "select");
    expect(slotLookup?.filters).toContainEqual([
      "or",
      "",
      "content_roteiro_id.eq.content,and(due_date.gte.2026-08-26,due_date.lte.2026-09-23)",
    ]);
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

  it("impede vincular publicação de outra área", async () => {
    const db = database((query) => {
      if (query.table === "users") {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "instagram_posts") {
        return { data: { id: "post", area: "Cível", areas: [], media_type: "IMAGE" }, error: null };
      }
      if (query.table === "content_schedule_slots") {
        return { data: { id: "slot", area: "Trabalhista", format: "post", cancelled: false }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { linkPublicationToSlot } = await import("./server");

    await expect(linkPublicationToSlot("slot", "post")).rejects.toMatchObject({
      status: 409,
      code: "AREA_MISMATCH",
    });
    expect(db.calls.some((query) => query.operation === "update")).toBe(false);
  });

  it("impede vincular publicação a uma data cancelada", async () => {
    const db = database((query) => {
      if (query.table === "users") {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "instagram_posts") {
        return { data: { id: "post", area: "Cível", areas: [], media_type: "IMAGE" }, error: null };
      }
      if (query.table === "content_schedule_slots") {
        return { data: { id: "slot", area: "Cível", format: "post", cancelled: true }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { linkPublicationToSlot } = await import("./server");

    await expect(linkPublicationToSlot("slot", "post")).rejects.toMatchObject({
      status: 409,
      code: "CANCELLED_SLOT",
    });
    expect(db.calls.some((query) => query.operation === "update")).toBe(false);
  });

  it("traduz conflito de publicação duplicada em erro acionável", async () => {
    const db = database((query) => {
      if (query.table === "users") {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "instagram_posts") {
        return { data: { id: "post", area: "Cível", areas: [], media_type: "IMAGE" }, error: null };
      }
      if (query.table === "content_schedule_slots" && query.operation === "select") {
        return { data: { id: "slot", area: "Cível", format: "post", cancelled: false }, error: null };
      }
      if (query.table === "content_schedule_slots" && query.operation === "update") {
        return { data: null, error: { code: "23505" } };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { linkPublicationToSlot } = await import("./server");

    await expect(linkPublicationToSlot("slot", "post")).rejects.toMatchObject({
      status: 409,
      code: "PUBLICATION_ALREADY_LINKED",
    });
  });

  it("vincula manualmente somente PROTOCOLO compatível e registra autoria", async () => {
    const taskId = "11111111-1111-4111-8111-111111111111";
    const db = database((query) => {
      if (query.table === "users") {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "content_schedule_slots" && query.operation === "select") {
        return { data: { id: "slot", area: "Insolvência", due_date: "2026-09-18", collaborator_id: "person", cancelled: false, vios_task_id: null, vios_link_origin: null, updated_at: "v1" }, error: null };
      }
      if (query.table === "vios_tasks") {
        return { data: { id: taskId, etiquetas_tarefa: "PROTOCOLO", is_cancelled: false, data_limite: "2026-09-18", area_processo: "Reestruturação", assignee_id: "person" }, error: null };
      }
      if (query.table === "content_schedule_slots" && query.operation === "update") {
        return { data: { id: "slot" }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { linkContentScheduleViosTask } = await import("./server");

    await expect(linkContentScheduleViosTask("slot", { vios_task_id: taskId })).resolves.toBeUndefined();
    expect(db.calls.find((query) => query.operation === "update")?.payload).toMatchObject({
      vios_task_id: taskId,
      vios_link_origin: "manual",
      vios_linked_by: "profile",
    });
  });

  it("exige confirmação antes de substituir vínculo VIOS manual", async () => {
    const db = database((query) => {
      if (query.table === "users") {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "content_schedule_slots") {
        return { data: { id: "slot", area: "Cível", due_date: "2026-09-18", cancelled: false, vios_task_id: "old", vios_link_origin: "manual", updated_at: "v1" }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { linkContentScheduleViosTask } = await import("./server");

    await expect(linkContentScheduleViosTask("slot", { vios_task_id: null }))
      .rejects.toMatchObject({ status: 409, code: "CONFIRM_MANUAL_VIOS_CHANGE" });
    expect(db.calls.some((query) => query.operation === "update")).toBe(false);
  });

  it("resolve vaga e pendência por uma única operação transacional", async () => {
    const db = database((query) => {
      if (query.table === "users") {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "content_schedule_links") {
        return { data: { id: "link", status: "pending", area: "Cível", format: "post", collaborator_id: "person" }, error: null };
      }
      if (query.table === "content_schedule_slots") {
        return { data: { id: "slot", area: "Cível", format: "post", collaborator_id: "person", cancelled: false }, error: null };
      }
      if (query.table === "rpc:resolve_content_schedule_link") {
        return { data: "resolved", error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { resolvePendingScheduleLink } = await import("./server");

    await expect(resolvePendingScheduleLink("link", "slot")).resolves.toBeUndefined();
    expect(db.calls.filter((query) => query.operation === "rpc")).toEqual([
      expect.objectContaining({
        table: "rpc:resolve_content_schedule_link",
        payload: { p_link_id: "link", p_slot_id: "slot" },
      }),
    ]);
    expect(db.calls.some((query) => query.operation === "update")).toBe(false);
  });

  it("cria uma nova data a partir da referência quando a pendência não tem vaga", async () => {
    const slotId = "22222222-2222-4222-8222-222222222222";
    const db = database((query) => {
      if (query.table === "users") {
        return { data: { id: "profile", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "rpc:create_content_schedule_slot_from_link") {
        return { data: slotId, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { createSlotFromPendingScheduleLink } = await import("./server");

    await expect(createSlotFromPendingScheduleLink("pending")).resolves.toBe(slotId);
    expect(db.calls.find((query) => query.table === "rpc:create_content_schedule_slot_from_link")?.payload)
      .toEqual({ p_link_id: "pending", p_created_by: "profile" });
  });

  it("vincula publicação do Insights pela pessoa, área, formato e data", async () => {
    const db = database((query) => {
      if (query.table === "instagram_posts") {
        return { data: {
          id: "instagram",
          published_at: "2026-09-11T15:00:00Z",
          area: "Societário e Contratos",
          areas: ["Societário e Contratos"],
          solicitante_id: "person",
          solicitantes: [{ id: "person", name: "Pessoa" }],
          media_product_type: "FEED",
          media_type: "IMAGE",
          content_type: "post",
        }, error: null };
      }
      if (query.table === "content_schedule_slots" && query.operation === "select") {
        const isExistingLookup = query.filters.some((filter) =>
          filter[0] === "eq" && filter[1] === "instagram_post_id"
        );
        return isExistingLookup
          ? { data: null, error: null }
          : { data: [{
              id: "slot",
              area: "Societário e Contratos",
              due_date: "2026-09-10",
              format: "post",
              collaborator_id: "person",
              cancelled: false,
              instagram_post_id: null,
            }], error: null };
      }
      if (query.table === "content_schedule_slots" && query.operation === "update") {
        return { data: { id: "slot" }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { autoLinkInstagramPublicationToSchedule } = await import("./server");

    await expect(autoLinkInstagramPublicationToSchedule("instagram"))
      .resolves.toEqual({ status: "matched", slotId: "slot" });
    const candidateLookup = db.calls.find((query) =>
      query.table === "content_schedule_slots" &&
      query.operation === "select" &&
      query.filters.some((filter) => filter[0] === "or")
    );
    expect(candidateLookup?.filters).toEqual(expect.arrayContaining([
      ["or", "", "collaborator_id.in.(person),co_collaborator_id.in.(person)"],
      ["eq", "format", "post"],
      ["gte", "due_date", "2026-08-28"],
      ["lte", "due_date", "2026-09-25"],
    ]));
  });

  it("permite ao gestor atribuir somente colaborador da área gerenciada", async () => {
    const targetId = "11111111-1111-4111-8111-111111111111";
    let slotReads = 0;
    const db = database((query) => {
      if (query.table === "users" && query.filters.some((filter) => filter[1] === "auth_id")) {
        return { data: { id: "manager", role: null, department: "Cível", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "users") {
        return { data: { id: targetId, department: "Cível", is_active: true }, error: null };
      }
      if (query.table === "hr_employees") {
        const targetLookup = query.filters.some((filter) => filter[1] === "user_id" && filter[2] === targetId);
        return { data: targetLookup
          ? { department: "Cível", is_active: true }
          : { position: "Gerente", department: "Cível", is_active: true }, error: null };
      }
      if (query.table === "content_schedule_slots" && query.operation === "select") {
        slotReads += 1;
        return { data: { id: "slot", area: "Cível", format: "post", collaborator_id: slotReads > 1 ? targetId : null, cancelled: false, content_roteiro_id: null, reel_studio_id: null, updated_at: slotReads > 1 ? "v2" : "v1" }, error: null };
      }
      if (query.table === "rpc:assign_content_schedule_slot_people") {
        return { data: "updated", error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { updateContentScheduleSlot } = await import("./server");

    await expect(updateContentScheduleSlot("slot", { collaborator_id: targetId }))
      .resolves.toMatchObject({ collaborator_id: targetId });
    expect(db.calls.find((query) => query.table === "rpc:assign_content_schedule_slot_people")?.payload)
      .toMatchObject({
        p_slot_id: "slot",
        p_expected_updated_at: "v1",
        p_collaborator_id: targetId,
        p_co_collaborator_id: null,
        p_changed_by_id: "manager",
        p_recipient_id: "2f08c695-770e-47ce-b4e4-ce27fa414df8",
      });
    expect(db.calls.some((query) => query.operation === "update")).toBe(false);
  });

  it("normaliza o par de responsáveis: segunda pessoa exige principal e não repete", async () => {
    const { normalizeSlotPeople } = await import("./server");
    expect(normalizeSlotPeople("a", "b")).toEqual({ collaborator_id: "a", co_collaborator_id: "b" });
    expect(normalizeSlotPeople("a", "a")).toEqual({ collaborator_id: "a", co_collaborator_id: null });
    expect(normalizeSlotPeople(null, "b")).toEqual({ collaborator_id: "b", co_collaborator_id: null });
    expect(normalizeSlotPeople(null, null)).toEqual({ collaborator_id: null, co_collaborator_id: null });
  });

  it("gestor adiciona quem gravou junto mantendo o responsável principal", async () => {
    const primaryId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";
    let slotReads = 0;
    const db = database((query) => {
      if (query.table === "users" && query.filters.some((filter) => filter[1] === "auth_id")) {
        return { data: { id: "manager", role: null, department: "Cível", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "users") return { data: { id: "someone", department: "Cível", is_active: true }, error: null };
      if (query.table === "hr_employees") {
        const personLookup = query.filters.some((filter) => filter[1] === "user_id" && [primaryId, secondId].includes(String(filter[2])));
        return { data: personLookup
          ? { department: "Cível", is_active: true }
          : { position: "Gerente", department: "Cível", is_active: true }, error: null };
      }
      if (query.table === "content_schedule_slots" && query.operation === "select") {
        slotReads += 1;
        return { data: { id: "slot", area: "Cível", format: "reel", collaborator_id: primaryId, co_collaborator_id: slotReads > 1 ? secondId : null, cancelled: false, content_roteiro_id: null, reel_studio_id: "reel", updated_at: slotReads > 1 ? "v2" : "v1" }, error: null };
      }
      if (query.table === "rpc:assign_content_schedule_slot_people") return { data: "updated", error: null };
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { updateContentScheduleSlot } = await import("./server");

    // O reel já está vinculado: o principal fica travado, mas a segunda pessoa pode entrar.
    await expect(updateContentScheduleSlot("slot", { co_collaborator_id: secondId }))
      .resolves.toMatchObject({ co_collaborator_id: secondId });
    expect(db.calls.find((query) => query.table === "rpc:assign_content_schedule_slot_people")?.payload)
      .toMatchObject({ p_collaborator_id: primaryId, p_co_collaborator_id: secondId, p_expected_updated_at: "v1" });
  });

  it("liga o reel criado por quem gravou junto à vaga do principal", async () => {
    const reelEvent = { collaboratorId: "second", area: "Cível", format: "reel" as const, reelStudioId: "reel", eventDate: "2026-09-10T15:00:00Z" };
    const db = database((query) => {
      if (query.table === "reel_studio_items") return { data: { id: "reel", area: "Cível", source_content_id: null }, error: null };
      if (query.table === "reel_studio_assignees") return { data: { user_id: "second" }, error: null };
      if (query.table === "content_schedule_slots" && query.operation === "select") {
        return { data: [{ id: "slot", due_date: "2026-09-12", area: "Cível", format: "reel", collaborator_id: "primary", co_collaborator_id: "second", cancelled: false, content_roteiro_id: null, reel_studio_id: null }], error: null };
      }
      if (query.table === "content_schedule_slots" && query.operation === "update") return { data: { id: "slot" }, error: null };
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { autoLinkContentSchedule } = await import("./server");

    expect(await autoLinkContentSchedule(reelEvent)).toMatchObject({ status: "matched", slotId: "slot" });
    const lookup = db.calls.find((query) => query.table === "content_schedule_slots" && query.operation === "select");
    expect(lookup?.filters).toContainEqual(["or", "", "collaborator_id.eq.second,co_collaborator_id.eq.second"]);
    const claim = db.calls.find((query) => query.table === "content_schedule_slots" && query.operation === "update");
    expect(claim?.payload).toEqual({ reel_studio_id: "reel" });
    expect(claim?.filters).toEqual(expect.arrayContaining([
      ["eq", "collaborator_id", "primary"],
      ["eq", "co_collaborator_id", "second"],
      ["is", "reel_studio_id", null],
    ]));
    expect(db.calls.some((query) => query.table === "content_schedule_links" && query.operation === "insert")).toBe(false);
  });

  it("retorna ao gestor somente tarefas e equipe das áreas gerenciadas", async () => {
    const db = database((query) => {
      if (query.table === "users" && query.filters.some((filter) => filter[1] === "auth_id")) {
        return { data: { id: "manager", role: null, department: "Cível", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "users" && query.filters.some((filter) => filter[0] === "in")) {
        return { data: [{ id: "person-civel", name: "Pessoa Cível", avatar_url: null }], error: null };
      }
      if (query.table === "users") {
        return { data: [
          { id: "person-civel", name: "Pessoa Cível", department: "Cível", avatar_url: null },
          { id: "person-trabalhista", name: "Pessoa Trabalhista", department: "Trabalhista", avatar_url: null },
        ], error: null };
      }
      if (query.table === "hr_employees" && query.filters.some((filter) => filter[0] === "in")) {
        return { data: [
          { user_id: "person-civel", department: "Cível", is_active: true },
          { user_id: "person-trabalhista", department: "Trabalhista", is_active: true },
        ], error: null };
      }
      if (query.table === "hr_employees") {
        return { data: { position: "Gerente", department: "Cível", is_active: true }, error: null };
      }
      if (query.table === "content_schedule_slots") {
        const base = { due_date: "2026-09-10", format: "post", source_key: "source", source_name: null, source_status: null, source_notes: null, cancelled: false, content_roteiro_id: null, reel_studio_id: null, instagram_post_id: null, created_at: "2026-09-01", updated_at: "2026-09-01" };
        return { data: [
          { ...base, id: "slot-civel", area: "Cível", collaborator_id: "person-civel" },
          { ...base, id: "slot-trabalhista", area: "Trabalhista", collaborator_id: "person-trabalhista" },
        ], error: null };
      }
      return { data: [], error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { getContentSchedule } = await import("./server");

    const result = await getContentSchedule("2026-09");

    expect(result.slots.map((item) => item.id)).toEqual(["slot-civel"]);
    expect(result.collaborators.map((item) => item.id)).toEqual(["person-civel"]);
    expect(result.areas).toEqual(["Cível"]);
    expect(result.access).toMatchObject({
      canManage: false,
      assignableAreas: ["Cível"],
    });
  });

  it("impede gestor de alterar responsável fora do escopo ou em data cancelada", async () => {
    for (const current of [
      { area: "Trabalhista", cancelled: false, code: "FORBIDDEN" },
      { area: "Cível", cancelled: true, code: "CANCELLED_SLOT" },
    ]) {
      const db = database((query) => {
        if (query.table === "users") {
          return { data: { id: "manager", role: null, department: "Cível", permissions: [], is_active: true }, error: null };
        }
        if (query.table === "hr_employees") {
          return { data: { position: "Gerente", department: "Cível", is_active: true }, error: null };
        }
        if (query.table === "content_schedule_slots") {
          return { data: { id: "slot", area: current.area, format: "post", collaborator_id: null, cancelled: current.cancelled, content_roteiro_id: null, reel_studio_id: null, updated_at: "v1" }, error: null };
        }
        return { data: null, error: null };
      });
      mocks.createClient.mockReturnValue(db);
      const { updateContentScheduleSlot } = await import("./server");

      await expect(updateContentScheduleSlot("slot", { collaborator_id: null }))
        .rejects.toMatchObject({ code: current.code });
      expect(db.calls.some((query) => query.operation === "update")).toBe(false);
      vi.resetModules();
    }
  });

  it("reserva a revisão em massa de nomes importados ao Marketing", async () => {
    const db = database((query) => {
      if (query.table === "users") {
        return { data: { id: "manager", role: null, department: "Cível", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") {
        return { data: { position: "Gerente", department: "Cível", is_active: true }, error: null };
      }
      return { data: [], error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { getContentScheduleAssigneeReview } = await import("./server");

    await expect(getContentScheduleAssigneeReview(2026)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    expect(db.calls.some((query) => query.table === "content_schedule_slots")).toBe(false);
  });

  it("entrega notificações de troca somente ao Leonardo", async () => {
    const leonardoId = "2f08c695-770e-47ce-b4e4-ce27fa414df8";
    const notification = {
      id: "notification",
      slot_id: "slot",
      changed_by_name: "Gestora",
      previous_collaborator_name: "Pessoa A",
      new_collaborator_name: "Pessoa B",
      area: "Insolvência",
      due_date: "2026-09-20",
      format: "post",
      source_name: "Tarefa",
      source_status: null,
      source_notes: null,
      vios_ci: null,
      vios_title: null,
      created_at: "2026-09-15T12:00:00Z",
    };
    const db = database((query) => {
      if (query.table === "users") {
        return { data: { id: leonardoId, role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      if (query.table === "content_schedule_assignment_notifications") {
        return { data: [notification], error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(db);
    const { listContentScheduleAssignmentNotifications } = await import("./server");

    await expect(listContentScheduleAssignmentNotifications()).resolves.toEqual([
      { ...notification, area: "Reestruturação" },
    ]);

    vi.resetModules();
    const otherDb = database((query) => {
      if (query.table === "users") {
        return { data: { id: "other", role: "admin", department: "Marketing", permissions: [], is_active: true }, error: null };
      }
      if (query.table === "hr_employees") return { data: null, error: null };
      return { data: [], error: null };
    });
    mocks.createClient.mockReturnValue(otherDb);
    const server = await import("./server");

    await expect(server.listContentScheduleAssignmentNotifications()).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    expect(otherDb.calls.some((query) => query.table === "content_schedule_assignment_notifications")).toBe(false);
  });
});
