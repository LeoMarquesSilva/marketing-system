import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOfficialPhotosHandler,
  type OfficialPhotosApiDependencies,
} from "../../../supabase/functions/_shared/official-photos-domain";

const API_KEY = "ofp_responsum_abcdefghijklmnopqrstuvwxyz";

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function dependencies(
  overrides: Partial<OfficialPhotosApiDependencies> = {}
): OfficialPhotosApiDependencies {
  return {
    findConsumersByPrefix: vi.fn().mockImplementation(async () => [
      {
        id: "consumer-1",
        slug: "responsum",
        keyPrefix: API_KEY.slice(0, 16),
        keyHash: await hash(API_KEY),
        allowedScopes: ["photos:read"],
      },
    ]),
    consumeQuota: vi.fn().mockResolvedValue(true),
    lookupByExternalIds: vi.fn().mockResolvedValue([
      {
        externalUserId: "external-1",
        userId: "user-1",
        name: "Pessoa Um",
        email: "pessoa@example.com",
        photoUrl: "https://cdn.example.com/pessoa.jpg",
        source: "selected",
        version: "v1",
        updatedAt: "2026-08-17T15:00:00.000Z",
      },
    ]),
    lookupByEmail: vi.fn().mockResolvedValue([]),
    audit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("official photos API handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expõe health sem autenticação e sem CORS aberto", async () => {
    const handler = createOfficialPhotosHandler(dependencies());

    const response = await handler(
      new Request("https://project.supabase.co/functions/v1/official-photos-api/health")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "official-photos-api",
      version: "v1",
    });
  });

  it("rejeita chave ausente", async () => {
    const deps = dependencies();
    const handler = createOfficialPhotosHandler(deps);

    const response = await handler(
      new Request(
        "https://project.supabase.co/functions/v1/official-photos-api/v1/photos/external-1"
      )
    );

    expect(response.status).toBe(401);
    expect(deps.lookupByExternalIds).not.toHaveBeenCalled();
  });

  it("resolve uma foto pelo vínculo externo do consumidor", async () => {
    const deps = dependencies();
    const handler = createOfficialPhotosHandler(deps);

    const response = await handler(
      new Request(
        "https://project.supabase.co/functions/v1/official-photos-api/v1/photos/external-1",
        { headers: { "x-api-key": API_KEY } }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        externalUserId: "external-1",
        photoUrl: "https://cdn.example.com/pessoa.jpg",
        source: "selected",
      },
    });
    expect(deps.consumeQuota).toHaveBeenCalledWith("consumer-1");
    expect(deps.lookupByExternalIds).toHaveBeenCalledWith("consumer-1", ["external-1"]);
  });

  it("limita o batch a 100 identificadores", async () => {
    const deps = dependencies();
    const handler = createOfficialPhotosHandler(deps);

    const response = await handler(
      new Request(
        "https://project.supabase.co/functions/v1/official-photos-api/v1/photos/batch",
        {
          method: "POST",
          headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            externalUserIds: Array.from({ length: 101 }, (_, index) => `user-${index}`),
          }),
        }
      )
    );

    expect(response.status).toBe(400);
    expect(deps.lookupByExternalIds).not.toHaveBeenCalled();
  });

  it("retorna 429 quando a quota foi consumida", async () => {
    const deps = dependencies({ consumeQuota: vi.fn().mockResolvedValue(false) });
    const handler = createOfficialPhotosHandler(deps);

    const response = await handler(
      new Request(
        "https://project.supabase.co/functions/v1/official-photos-api/v1/photos/external-1",
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      )
    );

    expect(response.status).toBe(429);
    expect(deps.lookupByExternalIds).not.toHaveBeenCalled();
  });

  it("rejeita fallback de e-mail ambíguo", async () => {
    const duplicate = {
      externalUserId: null,
      userId: "user-1",
      name: "Pessoa",
      email: "duplicado@example.com",
      photoUrl: null,
      source: "none" as const,
      version: "v1",
      updatedAt: "2026-08-17T15:00:00.000Z",
    };
    const deps = dependencies({
      lookupByEmail: vi.fn().mockResolvedValue([
        duplicate,
        { ...duplicate, userId: "user-2" },
      ]),
    });
    const handler = createOfficialPhotosHandler(deps);

    const response = await handler(
      new Request(
        "https://project.supabase.co/functions/v1/official-photos-api/v1/photos?email=duplicado%40example.com",
        { headers: { apikey: API_KEY } }
      )
    );

    expect(response.status).toBe(409);
  });

  it("converte falhas internas em resposta JSON sem expor detalhes", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = dependencies({
      lookupByExternalIds: vi.fn().mockRejectedValue(new Error("database password leaked")),
    });
    const handler = createOfficialPhotosHandler(deps);

    const response = await handler(
      new Request(
        "https://project.supabase.co/functions/v1/official-photos-api/v1/photos/external-1",
        { headers: { "x-api-key": API_KEY } }
      )
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Erro interno." });
    expect(errorSpy).toHaveBeenCalledWith("[official-photos-api]", "database password leaked");
    errorSpy.mockRestore();
  });
});
