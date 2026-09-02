import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedUser = vi.hoisted(() => vi.fn());
const requireCafeCulturaAccess = vi.hoisted(() => vi.fn());
const getCafeAdminData = vi.hoisted(() => vi.fn());
const getCafeProfileForAuthUser = vi.hoisted(() => vi.fn());
const updateCafeParticipant = vi.hoisted(() => vi.fn());
const updateCafeEventSettings = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAuthenticatedUser, requireCafeCulturaAccess }));
vi.mock("@/lib/cafe-cultura/server", () => ({
  CafeCulturaError: class CafeCulturaError extends Error {},
  getCafeAdminData,
  getCafeProfileForAuthUser,
  updateCafeParticipant,
  updateCafeEventSettings,
}));

describe("/api/eventos/[id]/attendance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não entrega o painel para quem não tem o módulo Café com Cultura", async () => {
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-user" });
    requireCafeCulturaAccess.mockRejectedValueOnce(
      new Error("Sem permissão para o Café com Cultura.")
    );
    vi.resetModules();
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/eventos/event-1/attendance"), {
      params: Promise.resolve({ id: "event-1" }),
    });
    expect(response.status).toBe(403);
    expect(getCafeAdminData).not.toHaveBeenCalled();
  });

  it("audita a correção usando o perfil de quem tem o módulo", async () => {
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-cafe" });
    requireCafeCulturaAccess.mockResolvedValueOnce(undefined);
    getCafeProfileForAuthUser.mockResolvedValueOnce({ id: "admin-profile" });
    updateCafeParticipant.mockResolvedValueOnce({ summary: { present: 1 } });
    vi.resetModules();
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("https://example.com/api/eventos/event-1/attendance", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participant: { userId: "user-1", present: true } }),
      }),
      { params: Promise.resolve({ id: "event-1" }) }
    );
    expect(response.status).toBe(200);
    expect(updateCafeParticipant).toHaveBeenCalledWith(
      "event-1",
      "user-1",
      { expectationStatus: undefined, present: true },
      "admin-profile"
    );
  });
});
