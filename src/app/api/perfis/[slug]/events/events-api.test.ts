import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublishedProfileIdBySlug = vi.hoisted(() => vi.fn());
const recordProfileEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/profiles/metrics-record", () => ({
  getPublishedProfileIdBySlug,
  recordProfileEvent,
}));

import { POST } from "./route";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";

function request(body: unknown) {
  return new Request("https://example.com/api/perfis/leticia-rodrigues/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/perfis/[slug]/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublishedProfileIdBySlug.mockResolvedValue(PROFILE_ID);
    recordProfileEvent.mockResolvedValue(undefined);
  });

  it("responde 404 quando o slug não está publicado", async () => {
    getPublishedProfileIdBySlug.mockResolvedValueOnce(null);
    const response = await POST(request({ eventType: "share" }), {
      params: Promise.resolve({ slug: "inexistente" }),
    });
    expect(response.status).toBe(404);
    expect(recordProfileEvent).not.toHaveBeenCalled();
  });

  it("responde 400 para tipo desconhecido", async () => {
    const response = await POST(request({ eventType: "page_bounce" }), {
      params: Promise.resolve({ slug: "leticia-rodrigues" }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.code).toBe("PROFILE_EVENT_INVALID");
    expect(recordProfileEvent).not.toHaveBeenCalled();
  });

  it("responde 204 após validação mesmo se a gravação for best-effort", async () => {
    recordProfileEvent.mockResolvedValueOnce(undefined);

    const response = await POST(
      request({
        eventType: "whatsapp_click",
        source: "nfc",
        locale: "pt-BR",
        phone: "+5519999999999",
        url: "https://wa.me/5519999999999",
      }),
      { params: Promise.resolve({ slug: "leticia-rodrigues" }) }
    );

    expect(response.status).toBe(204);
    expect(recordProfileEvent).toHaveBeenCalledWith({
      profileId: PROFILE_ID,
      cardId: null,
      eventType: "whatsapp_click",
      source: "nfc",
      locale: "pt-BR",
    });
    const call = recordProfileEvent.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("phone");
    expect(call).not.toHaveProperty("url");
  });

  it("responde 204 com corpo vazio quando a gravação engole falha de banco", async () => {
    recordProfileEvent.mockImplementationOnce(async () => undefined);

    const response = await POST(request({ eventType: "profile_view" }), {
      params: Promise.resolve({ slug: "leticia-rodrigues" }),
    });

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
  });
});
