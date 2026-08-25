import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedUser = vi.hoisted(() => vi.fn());
const requireAdminUser = vi.hoisted(() => vi.fn());
const getCafeAdminData = vi.hoisted(() => vi.fn());
const getCafeProfileForAuthUser = vi.hoisted(() => vi.fn());
const updateCafeParticipant = vi.hoisted(() => vi.fn());
const updateCafeEventSettings = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAuthenticatedUser, requireAdminUser }));
vi.mock("@/lib/cafe-cultura/server", () => ({
  CafeCulturaError: class CafeCulturaError extends Error {},
  getCafeAdminData,
  getCafeProfileForAuthUser,
  updateCafeParticipant,
  updateCafeEventSettings,
}));

describe("/api/eventos/[id]/attendance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não entrega o painel para usuário não administrador", async () => {
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-user" });
    requireAdminUser.mockRejectedValueOnce(new Error("Apenas administradores podem executar esta ação."));
    vi.resetModules();
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/eventos/event-1/attendance"), {
      params: Promise.resolve({ id: "event-1" }),
    });
    expect(response.status).toBe(403);
    expect(getCafeAdminData).not.toHaveBeenCalled();
  });

  it("audita a correção usando o perfil do administrador autenticado", async () => {
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-admin" });
    requireAdminUser.mockResolvedValueOnce(undefined);
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
