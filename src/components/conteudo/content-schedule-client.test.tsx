import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContentScheduleResponse } from "@/lib/content-schedule/types";
import {
  AreaMark,
  CollaboratorAvatar,
  isCurrentScheduleAssignmentOperation,
  isCurrentScheduleLoadOperation,
  mapContentScheduleResponse,
  reconcileSelectedScheduleSlot,
  restoreScheduleDetailsFocus,
  runScheduleLoad,
  type ScheduleAssignmentOperation,
  shouldRefreshScheduleAfterAssignment,
  SlotRow,
} from "./content-schedule-client";

afterEach(() => vi.restoreAllMocks());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

describe("reload assíncrono do cronograma", () => {
  function setup() {
    const request = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockReturnValue(request.promise);
    const state = { data: null as ReturnType<typeof mapContentScheduleResponse> | null, error: null as string | null, loading: false };
    const options = {
      month: "2026-09",
      ownsLoad: () => true,
      onData: (data: ReturnType<typeof mapContentScheduleResponse>) => { state.data = data; },
      onError: (error: string | null) => { state.error = error; },
      onLoading: (loading: boolean) => { state.loading = loading; },
    };
    return { request, state, options };
  }

  it("aplica dados de A no mesmo mês mesmo quando B abre durante o GET", async () => {
    const { request, state, options } = setup();
    const operation = { generation: 1, slotId: "slot-a", month: "2026-09" };
    let activeOperation: ScheduleAssignmentOperation | null = operation;
    const pending = runScheduleLoad({
      ...options,
      shouldApply: () => shouldRefreshScheduleAfterAssignment(operation, "2026-09"),
      shouldReportError: () => isCurrentScheduleAssignmentOperation(activeOperation, operation, "2026-09"),
    });
    activeOperation = { generation: 2, slotId: "slot-b", month: "2026-09" };
    request.resolve(Response.json(response()));
    await pending;

    expect(state.data?.slots[0].collaborator?.name).toBe("Marina Oliveira");
    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
  });

  it.each([null, { generation: 2, slotId: "slot-b", month: "2026-09" }])(
    "não publica erro do GET de A depois que a sessão muda para %j",
    async (nextOperation) => {
      const { request, state, options } = setup();
      const operation = { generation: 1, slotId: "slot-a", month: "2026-09" };
      let activeOperation: ScheduleAssignmentOperation | null = operation;
      const pending = runScheduleLoad({
        ...options,
        shouldApply: () => shouldRefreshScheduleAfterAssignment(operation, "2026-09"),
        shouldReportError: () => isCurrentScheduleAssignmentOperation(activeOperation, operation, "2026-09"),
      });
      activeOperation = nextOperation;
      request.resolve(Response.json({ error: "Falha antiga de A" }, { status: 500 }));
      await pending;

      expect(state.error).toBeNull();
      expect(state.data).toBeNull();
      expect(state.loading).toBe(false);
    }
  );

  it.each([true, false])("loads regulares aplicam dados ou reportam erro (sucesso=%s)", async (success) => {
    const { request, state, options } = setup();
    const pending = runScheduleLoad(options);
    request.resolve(success
      ? Response.json(response())
      : Response.json({ error: "Erro do mês atual" }, { status: 500 }));
    await pending;

    expect(state.data?.slots[0].id ?? null).toBe(success ? "slot-1" : null);
    expect(state.error).toBe(success ? null : "Erro do mês atual");
    expect(state.loading).toBe(false);
  });

  it.each([true, false])("reload antigo preserva dados, erro e loading do novo dono (sucesso=%s)", async (success) => {
    const { request, state, options } = setup();
    let generation = 1;
    const pending = runScheduleLoad({ ...options, ownsLoad: () => isCurrentScheduleLoadOperation(generation, 1) });
    generation = 2;
    state.error = "Erro da nova operação";
    request.resolve(success
      ? Response.json(response())
      : Response.json({ error: "Erro antigo" }, { status: 500 }));
    await pending;

    expect(state.data).toBeNull();
    expect(state.error).toBe("Erro da nova operação");
    expect(state.loading).toBe(true);
  });
});

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

  it("descarta resposta da sessão A depois que o painel abre o slot B ou reabre A", () => {
    const staleOperation = { generation: 1, slotId: "slot-a", month: "2026-09" };

    expect(isCurrentScheduleAssignmentOperation(
      { generation: 2, slotId: "slot-b", month: "2026-09" },
      staleOperation,
      "2026-09"
    )).toBe(false);
    expect(isCurrentScheduleAssignmentOperation(
      { generation: 3, slotId: "slot-a", month: "2026-09" },
      staleOperation,
      "2026-09"
    )).toBe(false);
  });

  it("mantém apenas a atribuição mais recente quando outra começa antes da primeira terminar", () => {
    const firstOperation = { generation: 4, slotId: "slot-a", month: "2026-09" };
    const secondOperation = { generation: 5, slotId: "slot-a", month: "2026-09" };

    expect(isCurrentScheduleAssignmentOperation(secondOperation, firstOperation, "2026-09")).toBe(false);
    expect(isCurrentScheduleAssignmentOperation(secondOperation, secondOperation, "2026-09")).toBe(true);
  });

  it("descarta resposta de atribuição quando o mês visível muda durante o PATCH", () => {
    const septemberOperation = { generation: 6, slotId: "slot-a", month: "2026-09" };

    expect(isCurrentScheduleAssignmentOperation(
      septemberOperation,
      septemberOperation,
      "2026-10"
    )).toBe(false);
  });

  it("recarrega o mesmo mês mesmo quando a sessão já não pode publicar feedback", () => {
    const completedOperation = { generation: 7, slotId: "slot-a", month: "2026-09" };

    expect(isCurrentScheduleAssignmentOperation(
      null,
      completedOperation,
      "2026-09"
    )).toBe(false);
    expect(shouldRefreshScheduleAfterAssignment(completedOperation, "2026-09")).toBe(true);
  });

  it("não recarrega o calendário quando o mês mudou após a atribuição", () => {
    const septemberOperation = { generation: 7, slotId: "slot-a", month: "2026-09" };

    expect(shouldRefreshScheduleAfterAssignment(septemberOperation, "2026-10")).toBe(false);
  });

  it("permite somente ao reload mais recente aplicar dados e finalizar loading", () => {
    const firstReload = 8;
    const secondReload = 9;

    expect(isCurrentScheduleLoadOperation(secondReload, firstReload)).toBe(false);
    expect(isCurrentScheduleLoadOperation(secondReload, secondReload)).toBe(true);
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
