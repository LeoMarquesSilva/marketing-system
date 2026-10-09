import { describe, expect, it, vi } from "vitest";
import type { EventBudgetItem, EventHistoryItem, EventTask } from "./eventos";
import { availableChecklistBudget, checklistCategoryKey, filterChecklistTasks, groupChecklistTasks, nextChecklistFollowUp } from "./event-checklist";

vi.mock("@/utils/supabase/client", () => ({ supabase: { from: vi.fn() } }));
import { supabase } from "@/utils/supabase/client";
import { importEventBudgetChecklist, insertEventTask, updateEventTask } from "./eventos";

const task = (partial: Partial<EventTask>): EventTask => ({ id: "t1", eventId: "e1", title: "Conferir montagem", description: null, assigneeId: null, dueDate: null, status: "pendente", phase: null, sortOrder: 0, marketingRequestId: null, createdAt: "", updatedAt: "", ...partial });
const expense = (partial: Partial<EventBudgetItem> = {}): EventBudgetItem => ({ id: "b1", eventId: "e1", category: "decoracao", description: "Arranjos", vendorName: null, amountPlanned: 100, amountQuoted: null, amountActual: null, paymentStatus: "pendente", dueDate: null, paymentDueDate: null, paymentPaidDate: null, invoiceLink: null, receiptLink: null, approvedByUserId: null, notes: "Conferir cores", sortOrder: 0, createdAt: "", ...partial });

describe("checklist por categoria", () => {
  it("agrupa categorias sem duplicar por acento, espaços ou caixa e conserva tarefas antigas", () => {
    const tasks = [task({ category: "decoracao" }), task({ id: "t2", category: " DECORAÇÃO ", status: "concluida" }), task({ id: "t3", category: "  Som   e Luz " }), task({ id: "t4", category: "som e luz" }), task({ id: "old" })];
    const groups = groupChecklistTasks(tasks);
    expect(groups.map(group => [group.label, group.tasks.length, group.completed])).toEqual([["Decoração", 2, 1], ["Som e Luz", 2, 0], ["Sem categoria", 1, 0]]);
    expect(checklistCategoryKey("catering")).toBe(checklistCategoryKey("Buffet / Catering"));
    expect(checklistCategoryKey("fornecedor")).toBe(checklistCategoryKey("Fornecedores"));
  });
  it("combina pendências, categoria e qualquer responsável, com busca sem acentos", () => {
    const tasks = [task({ category: "Decoração", assigneeId: "ana", assigneeIds: ["ana", "bruna"], assignees: [{ id: "bruna", name: "Bruna", avatar: null }], status: "em_andamento" }), task({ id: "done", category: "Decoração", status: "concluida" }), task({ id: "none", category: "Locação" })];
    expect(filterChecklistTasks(tasks, { search: "bruna", status: "pending", category: "decoracao", assignee: "bruna" }).map(item => item.id)).toEqual(["t1"]);
    expect(filterChecklistTasks(tasks, { search: "locacao", status: "pending", category: "all", assignee: "unassigned" }).map(item => item.id)).toEqual(["none"]);
    expect(filterChecklistTasks(tasks, { search: "", status: "done", category: "all", assignee: "all" }).map(item => item.id)).toEqual(["done"]);
    expect(tasks).toHaveLength(3);
  });
  it("prioriza pendentes sem alterar a lista original", () => {
    const tasks = [task({ id: "done", status: "concluida", dueDate: "2026-01-01" }), task({ id: "none" }), task({ id: "dated", dueDate: "2026-10-20" })];
    expect(filterChecklistTasks(tasks, { search: "", status: "all", category: "all", assignee: "all" }).map(item => item.id)).toEqual(["dated", "none", "done"]);
    expect(tasks[0].id).toBe("done");
  });
  it("inclui responsáveis externos na busca e no filtro", () => {
    const tasks = [task({ externalResponsibleName: "Marcele", assigneeId: "leo" }), task({ id: "none" })];
    expect(filterChecklistTasks(tasks, { search: "marcele", status: "all", category: "all", assignee: "external:marcele" }).map(item => item.id)).toEqual(["t1"]);
    expect(filterChecklistTasks(tasks, { search: "", status: "all", category: "all", assignee: "unassigned" }).map(item => item.id)).toEqual(["none"]);
  });
  it("oferece somente despesas do evento ainda não vinculadas", () => {
    const items = [expense(), expense({ id: "b2" }), expense({ id: "other", eventId: "e2" })];
    expect(availableChecklistBudget("e1", items, [task({ budgetItemId: "b1", status: "concluida" })]).map(item => item.id)).toEqual(["b2"]);
  });
  it("mostra o próximo follow-up planejado da mesma tarefa", () => {
    const entry = (id: string, eventId: string, taskId: string, date: string, status = "planejado") => ({ id, eventId, payload: { taskId, followUpDate: date, followUpStatus: status, responsibleName: "Marcele" }, createdAt: "2026-10-08", actionType: "tarefa", actionLabel: "Follow-up", actorUserId: null }) as EventHistoryItem;
    expect(nextChecklistFollowUp(task({}), [entry("done", "e1", "t1", "2026-10-08", "realizado"), entry("other", "e1", "t2", "2026-10-07"), entry("future", "e1", "t1", "2026-10-12"), entry("next", "e1", "t1", "2026-10-09")])).toEqual({ date: "2026-10-09", time: null, responsibleName: "Marcele" });
    expect(nextChecklistFollowUp(task({}), [entry("next", "e1", "t1", "2026-10-09")].map(item => ({ ...item, payload: { ...item.payload, responsibleNames: ["Marcele", "Leonardo"] } })))).toEqual({ date: "2026-10-09", time: null, responsibleName: "Marcele, Leonardo" });
  });
});

