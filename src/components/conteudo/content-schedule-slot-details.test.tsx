import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleSlotView } from "./content-schedule-ui-types";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null,
  SheetContent: ({ children, ...props }: { children: ReactNode }) => <aside {...props}>{children}</aside>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => <div data-select-disabled={disabled}>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-select-item={value}>{children}</div>,
  SelectTrigger: ({ children, ...props }: { children: ReactNode; "aria-label"?: string }) => <button {...props}>{children}</button>,
  SelectValue: () => <span>Valor selecionado</span>,
}));

import { ContentScheduleSlotDetails } from "./content-schedule-slot-details";

const collaborators = [
  { id: "person-1", name: "Marina Oliveira", area: "Tributário", avatarUrl: "/marina.jpg" },
  { id: "person-2", name: "Rafael Lima", area: "Tributário", avatarUrl: "/rafael.jpg" },
  { id: "person-3", name: "Carlos Souza", area: "Cível", avatarUrl: "/carlos.jpg" },
];

function slot(overrides: Partial<ScheduleSlotView> = {}): ScheduleSlotView {
  return {
    id: "slot-1",
    area: "Tributário",
    date: "2026-09-18",
    format: "post",
    status: "assigned",
    collaboratorId: "person-1",
    collaborator: collaborators[0],
    sourceName: "Marina O.",
    sourceStatus: "Em produção",
    content: null,
    publication: null,
    viosTask: null,
    ...overrides,
  };
}

function renderDetails(
  selectedSlot: ScheduleSlotView,
  options: {
    canAssign?: boolean;
    saving?: boolean;
    canManageVios?: boolean;
    assignmentFeedback?: { type: "error" | "success"; message: string } | null;
  } = {}
) {
  return renderToStaticMarkup(
    <ContentScheduleSlotDetails
      slot={selectedSlot}
      open
      onOpenChange={() => undefined}
      collaborators={collaborators}
      canAssign={options.canAssign ?? false}
      saving={options.saving ?? false}
      onAssign={() => undefined}
      canManageVios={options.canManageVios}
      assignmentFeedback={options.assignmentFeedback ?? null}
    />
  );
}

