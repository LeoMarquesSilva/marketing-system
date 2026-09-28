import { beforeEach, describe, expect, it, vi } from "vitest";

const isAuthorizedCronRequest = vi.hoisted(() => vi.fn());
const syncViosTasksFromSioe = vi.hoisted(() => vi.fn());
const reconcileViosScheduleYear = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cron-auth", () => ({ isAuthorizedCronRequest }));
vi.mock("@/lib/vios-sioe-sync-server", () => ({
  syncViosTasksFromSioe,
}));
vi.mock("@/lib/content-schedule/server", () => ({
  reconcileViosScheduleYear,
}));

describe("GET /api/cron/vios-sync-sioe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita chamada sem segredo do cron", async () => {
    isAuthorizedCronRequest.mockReturnValueOnce(false);
    vi.resetModules();
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/cron/vios-sync-sioe")
    );

    expect(response.status).toBe(401);
    expect(syncViosTasksFromSioe).not.toHaveBeenCalled();
  });

  it("retorna o resumo da sincronização concluída", async () => {
    isAuthorizedCronRequest.mockReturnValueOnce(true);
    syncViosTasksFromSioe.mockResolvedValueOnce({
      year: 2026,
      fetched: 550,
      inserted: 169,
      updated: 381,
      archived: 105,
      revived: 0,
      missingAssignee: 0,
      errors: 0,
    });
    reconcileViosScheduleYear.mockResolvedValueOnce({
      year: 2026,
      matched: 26,
      invalidated: 0,
      ambiguous: 8,
      unmatched: 25,
      races: 0,
    });
    vi.resetModules();
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/cron/vios-sync-sioe")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      fetched: 550,
      inserted: 169,
      archived: 105,
      errors: 0,
      scheduleLinks: expect.objectContaining({ matched: 26, ambiguous: 8 }),
    });
    expect(reconcileViosScheduleYear).toHaveBeenCalledWith(2026);
  });

  it("sinaliza falha da carga ao provedor do cron", async () => {
    isAuthorizedCronRequest.mockReturnValueOnce(true);
    syncViosTasksFromSioe.mockRejectedValueOnce(
      new Error("Fonte SIOE indisponível")
    );
    vi.resetModules();
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/cron/vios-sync-sioe")
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Fonte SIOE indisponível",
    });
  });
});
