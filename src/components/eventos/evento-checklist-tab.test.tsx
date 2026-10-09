import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/client", () => ({ supabase: { from: vi.fn() } }));
import { EventoChecklistTab } from "./evento-checklist-tab";
import type { EventTask } from "@/lib/eventos";

const task = (partial: Partial<EventTask>): EventTask => ({ id: "t1", eventId: "e1", title: "Conferir montagem", description: null, assigneeId: null, dueDate: null, status: "pendente", phase: null, sortOrder: 0, marketingRequestId: null, createdAt: "", updatedAt: "", ...partial });
const actions = { onAddTask: vi.fn(), onUpdateTask: vi.fn(), onDeleteTask: vi.fn(), onImportBudget: vi.fn(), onOpenBudget: vi.fn() };

describe("aba de checklist do evento", () => {
  it("mostra somente pendências por padrão e calcula progresso sobre todos os itens", () => {
    const html = renderToStaticMarkup(<EventoChecklistTab eventId="e1" tasks={[task({ category: "decoracao", assigneeId: "ana", assigneeName: "Ana" }), task({ id: "done", title: "Aprovação já concluída", category: "decoracao", status: "concluida" })]} budgetItems={[]} users={[]} isBusy={false} {...actions} />);
    expect(html).toContain("Decoração");
    expect(html).toContain("Conferir montagem");
    expect(html).toContain("Ana");
    expect(html).not.toContain("Aprovação já concluída");
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain("Concluir item: Conferir montagem");
    expect(html).toContain("1 de 2 concluídos");
  });
  it("apresenta um caminho para começar e preserva tarefas sem categoria", () => {
    const empty = renderToStaticMarkup(<EventoChecklistTab eventId="e1" tasks={[]} budgetItems={[]} users={[]} isBusy={false} {...actions} />);
    expect(empty).toContain("Monte o checklist deste evento");
    expect(empty).toContain("Adicionar item");
    const old = renderToStaticMarkup(<EventoChecklistTab eventId="e1" tasks={[task({})]} budgetItems={[]} users={[]} isBusy={true} {...actions} />);
    expect(old).toContain("Sem categoria");
    expect(old).toContain("Sem responsável");
    expect(old).toContain('aria-busy="true"');
  });
});
