/**
 * Métricas públicas de perfis profissionais — sanitização e helpers de beacon.
 *
 * Este módulo é seguro para o cliente: não importa o service role.
 * Persistência fica em `metrics-record.ts`.
 */

import {
  PROFILE_EVENT_SOURCES,
  PROFILE_EVENT_TYPES,
  type ProfileEventSource,
  type ProfileEventType,
  type ProfileLocale,
} from "@/lib/profiles/types";
import { profileLocaleSchema } from "@/lib/profiles/validation";

export class ProfileEventPayloadError extends Error {
  constructor(
    message: string,
    public readonly code: "PROFILE_EVENT_INVALID"
  ) {
    super(message);
    this.name = "ProfileEventPayloadError";
  }
}

export type SanitizedProfileEvent = {
  eventType: ProfileEventType;
  source: ProfileEventSource;
  locale: ProfileLocale;
  cardId?: string;
};

export type RecordProfileEventInput = {
  profileId: string;
  cardId?: string | null;
  eventType: ProfileEventType;
  source: ProfileEventSource;
  locale: ProfileLocale;
};

const ALLOWED_KEYS = new Set(["eventType", "source", "locale", "cardId"]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isEventType(value: unknown): value is ProfileEventType {
  return (
    typeof value === "string" &&
    (PROFILE_EVENT_TYPES as readonly string[]).includes(value)
  );
}

function isEventSource(value: unknown): value is ProfileEventSource {
  return (
    typeof value === "string" &&
    (PROFILE_EVENT_SOURCES as readonly string[]).includes(value)
  );
}

/**
 * Valida e sanitiza o corpo público do POST de eventos.
 * Descarta qualquer campo fora da lista permitida.
 */
export function sanitizeProfileEventPayload(body: unknown): SanitizedProfileEvent {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProfileEventPayloadError(
      "Payload de evento inválido.",
      "PROFILE_EVENT_INVALID"
    );
  }

  const raw = body as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (ALLOWED_KEYS.has(key)) cleaned[key] = raw[key];
  }

  if (!isEventType(cleaned.eventType)) {
    throw new ProfileEventPayloadError(
      "Tipo de evento desconhecido.",
      "PROFILE_EVENT_INVALID"
    );
  }

  const source: ProfileEventSource = isEventSource(cleaned.source)
    ? cleaned.source
    : "direct";

  const localeParsed = profileLocaleSchema.safeParse(cleaned.locale ?? "pt-BR");
  if (!localeParsed.success) {
    throw new ProfileEventPayloadError(
      "Idioma de evento inválido.",
      "PROFILE_EVENT_INVALID"
    );
  }

  let cardId: string | undefined;
  if (cleaned.cardId !== undefined && cleaned.cardId !== null) {
    if (typeof cleaned.cardId !== "string" || !UUID_RE.test(cleaned.cardId)) {
      throw new ProfileEventPayloadError(
        "cardId inválido.",
        "PROFILE_EVENT_INVALID"
      );
    }
    cardId = cleaned.cardId;
  }

  return {
    eventType: cleaned.eventType,
    source,
    locale: localeParsed.data as ProfileLocale,
    ...(cardId ? { cardId } : {}),
  };
}

/** Endpoint relativo usado por sendBeacon / keepalive fetch. */
export function buildProfileEventsUrl(slug: string): string {
  return `/api/perfis/${encodeURIComponent(slug)}/events`;
}

/**
 * Dispara evento no navegador sem bloquear navegação.
 * Preferência: sendBeacon; fallback: fetch keepalive.
 */
export function beaconProfileEvent(
  slug: string,
  payload: SanitizedProfileEvent
): void {
  if (typeof window === "undefined") return;

  const url = buildProfileEventsUrl(slug);
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // fall through
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => {
    // Melhor esforço: métrica nunca bloqueia o clique.
  });
}

/** Mapeia ação de contato externo → tipo de evento. */
export function clickEventTypeForAction(
  action: "whatsapp" | "email" | "linkedin" | "website"
): ProfileEventType {
  switch (action) {
    case "whatsapp":
      return "whatsapp_click";
    case "email":
      return "email_click";
    case "linkedin":
      return "linkedin_click";
    case "website":
      return "website_click";
  }
}
