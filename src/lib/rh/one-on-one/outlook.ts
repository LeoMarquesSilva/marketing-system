import "server-only";

/**
 * Agenda das 1:1 no Outlook, no mesmo modelo do SAMA (C:\bkp\doc\SAMA\src\lib\graph.ts):
 * livre/ocupado pelo getSchedule, evento criado na agenda de quem marca, com o outro participante
 * e a sala (caixa de usuário SALA01@, SALA02@…) como convidados e link do Teams.
 * O app do Microsoft 365 do ORQESTRAI já tem Calendars.ReadWrite (conferido em 19/11/2026).
 */

import { microsoftMailConfigurado, resolverCaixa, tokenGraphReaproveitado } from "@/lib/microsoft-mail";
import { SAO_PAULO } from "./rules";

const GRAPH = "https://graph.microsoft.com/v1.0";

export class OutlookError extends Error {}

export function outlookReady(): boolean {
  return microsoftMailConfigurado();
}

async function graph<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenGraphReaproveitado();
  const response = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new OutlookError(`Outlook respondeu ${response.status}: ${text.slice(0, 200)}`);
  }
  // Cancelar responde 202 sem corpo.
  const text = await response.text();
  return (text.trim() ? JSON.parse(text) : undefined) as T;
}

export async function mailboxOf(email: string): Promise<string> {
  const token = await tokenGraphReaproveitado();
  return resolverCaixa(email, token);
}

/** Livre/ocupado do dia (das 8h às 19h de São Paulo) em intervalos de 30 minutos. */
export async function freeBusy(
  organizer: string,
  schedules: string[],
  startIso: string,
  endIso: string
): Promise<Map<string, string>> {
  const data = await graph<{ value?: Array<{ scheduleId?: string; availabilityView?: string }> }>(
    `/users/${encodeURIComponent(organizer)}/calendar/getSchedule`,
    {
      method: "POST",
      body: JSON.stringify({
        schedules,
        startTime: { dateTime: startIso.replace(/Z$/, ""), timeZone: "UTC" },
        endTime: { dateTime: endIso.replace(/Z$/, ""), timeZone: "UTC" },
        availabilityViewInterval: 30,
      }),
    }
  );
  const views = new Map<string, string>();
  for (const row of data?.value ?? []) views.set((row.scheduleId ?? "").toLowerCase(), row.availabilityView ?? "");
  return views;
}

export interface OutlookEventInput {
  organizer: string;
  subject: string;
  /** Hora local de São Paulo: "2026-11-20T14:00:00". */
  startLocal: string;
  endLocal: string;
  attendees: Array<{ email: string; name: string; resource?: boolean }>;
  location: string | null;
  bodyHtml: string;
}

function eventPayload(input: OutlookEventInput) {
  return {
    subject: input.subject,
    start: { dateTime: input.startLocal, timeZone: SAO_PAULO },
    end: { dateTime: input.endLocal, timeZone: SAO_PAULO },
    body: { contentType: "HTML", content: input.bodyHtml },
    location: input.location ? { displayName: input.location } : undefined,
    attendees: input.attendees.map((attendee) => ({
      emailAddress: { address: attendee.email, name: attendee.name },
      type: attendee.resource ? "resource" : "required",
    })),
    // Teams também nas presenciais, como no SAMA.
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    allowNewTimeProposals: true,
  };
}

export async function createEvent(input: OutlookEventInput): Promise<{ id: string; joinUrl: string | null }> {
  const data = await graph<{ id: string; onlineMeeting?: { joinUrl?: string } | null }>(
    `/users/${encodeURIComponent(input.organizer)}/events`,
    { method: "POST", body: JSON.stringify(eventPayload(input)) }
  );
  return { id: data.id, joinUrl: data.onlineMeeting?.joinUrl ?? null };
}

export async function updateEvent(eventId: string, input: OutlookEventInput): Promise<void> {
  const payload = eventPayload(input);
  await graph(`/users/${encodeURIComponent(input.organizer)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify({ subject: payload.subject, start: payload.start, end: payload.end, location: payload.location, attendees: payload.attendees, body: payload.body }),
  });
}

export async function cancelEvent(organizer: string, eventId: string, comment: string): Promise<void> {
  await graph(`/users/${encodeURIComponent(organizer)}/events/${encodeURIComponent(eventId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Corpo do convite: categoria e pauta, com o link para a 1:1 no ORQESTRAI. */
export function invitationBody(params: { category: string | null; topics: string[]; link: string }): string {
  const topics = params.topics.length
    ? `<ul>${params.topics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join("")}</ul>`
    : "<p>Pauta a combinar.</p>";
  return [
    `<p><strong>Reunião 1:1</strong>${params.category ? ` · ${escapeHtml(params.category)}` : ""}</p>`,
    "<p><strong>Pauta</strong></p>",
    topics,
    `<p>Pauta, ações e anotações: <a href="${escapeHtml(params.link)}">abrir no ORQESTRAI</a></p>`,
  ].join("");
}