describe("ContentScheduleSlotDetails", () => {
  it("expõe o estado vazio quando o tema ainda não foi escolhido", () => {
    expect(renderDetails(slot())).toContain("Tema ainda não escolhido");
  });

  it("expõe a pendência VIOS quando há conteúdo sem tarefa vinculada", () => {
    const html = renderDetails(slot({
      status: "linked",
      content: { id: "content-1", title: "Planejamento tributário" },
    }));

    expect(html).toContain("Planejamento tributário");
    expect(html).toContain("Vínculo VIOS pendente");
  });

  it("permite que Reel também receba vínculo VIOS direto", () => {
    const html = renderDetails(slot({
      format: "reel",
      status: "linked",
      content: { id: "reel-1", title: "Cobrança extrajudicial em vídeo" },
    }));

    expect(html).toContain("Vínculo VIOS pendente");
  });

  it("mostra CI, título e situação da tarefa VIOS vinculada", () => {
    const html = renderDetails(slot({
      status: "linked",
      content: { id: "content-1", title: "Planejamento tributário" },
      viosTask: {
        id: "vios-task-1",
        ci: "12345",
        title: "Revisar enquadramento",
        status: "Em andamento",
        dueDate: "2026-09-18",
        area: "Tributário",
        assigneeId: "person-1",
        assigneeName: "Marina Oliveira",
      },
    }));

    expect(html).toContain("CI 12345");
    expect(html).toContain("Revisar enquadramento");
    expect(html).toContain("Em andamento");
  });

  it("mostra pendência e candidatos PROTOCOLO ao Marketing mesmo sem conteúdo", () => {
    const html = renderDetails(slot({
      viosCandidates: [{
        id: "vios-candidate",
        ci: "99881",
        status: "pendente",
        title: "MATERIAL MARKETING",
        dueDate: "2026-09-18",
        area: "Tributário",
        assigneeId: "person-1",
        assigneeName: "Marina Oliveira",
      }],
    }), { canManageVios: true });

    expect(html).toContain("Vínculo VIOS pendente");
    expect(html).toContain('aria-label="Selecionar tarefa VIOS"');
    expect(html).toContain("CI 99881");
    expect(html).toContain("Marina Oliveira");
  });

  it("oferece seletor shadcn habilitado com avatar e nome por opção da área", () => {
    const html = renderDetails(slot(), { canAssign: true });
    const trigger = html.match(/<button[^>]*aria-label="Trocar responsável"[^>]*>/)?.[0] ?? "";

    expect(trigger).not.toBe("");
    expect(html).toContain('data-select-disabled="false"');
    expect(html).toContain('data-select-item="person-2"');
    expect(html).toMatch(/data-select-item="person-2"[\s\S]*?data-slot="avatar-fallback"[\s\S]*?RL/);
    expect(html).toContain("Rafael Lima");
    expect(html).not.toContain("Carlos Souza");
  });

  it("mostra as duas pessoas e permite escolher quem gravou junto, sem repetir o principal", () => {
    const html = renderDetails(slot({ coCollaboratorId: "person-2", coCollaborator: collaborators[1] }), { canAssign: true });
    const second = html.slice(html.indexOf('aria-label="Segunda pessoa"'));

    expect(html).toContain("Responsáveis");
    expect(html).toContain("Gravou junto (opcional)");
    expect(second).toContain("Sem segunda pessoa");
    expect(second).toContain('data-select-item="person-2"');
    expect(second).not.toContain('data-select-item="person-1"');
  });

  it("só oferece a segunda pessoa quando há responsável principal", () => {
    const html = renderDetails(slot({ collaboratorId: null, collaborator: null }), { canAssign: true });

    expect(html).not.toContain('aria-label="Segunda pessoa"');
  });

  it("mantém a segunda pessoa editável depois do vínculo do conteúdo", () => {
    const html = renderDetails(slot({
      status: "linked",
      content: { id: "content-1", title: "Reel em dupla" },
    }), { canAssign: true });

    expect(html).not.toContain('aria-label="Trocar responsável"');
    expect(html).toContain('aria-label="Segunda pessoa"');
  });

  it("mantém o seletor bloqueado enquanto salva a troca", () => {
    const html = renderDetails(slot(), { canAssign: true, saving: true });

    expect(html).toContain('data-select-disabled="true"');
  });

  it("explica o bloqueio da troca de responsável após o vínculo do conteúdo", () => {
    const html = renderDetails(slot({
      status: "linked",
      content: { id: "content-1", title: "Planejamento tributário" },
    }), { canAssign: true });

    expect(html).toContain("O responsável não pode ser trocado após o vínculo do conteúdo.");
    expect(html).not.toContain('aria-label="Trocar responsável"');
  });

  it("não mostra ação editável para quem não tem permissão", () => {
    const html = renderDetails(slot(), { canAssign: false });

    expect(html).toContain("Marina Oliveira");
    expect(html).not.toContain('aria-label="Trocar responsável"');
  });

  it("não permite trocar o responsável de slot cancelado", () => {
    const html = renderDetails(slot({ status: "cancelled" }), { canAssign: true });

    expect(html).toContain("Cancelado");
    expect(html).not.toContain('aria-label="Trocar responsável"');
  });

  it("mostra link e métricas da publicação existente", () => {
    const html = renderDetails(slot({
      status: "published",
      publication: {
        id: "publication-1",
        permalink: "https://www.instagram.com/p/example/",
        publishedAt: "2026-09-19T15:00:00.000Z",
        reach: 1234,
        likes: 87,
        comments: 6,
      },
    }));

    expect(html).toContain('href="https://www.instagram.com/p/example/"');
    expect(html).toContain("Ver publicação");
    expect(html).toContain("1,2 mil alcance");
    expect(html).toContain("87 curtidas");
    expect(html).toContain("6 comentários");
  });

  it("anuncia erro de atribuição dentro do painel", () => {
    const html = renderDetails(slot(), {
      canAssign: true,
      assignmentFeedback: { type: "error", message: "Não foi possível atualizar o responsável." },
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain("Não foi possível atualizar o responsável.");
  });

  it("anuncia sucesso de atribuição dentro do painel", () => {
    const html = renderDetails(slot(), {
      canAssign: true,
      assignmentFeedback: { type: "success", message: "Responsável atualizado." },
    });

    expect(html).toContain('role="status"');
    expect(html).toContain("Responsável atualizado.");
  });
});