describe("persistência do checklist", () => {
  it("não envia despesas de outro evento ao banco", async () => {
    vi.mocked(supabase.from).mockClear();
    expect(await importEventBudgetChecklist("e1", [expense({ eventId: "e2" })])).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it("importa em lote sem sobrescrever andamento e responsáveis de itens já vinculados", async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: "new", event_id: "e1", title: "Arranjos", category: "decoracao", budget_item_id: "b1" }], error: null });
    const upsert = vi.fn(() => ({ select }));
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
    const result = await importEventBudgetChecklist("e1", [expense(), expense()]);
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ event_id: "e1", budget_item_id: "b1", category: "decoracao", title: "Arranjos", description: "Conferir cores", assignee_id: null, assignee_ids: [], status: "pendente" })], { onConflict: "budget_item_id", ignoreDuplicates: true });
    expect(result?.[0]).toMatchObject({ category: "decoracao", budgetItemId: "b1" });
    select.mockResolvedValue({ data: [], error: null });
    expect(await importEventBudgetChecklist("e1", [expense()])).toEqual([]);
    select.mockResolvedValue({ data: null, error: { message: "denied" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await importEventBudgetChecklist("e1", [expense()])).toBeNull();
    log.mockRestore();
  });
  it("salva categoria nas tarefas e permite remover a classificação", async () => {
    const builder = { insert: vi.fn(() => builder), update: vi.fn(() => builder), eq: vi.fn(() => builder), select: vi.fn(() => builder), single: vi.fn().mockResolvedValue({ data: { id: "new", category: "Som", budget_item_id: null }, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "new" }, error: null }) };
    vi.mocked(supabase.from).mockReturnValue(builder as never);
    const input = task({ category: " Som ", externalResponsibleName: " Marcele " });
    expect(await insertEventTask(input)).toMatchObject({ category: "Som", budgetItemId: null });
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ category: "Som", budget_item_id: null, external_responsible_name: "Marcele" }));
    expect(await updateEventTask("new", { category: "" })).toBe(true);
    expect(builder.update).toHaveBeenCalledWith({ category: null });
    expect(await updateEventTask("new", { externalResponsibleName: "" })).toBe(true);
    expect(builder.update).toHaveBeenCalledWith({ external_responsible_name: null });
  });
});
