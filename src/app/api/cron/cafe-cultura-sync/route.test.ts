import { beforeEach, describe, expect, it, vi } from "vitest";

const isAuthorizedCronRequest = vi.hoisted(() => vi.fn());
const runCafeCulturaAutomation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cron-auth", () => ({ isAuthorizedCronRequest }));
vi.mock("@/lib/cafe-cultura/responsum", () => ({ runCafeCulturaAutomation }));

describe("GET /api/cron/cafe-cultura-sync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita chamada sem segredo do cron", async () => {
    isAuthorizedCronRequest.mockReturnValueOnce(false);
    vi.resetModules();
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/cron/cafe-cultura-sync"));
    expect(response.status).toBe(401);
    expect(runCafeCulturaAutomation).not.toHaveBeenCalled();
  });

  it("aguarda geração e sincronização idempotentes", async () => {
    isAuthorizedCronRequest.mockReturnValueOnce(true);
    runCafeCulturaAutomation.mockResolvedValueOnce({ editions: 2, results: [] });
    vi.resetModules();
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/cron/cafe-cultura-sync"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, editions: 2 });
  });

  it("sinaliza falha para o provedor do cron quando alguma edição não sincroniza", async () => {
    isAuthorizedCronRequest.mockReturnValueOnce(true);
    runCafeCulturaAutomation.mockResolvedValueOnce({
      editions: 2,
      results: [
        { eventId: "event-1", success: true },
        { eventId: "event-2", success: false, error: "Falha sanitizada" },
      ],
    });
    vi.resetModules();
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.com/api/cron/cafe-cultura-sync"));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ success: false, editions: 2 });
  });
});
