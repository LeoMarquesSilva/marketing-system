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

import { ContentScheduleSlotDetails } from "./content-schedule-slot-details";

const collaborators = [
  { id: "person-1", name: "Marina Oliveira", area: "Tributário", avatarUrl: "/marina.jpg" },
  { id: "person-2", name: "Rafael Lima", area: "Tributário" },
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
  options: { canAssign?: boolean; saving?: boolean } = {}
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
    />
  );
}

describe("ContentScheduleSlotDetails", () => {
  it("expõe o estado vazio quando o tema ainda não foi escolhido", () => {
    expect(renderDetails(slot())).toContain("Tema ainda não escolhido");
  });

  it("expõe o estado vazio do VIOS quando há conteúdo sem tarefa vinculada", () => {
    const html = renderDetails(slot({
      status: "linked",
      content: { id: "content-1", title: "Planejamento tributário" },
    }));

    expect(html).toContain("Planejamento tributário");
    expect(html).toContain("Não vinculado ao VIOS");
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
      },
    }));

    expect(html).toContain("CI 12345");
    expect(html).toContain("Revisar enquadramento");
    expect(html).toContain("Em andamento");
  });

  it("oferece seletor habilitado para trocar responsável em slot sem conteúdo", () => {
    const html = renderDetails(slot(), { canAssign: true });
    const trigger = html.match(/<select[^>]*aria-label="Trocar responsável"[^>]*>/)?.[0] ?? "";

    expect(trigger).not.toBe("");
    expect(trigger).not.toMatch(/\sdisabled(?:=|\s|>)/);
    expect(html).toContain("Rafael Lima");
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
});
