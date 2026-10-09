import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
import { EventTaskFiles, EventTaskFollowUps, taskTimestamp } from "./event-task-detail-sections";
import { EventTaskFollowUpResponsible } from "./event-task-followup-responsible";
import type { EventAttachment, EventHistoryItem, EventTask } from "@/lib/eventos";

const task = { id: "t1", eventId: "e1" } as EventTask;
const note = (partial: Partial<EventHistoryItem>): EventHistoryItem => ({ id: "n1", eventId: "e1", actionType: "tarefa", actionLabel: "Observação", payload: { taskId: "t1", observation: "Entrega confirmada" }, actorUserId: null, actorUserName: "Ana", createdAt: "2026-10-08T12:00:00Z", ...partial });
const file = (partial: Partial<EventAttachment>): EventAttachment => ({ id: "f1", eventId: "e1", relatedEntity: "tarefa", relatedId: "t1", fileType: "contrato", title: "Contrato confirmado", url: "https://example.test/contrato.pdf", storagePath: null, provider: "external_link", isPublic: false, uploadedByUserId: null, createdAt: "2026-10-08T12:00:00Z", ...partial });

describe("detalhes da tarefa", () => {
  it("exibe follow-ups datados e registros anteriores apenas da tarefa e do evento atuais", () => {
    const html = renderToStaticMarkup(<EventTaskFollowUps task={task} users={[]} disabled={false} onEdit={async () => true} onDelete={async () => true} history={[note({}), note({ id: "f1", payload: { taskId: "t1", followUpText: "Ligar para Marcele", followUpDate: "2026-10-09", followUpTime: "10:00", responsibleName: "Marcele", followUpStatus: "planejado" } }), note({ id: "other-task", payload: { taskId: "t2", observation: "Nota de outra tarefa" } }), note({ id: "other-event", eventId: "e2", payload: { taskId: "t1", observation: "Nota de outro evento" } })]} />);
    expect(html).toContain("Entrega confirmada");
    expect(html).toContain("Ligar para Marcele");
    expect(html).toContain("09/10/2026 às 10:00");
    expect(html).toContain('aria-label="Marcele"');
    expect(html).toContain("Registrado por Ana");
    expect(html).toContain('aria-label="Editar follow-up de 09/10/2026"');
    expect(html).toContain('aria-label="Excluir follow-up de 09/10/2026"');
    expect(html).toContain('aria-label="Editar follow-up de data indefinida"');
    expect(html).not.toContain("Nota de outra");
  });
  it("mostra todos os responsáveis de um follow-up e mantém o legado", () => {
    const html = renderToStaticMarkup(<EventTaskFollowUps task={task} users={[]} disabled={false} history={[note({ id: "new", payload: { taskId: "t1", followUpText: "Retorno", responsibleNames: ["Marcele", "Leonardo"], followUpStatus: "planejado" } }), note({ id: "legacy", payload: { taskId: "t1", observation: "Contato anterior", responsibleName: "Lígia" } })]} />);
    expect(html).toContain('aria-label="Marcele"');
    expect(html).toContain('aria-label="Leonardo"');
    expect(html).toContain('aria-label="Lígia"');
  });
  it("mostra seleção múltipla com avatar e remoção individual", () => {
    const html = renderToStaticMarkup(<EventTaskFollowUpResponsible users={[]} value={["Marcele", "Leonardo"]} onChange={() => undefined} />);
    expect(html).toContain("2 responsáveis");
    expect(html).toContain('aria-label="Remover Marcele"');
    expect(html).toContain('aria-label="Remover Leonardo"');
  });
  it("abre apenas arquivos vinculados à tarefa no mesmo evento", () => {
    const html = renderToStaticMarkup(<EventTaskFiles task={task} disabled={false} attachments={[file({}), file({ id: "other-event", eventId: "e2", title: "Arquivo de outro evento" }), file({ id: "unlinked", relatedId: null, title: "Arquivo sem vínculo" })]} />);
    expect(html).toContain("Contrato confirmado");
    expect(html).toContain('href="https://example.test/contrato.pdf"');
    expect(html).not.toContain("Arquivo de outro evento");
    expect(html).not.toContain("Arquivo sem vínculo");
  });
  it("formata instantes em São Paulo e trata datas ausentes sem inventar informações", () => {
    expect(taskTimestamp("2026-10-08T01:00:00Z")).toBe("07/10/2026, 22:00");
    expect(taskTimestamp("invalid")).toBe("Não registrado");
    expect(taskTimestamp(null)).toBe("Não registrado");
  });
});
