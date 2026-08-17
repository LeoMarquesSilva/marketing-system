export interface OfficialPhotoConsumer {
  id: string;
  slug: string;
  keyPrefix: string;
  keyHash: string;
  allowedScopes: string[];
}

export interface OfficialPhotoResult {
  externalUserId: string | null;
  userId: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  source: "selected" | "legacy_avatar" | "none";
  version: string;
  updatedAt: string;
}

export interface OfficialPhotosApiDependencies {
  findConsumersByPrefix(prefix: string): Promise<OfficialPhotoConsumer[]>;
  consumeQuota(consumerId: string): Promise<boolean>;
  lookupByExternalIds(
    consumerId: string,
    externalUserIds: string[]
  ): Promise<OfficialPhotoResult[]>;
  lookupByEmail(normalizedEmail: string): Promise<OfficialPhotoResult[]>;
  audit(input: {
    consumerId: string | null;
    route: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    lookupCount: number;
  }): Promise<void>;
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function extractApiKey(request: Request): string | null {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return (
    request.headers.get("x-api-key")?.trim() ||
    request.headers.get("apikey")?.trim() ||
    bearer?.trim() ||
    null
  );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

async function authenticate(
  request: Request,
  deps: OfficialPhotosApiDependencies
): Promise<OfficialPhotoConsumer | null> {
  const key = extractApiKey(request);
  if (!key) return null;
  const prefix = key.slice(0, 16);
  const candidates = await deps.findConsumersByPrefix(prefix);
  const keyHash = await sha256Hex(key);
  return candidates.find((consumer) => constantTimeEqual(consumer.keyHash, keyHash)) ?? null;
}

function normalizeExternalIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 100) return null;
  const ids = input.map((value) => (typeof value === "string" ? value.trim() : ""));
  if (ids.some((value) => value.length === 0)) return null;
  return [...new Set(ids)];
}

export function createOfficialPhotosHandler(deps: OfficialPhotosApiDependencies) {
  return async function handleOfficialPhotosRequest(request: Request): Promise<Response> {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const route = url.pathname;
    let consumer: OfficialPhotoConsumer | null = null;
    let lookupCount = 0;

    const respond = async (status: number, payload: unknown) => {
      if (!route.endsWith("/health")) {
        await deps
          .audit({
            consumerId: consumer?.id ?? null,
            route,
            method: request.method,
            statusCode: status,
            latencyMs: Math.max(0, Date.now() - startedAt),
            lookupCount,
          })
          .catch(() => undefined);
      }
      return jsonResponse(status, payload);
    };

    try {
      if (request.method === "GET" && route.endsWith("/health")) {
        return jsonResponse(200, {
          ok: true,
          service: "official-photos-api",
          version: "v1",
        });
      }

      consumer = await authenticate(request, deps);
      if (!consumer || !consumer.allowedScopes.includes("photos:read")) {
        return respond(401, { error: "Não autorizado." });
      }

      if (!(await deps.consumeQuota(consumer.id))) {
        return respond(429, { error: "Limite de requisições excedido." });
      }

      if (request.method === "POST" && route.endsWith("/v1/photos/batch")) {
        const body = (await request.json().catch(() => null)) as {
          externalUserIds?: unknown;
        } | null;
        const externalUserIds = normalizeExternalIds(body?.externalUserIds);
        if (!externalUserIds) {
          return respond(400, {
            error: "externalUserIds deve conter entre 1 e 100 identificadores válidos.",
          });
        }
        lookupCount = externalUserIds.length;
        const data = await deps.lookupByExternalIds(consumer.id, externalUserIds);
        const found = new Set(data.map((item) => item.externalUserId));
        return respond(200, {
          data,
          notFound: externalUserIds.filter((id) => !found.has(id)),
        });
      }

      if (request.method === "GET" && route.endsWith("/v1/photos")) {
        const email = url.searchParams.get("email")?.trim().toLowerCase();
        if (!email) return respond(400, { error: "E-mail é obrigatório." });
        lookupCount = 1;
        const matches = await deps.lookupByEmail(email);
        if (matches.length === 0) return respond(404, { error: "Pessoa não encontrada." });
        if (matches.length > 1) {
          return respond(409, { error: "E-mail ambíguo; use o identificador externo." });
        }
        return respond(200, { data: matches[0] });
      }

      const marker = "/v1/photos/";
      const markerIndex = route.lastIndexOf(marker);
      if (request.method === "GET" && markerIndex >= 0) {
        const externalUserId = decodeURIComponent(
          route.slice(markerIndex + marker.length)
        ).trim();
        if (!externalUserId || externalUserId === "batch") {
          return respond(400, { error: "Identificador externo inválido." });
        }
        lookupCount = 1;
        const matches = await deps.lookupByExternalIds(consumer.id, [externalUserId]);
        if (matches.length === 0) return respond(404, { error: "Pessoa não encontrada." });
        return respond(200, { data: matches[0] });
      }

      return respond(404, { error: "Rota não encontrada." });
    } catch (error) {
      console.error("[official-photos-api]", error instanceof Error ? error.message : error);
      return respond(500, { error: "Erro interno." });
    }
  };
}
