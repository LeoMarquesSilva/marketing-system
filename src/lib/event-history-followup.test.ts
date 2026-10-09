import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/utils/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { addEventHistory, deleteEventHistory, updateEventHistoryPayload } from "./eventos";

describe("edição e exclusão de follow-ups", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna o ID salvo para permitir editar ou excluir imediatamente", async () => {
    const chain = { insert: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id: "h1" }, error: null }) };
    chain.insert.mockReturnValue(chain); chain.select.mockReturnValue(chain);
    mocks.from.mockReturnValue(chain);
    expect(await addEventHistory("e1", "tarefa", "Follow-up", null, { taskId: "t1" })).toBe("h1");
  });

  it("restringe a atualização ao evento e ao registro", async () => {
    const chain = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "h1" }, error: null }) };
    for (const name of ["update", "eq", "select"] as const) chain[name].mockReturnValue(chain);
    mocks.from.mockReturnValue(chain);
    expect(await updateEventHistoryPayload("e1", "h1", { taskId: "t1", followUpText: "Corrigido" })).toBe(true);
    expect(chain.eq).toHaveBeenCalledWith("event_id", "e1");
    expect(chain.eq).toHaveBeenCalledWith("id", "h1");
  });

  it("só confirma exclusão de um registro de tarefa no evento correto", async () => {
    const chain = { delete: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "h1" }, error: null }) };
    for (const name of ["delete", "eq", "select"] as const) chain[name].mockReturnValue(chain);
    mocks.from.mockReturnValue(chain);
    expect(await deleteEventHistory("e1", "h1")).toBe(true);
    expect(chain.eq).toHaveBeenCalledWith("event_id", "e1");
    expect(chain.eq).toHaveBeenCalledWith("id", "h1");
    expect(chain.eq).toHaveBeenCalledWith("action_type", "tarefa");
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await deleteEventHistory("e1", "missing")).toBe(false);
  });
});
