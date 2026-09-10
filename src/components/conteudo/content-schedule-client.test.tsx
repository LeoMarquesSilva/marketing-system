import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ContentScheduleResponse } from "@/lib/content-schedule/types";
import {
  AreaMark,
  CollaboratorAvatar,
  mapContentScheduleResponse,
  reconcileSelectedScheduleSlot,
  restoreScheduleDetailsFocus,
  SlotRow,
} from "./content-schedule-client";

function response(): ContentScheduleResponse {
  return {
    areas: ["Tributário"],
    access: { canManage: false, assignableAreas: ["Tributário"], userId: "manager-1" },
    collaborators: [{ id: "person-1", name: "Marina Oliveira", department: "Tributário", avatar_url: null }],
    pendingLinks: [],
    slots: [{
      id: "slot-1",
      area: "Tributário",
      due_date: "2026-09-18",
      format: "post",
      collaborator_id: "person-1",
      collaborator_name: "Marina Oliveira",
      collaborator_avatar_url: null,
      source_key: "source-1",
      source_name: "Marina O.",
      source_status: "Em produção",
      source_notes: null,
      cancelled: false,
      content_roteiro_id: "content-1",
      content_title: "Planejamento tributário",
      reel_studio_id: null,
      reel_title: null,
      instagram_post_id: null,
      publication: null,
      vios_task: { id: "vios-task-1", ci: "12345", status: "Em andamento", title: "Revisar enquadramento" },
      created_at: "2026-09-01T12:00:00.000Z",
      updated_at: "2026-09-10T12:00:00.000Z",
    }],
  };
}

describe("integração dos detalhes do cronograma", () => {
  it("mapeia a tarefa VIOS retornada pela API para o slot exibido", () => {
    const payload = mapContentScheduleResponse(response());

    expect(payload.slots[0].viosTask).toEqual({
      id: "vios-task-1",
      ci: "12345",
      status: "Em andamento",
      title: "Revisar enquadramento",
    });
  });

  it("mantém o painel no mesmo ID com os dados recarregados", () => {
    const payload = mapContentScheduleResponse(response());
    const stale = { ...payload.slots[0], collaborator: null };

    expect(reconcileSelectedScheduleSlot(stale, payload.slots)).toBe(payload.slots[0]);
  });

  it("fecha o painel quando o slot selecionado não existe após recarregar", () => {
    const payload = mapContentScheduleResponse(response());

    expect(reconcileSelectedScheduleSlot(payload.slots[0], [])).toBeNull();
  });

  it("restaura foco no card que abriu os detalhes quando ele continua no DOM", () => {
    const focusCard = vi.fn();
    const focusFallback = vi.fn();

    expect(restoreScheduleDetailsFocus(
      { isConnected: true, focus: focusCard },
      { isConnected: true, focus: focusFallback }
    )).toBe(true);
    expect(focusCard).toHaveBeenCalledOnce();
    expect(focusFallback).not.toHaveBeenCalled();
  });

  it("usa fallback seguro quando o card do popover saiu do DOM", () => {
    const focusCard = vi.fn();
    const focusFallback = vi.fn();

    expect(restoreScheduleDetailsFocus(
      { isConnected: false, focus: focusCard },
      { isConnected: true, focus: focusFallback }
    )).toBe(true);
    expect(focusCard).not.toHaveBeenCalled();
    expect(focusFallback).toHaveBeenCalledOnce();
  });
});

describe("SlotRow", () => {
  it("exibe publicação e métricas de histórico mesmo sem conteúdo vinculado", () => {
    const html = renderToStaticMarkup(
      <SlotRow
        slot={{
          id: "slot-1",
          area: "Tributário",
          date: "2026-09-18",
          format: "post",
          status: "published",
          imported: true,
          sourceName: "Nome da planilha",
          sourceStatus: "Concluída",
          publication: {
            id: "post-1",
            permalink: "https://www.instagram.com/p/example/",
            reach: 1234,
            likes: 87,
            comments: 6,
          },
        }}
        collaborators={[]}
        canAssign={false}
        canManage={false}
        saving={false}
        onAssign={() => undefined}
        onEdit={() => undefined}
      />
    );

    expect(html).toContain("Ver publicação");
    expect(html).toContain("1,2 mil alcance");
    expect(html).toContain("87 curtidas");
    expect(html).toContain("Nome da planilha");
    expect(html).not.toContain("Aguardando escolha");
  });
});

describe("identidade visual do cronograma", () => {
  it("usa iniciais identificáveis enquanto a foto do colaborador não carrega", () => {
    const html = renderToStaticMarkup(
      <CollaboratorAvatar person={{ name: "Marina Oliveira", avatarUrl: "/marina.jpg" }} />
    );
    expect(html).toContain("MO");
    expect(html).toContain("avatar-fallback");
  });

  it("distingue Special Situations com o ícone e a cor da área", () => {
    const html = renderToStaticMarkup(<AreaMark area="Special Situations" />);
    expect(html).toContain("Special Situations");
    expect(html).toContain("lucide-zap");
    expect(html).toContain("bg-orange-100");
  });
});
