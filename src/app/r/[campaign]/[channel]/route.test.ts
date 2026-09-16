import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const rpc = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn(async () => ({ rpc })));

vi.mock("@/utils/supabase/server", () => ({ createClient }));

describe("GET /r/[campaign]/[channel]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registra o clique e redireciona sem cache", async () => {
    rpc.mockResolvedValueOnce({
      data: "https://www.bismarchipires.com.br/?utm_source=tma_brasil",
      error: null,
    });
    const { GET } = await import("./route");
    const request = new NextRequest("https://orqestrai.com.br/r/tma-brasil-2026/site", {
      headers: {
        referer: "https://congresso.example/estande",
        "user-agent": "TMA browser",
      },
    });

    const response = await GET(request, {
      params: Promise.resolve({ campaign: "tma-brasil-2026", channel: "site" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("utm_source=tma_brasil");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(rpc).toHaveBeenCalledWith("record_event_tracking_click", {
      p_campaign_slug: "tma-brasil-2026",
      p_channel: "site",
      p_referrer: "https://congresso.example/estande",
      p_user_agent: "TMA browser",
    });
  });

  it("rejeita slugs inválidos antes de consultar o banco", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("https://orqestrai.com.br/r/invalido/canal");
    const response = await GET(request, {
      params: Promise.resolve({ campaign: "../invalido", channel: "site" }),
    });

    expect(response.status).toBe(404);
    expect(createClient).not.toHaveBeenCalled();
  });
});
