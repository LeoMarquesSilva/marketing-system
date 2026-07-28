import {
  ProfileEventPayloadError,
  sanitizeProfileEventPayload,
} from "@/lib/profiles/metrics";
import {
  getPublishedProfileIdBySlug,
  recordProfileEvent,
} from "@/lib/profiles/metrics-record";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/**
 * POST público de métricas — aceita só campos sanitizados.
 * Após validação, sempre responde 204 (mesmo se a gravação falhar ou for limitada).
 */
export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const profileId = await getPublishedProfileIdBySlug(slug);
  if (!profileId) {
    return new Response(JSON.stringify({ error: "Perfil não encontrado.", code: "PROFILE_NOT_FOUND" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  let sanitized;
  try {
    sanitized = sanitizeProfileEventPayload(body);
  } catch (error) {
    const message =
      error instanceof ProfileEventPayloadError
        ? error.message
        : "Payload de evento inválido.";
    return new Response(
      JSON.stringify({ error: message, code: "PROFILE_EVENT_INVALID" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  await recordProfileEvent({
    profileId,
    cardId: sanitized.cardId ?? null,
    eventType: sanitized.eventType,
    source: sanitized.source,
    locale: sanitized.locale,
  });

  return new Response(null, { status: 204 });
}
