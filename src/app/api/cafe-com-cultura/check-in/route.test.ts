import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedUser = vi.hoisted(() => vi.fn());
const getCafeProfileForAuthUser = vi.hoisted(() => vi.fn());
const registerCafeCheckin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAuthenticatedUser }));
vi.mock("@/lib/cafe-cultura/server", () => ({
  CafeCulturaError: class CafeCulturaError extends Error {
    constructor(message: string, public status: number, public code: string) {
      super(message);
    }
  },
  getCafeProfileForAuthUser,
  registerCafeCheckin,
}));

describe("POST /api/cafe-com-cultura/check-in", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 quando não há sessão", async () => {
    requireAuthenticatedUser.mockRejectedValueOnce(new Error("Não autenticado."));
    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(new Request("https://example.com/api/cafe-com-cultura/check-in", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(registerCafeCheckin).not.toHaveBeenCalled();
  });

  it("registra somente o perfil ligado à sessão e ignora userId do cliente", async () => {
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-1" });
    getCafeProfileForAuthUser.mockResolvedValueOnce({ id: "profile-1", name: "Ana", avatarUrl: null });
    registerCafeCheckin.mockResolvedValueOnce({
      event: { id: "event-1" },
      collaborator: { id: "profile-1", checkinAt: "2026-08-28T12:10:00.000Z" },
      windowState: "open",
    });
    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://example.com/api/cafe-com-cultura/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "profile-de-outra-pessoa", source: "qr" }),
      })
    );
    expect(response.status).toBe(200);
    expect(registerCafeCheckin).toHaveBeenCalledWith("profile-1", expect.any(Date), "qr");
  });
});
