import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("@/utils/supabase/client", () => ({ supabase: { from: vi.fn() } }));
import { supabase } from "@/utils/supabase/client";
import { fetchEventPlannerSnapshot, updateEventTask, deleteEventTask } from "./eventos";

function client(pages: Record<string, Record<string, unknown>[]>, failedTable?: string) {
  const writes = vi.fn();
  const from = vi.fn((table: string) => {
    let ids: string[] | null = null;
    const builder = {
      select: vi.fn(() => builder), order: vi.fn(() => builder), not: vi.fn(() => builder),
      in: vi.fn((_column: string, values: string[]) => { ids = values; return builder; }),
      range: vi.fn(async (start: number, end: number) => ({
        error: table === failedTable ? { message: "denied" } : null,
        data: (pages[table] ?? []).filter(row => !ids || ids.includes(String(row.event_id))).slice(start, end + 1),
      })), insert: writes, update: writes, delete: writes,
    };
    return builder;
  });
  return { db: { from } as unknown as SupabaseClient, from, writes };
}

describe("Planner compartilhado dos eventos", () => {
  it("não confirma movimentação ou exclusão quando nenhuma linha foi autorizada ou encontrada", async () => {
    const result = vi.fn().mockResolvedValue({ data: null, error: null });
    const builder = { update: vi.fn(() => builder), delete: vi.fn(() => builder), eq: vi.fn(() => builder), select: vi.fn(() => builder), maybeSingle: result };
    vi.mocked(supabase.from).mockReturnValue(builder as never);
    expect(await updateEventTask("missing", { status: "concluida" })).toBe(false);
    expect(await deleteEventTask("missing")).toBe(false);
    result.mockResolvedValue({ data: { id: "task1" }, error: null });
    expect(await updateEventTask("task1", { status: "em_andamento" })).toBe(true);
    expect(await updateEventTask("task1", { assigneeIds: ["u1", "u2"] })).toBe(true);
    expect(builder.update).toHaveBeenLastCalledWith({ assignee_id: "u1", assignee_ids: ["u1", "u2"] });
  });
  it("pagina dados com o cliente autenticado sem criar cópias ou incluir eventos de módulo separado", async () => {
    const events = Array.from({ length: 501 }, (_, index) => ({ id: `e${index}`, name: "Evento de teste", year: 2026, event_series: index === 500 ? { slug: "cafe-com-cultura" } : null }));
    const mock = client({ events, event_tasks: [{ id: "task1", event_id: "e0", title: "Ação", status: "pendente", users: [{ name: "Ana" }] }] });
    const result = await fetchEventPlannerSnapshot(mock.db);
    expect(result.events).toHaveLength(500);
    expect(result.tasks.map(task => [task.id, task.eventId, task.assigneeName])).toEqual([["task1", "e0", "Ana"]]);
    expect(mock.from.mock.calls.filter(([table]) => table === "events")).toHaveLength(2);
    expect(mock.writes).not.toHaveBeenCalled();
  });
  it("informa falha de leitura em vez de apresentar um Planner vazio como sucesso", async () => {
    const mock = client({ events: [{ id: "e1", name: "Teste", event_series: null }] }, "event_tasks");
    await expect(fetchEventPlannerSnapshot(mock.db)).rejects.toThrow("Não foi possível carregar as tarefas");
    expect(mock.writes).not.toHaveBeenCalled();
  });
});
