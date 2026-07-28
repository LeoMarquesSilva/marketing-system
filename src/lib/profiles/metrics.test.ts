import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ProfileEventPayloadError,
  beaconProfileEvent,
  buildProfileEventsUrl,
  clickEventTypeForAction,
  sanitizeProfileEventPayload,
} from "@/lib/profiles/metrics";
import {
  getPublishedProfileIdBySlug,
  recordProfileEvent,
} from "@/lib/profiles/metrics-record";

describe("sanitizeProfileEventPayload", () => {
  it("aceita apenas os campos da lista fechada", () => {
    const result = sanitizeProfileEventPayload({
      eventType: "whatsapp_click",
      source: "nfc",
      locale: "en",
      cardId: "7e3bd4e6-156a-4bdf-bc0f-61a0f08a9134",
    });
    expect(result).toEqual({
      eventType: "whatsapp_click",
      source: "nfc",
      locale: "en",
      cardId: "7e3bd4e6-156a-4bdf-bc0f-61a0f08a9134",
    });
  });

  it("remove URL, mensagem, telefone, e-mail, IP, coordenadas, user-agent e referrer", () => {
    const result = sanitizeProfileEventPayload({
      eventType: "share",
      source: "direct",
      locale: "pt-BR",
      url: "https://evil.example/track",
      message: "texto sensível",
      phone: "+5519999999999",
      email: "pessoa@empresa.com",
      ip: "203.0.113.10",
      coordinates: { lat: -23.5, lng: -46.6 },
      userAgent: "Mozilla/5.0",
      referrer: "https://referrer.example",
    });

    const serialized = JSON.stringify(result);
    expect(result).toEqual({
      eventType: "share",
      source: "direct",
      locale: "pt-BR",
    });
    expect(serialized).not.toContain("evil.example");
    expect(serialized).not.toContain("sensível");
    expect(serialized).not.toContain("5519999999999");
    expect(serialized).not.toContain("pessoa@empresa.com");
    expect(serialized).not.toContain("203.0.113.10");
    expect(serialized).not.toContain("-23.5");
    expect(serialized).not.toContain("Mozilla");
    expect(serialized).not.toContain("referrer.example");
  });

  it("rejeita tipo de evento desconhecido", () => {
    expect(() =>
      sanitizeProfileEventPayload({ eventType: "page_bounce", source: "direct" })
    ).toThrow(ProfileEventPayloadError);
  });

  it("aplica defaults de source e locale", () => {
    expect(sanitizeProfileEventPayload({ eventType: "profile_view" })).toEqual({
      eventType: "profile_view",
      source: "direct",
      locale: "pt-BR",
    });
  });

  it("rejeita cardId que não é UUID", () => {
    expect(() =>
      sanitizeProfileEventPayload({
        eventType: "nfc_scan",
        cardId: "nao-e-uuid",
      })
    ).toThrow(ProfileEventPayloadError);
  });

  it("rejeita corpo não-objeto", () => {
    expect(() => sanitizeProfileEventPayload(null)).toThrow(ProfileEventPayloadError);
    expect(() => sanitizeProfileEventPayload("share")).toThrow(ProfileEventPayloadError);
  });
});

describe("clickEventTypeForAction / buildProfileEventsUrl", () => {
  it("mapeia ações externas", () => {
    expect(clickEventTypeForAction("whatsapp")).toBe("whatsapp_click");
    expect(clickEventTypeForAction("email")).toBe("email_click");
    expect(clickEventTypeForAction("linkedin")).toBe("linkedin_click");
    expect(clickEventTypeForAction("website")).toBe("website_click");
  });

  it("monta a URL do endpoint público", () => {
    expect(buildProfileEventsUrl("leticia-rodrigues")).toBe(
      "/api/perfis/leticia-rodrigues/events"
    );
  });
});

describe("recordProfileEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não lança quando a RPC e o insert falham", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "rpc down" } })),
      from: vi.fn(() => ({
        insert: vi.fn(async () => ({ error: { message: "insert down" } })),
      })),
    } as unknown as SupabaseClient;

    await expect(
      recordProfileEvent(
        {
          profileId: "11111111-1111-4111-8111-111111111111",
          eventType: "profile_view",
          source: "direct",
          locale: "pt-BR",
        },
        { client }
      )
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith("PROFILE_EVENT_WRITE_FAILED", {
      profileId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("não tenta insert quando a RPC grava com sucesso", async () => {
    const from = vi.fn();
    const client = {
      rpc: vi.fn(async () => ({ data: true, error: null })),
      from,
    } as unknown as SupabaseClient;

    await recordProfileEvent(
      {
        profileId: "11111111-1111-4111-8111-111111111111",
        eventType: "nfc_scan",
        source: "nfc",
        locale: "pt-BR",
        cardId: "7e3bd4e6-156a-4bdf-bc0f-61a0f08a9134",
      },
      { client }
    );

    expect(from).not.toHaveBeenCalled();
  });

  it("usa insert de fallback quando a RPC falha", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const client = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "fn missing" } })),
      from: vi.fn(() => ({ insert })),
    } as unknown as SupabaseClient;

    await recordProfileEvent(
      {
        profileId: "11111111-1111-4111-8111-111111111111",
        eventType: "contact_download",
        source: "direct",
        locale: "en",
      },
      { client }
    );

    expect(insert).toHaveBeenCalledWith({
      profile_id: "11111111-1111-4111-8111-111111111111",
      card_id: null,
      event_type: "contact_download",
      source: "direct",
      locale: "en",
    });
  });
});

describe("getPublishedProfileIdBySlug", () => {
  it("devolve id só para perfil publicado", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: "11111111-1111-4111-8111-111111111111", status: "published" },
              error: null,
            })),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    await expect(getPublishedProfileIdBySlug("leticia-rodrigues", { client })).resolves.toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("retorna null para rascunho", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: "11111111-1111-4111-8111-111111111111", status: "draft" },
              error: null,
            })),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    await expect(getPublishedProfileIdBySlug("rascunho", { client })).resolves.toBeNull();
  });
});

describe("beaconProfileEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa sendBeacon quando disponível", () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal(
      "Blob",
      class {
        constructor(public parts: unknown[], public options?: { type?: string }) {}
      }
    );

    beaconProfileEvent("leticia-rodrigues", {
      eventType: "share",
      source: "share",
      locale: "pt-BR",
    });

    expect(sendBeacon).toHaveBeenCalledWith(
      "/api/perfis/leticia-rodrigues/events",
      expect.any(Object)
    );
  });
});
