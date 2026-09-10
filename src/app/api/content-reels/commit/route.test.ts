import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const dbFactory = vi.hoisted(() => vi.fn());
const autoLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content-access", () => ({ getAuthenticatedContentUser: auth, resolveAreaFilter: () => ({ areas: ["Cível"] }) }));
vi.mock("@/lib/users-server", () => ({ getServerDb: dbFactory }));
vi.mock("@/lib/content-schedule/server", () => ({ autoLinkContentSchedule: autoLink }));

import { POST } from "./route";

const body = { generation_key: "12345678-1234-4234-8234-123456789012", source_content_id: null, title: "Responsabilidade dos sócios", area: "Cível", script: "Roteiro jurídico para gravação. ".repeat(5) };
const request = () => new Request("http://localhost/api/content-reels/commit", { method: "POST", body: JSON.stringify(body) });

function database(owner = "user-1", isActive = true) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  return {
    upsert,
    from: (table: string) => ({
      upsert,
      select: () => ({ eq: () => ({
        maybeSingle: async () => ({ data: { is_active: isActive }, error: null }),
        single: async () => ({ data: table === "reel_studio_items" ? { id: "saved-reel", created_by_id: owner, area: "Cível", created_at: "2026-09-09T12:00:00Z", source_content_id: null } : null, error: null }),
      }) }),
    }),
  };
}

describe("confirmar uso de Reel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ profile: { id: "user-1", name: "Pessoa", department: "Cível" } });
    autoLink.mockResolvedValue({ status: "matched", slotId: "slot-1" });
  });

  it("nega sessão ausente antes de acessar o banco", async () => {
    auth.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(dbFactory).not.toHaveBeenCalled();
  });

  it("nega colaborador inativo sem persistir produção", async () => {
    const db = database("user-1", false);
    dbFactory.mockResolvedValue(db);
    expect((await POST(request())).status).toBe(403);
    expect(db.upsert).not.toHaveBeenCalled();
    expect(autoLink).not.toHaveBeenCalled();
  });

  it("reutiliza a mesma produção em retries e mantém a data original do evento", async () => {
    const db = database();
    dbFactory.mockResolvedValue(db);
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ generation_key: body.generation_key, created_by_id: "user-1" }), { onConflict: "generation_key", ignoreDuplicates: true });
    for (const [event] of autoLink.mock.calls) expect(event).toMatchObject({ reelStudioId: "saved-reel", collaboratorId: "user-1", eventDate: "2026-09-09T12:00:00Z" });
  });

  it("não assume produção de outra pessoa ao repetir uma chave existente", async () => {
    dbFactory.mockResolvedValue(database("another-user"));
    expect((await POST(request())).status).toBe(403);
    expect(autoLink).not.toHaveBeenCalled();
  });
});
