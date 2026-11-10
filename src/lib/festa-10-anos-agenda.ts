/**
 * "Salvar na agenda" da festa de 10 anos (confirmação da equipe e convite dos clientes).
 * Horário do evento em Eventos: 18h de 17/12/2026 até 01h de 18/12/2026 (Brasília, UTC-3).
 */
import { RSVP_TRANSPORT_LABEL, usesOutbound, usesReturn, type RsvpTransport } from "@/lib/event-rsvp";

const TITLE = "Festa de 10 anos · Bismarchi | Pires";
const LOCATION = "Fazenda Santa Margarida - R. Rubens Gomes Balsas, 311 - Joaquim Egídio, Campinas - SP";
const START_ISO = "2026-12-17T21:00:00Z";
const END_ISO = "2026-12-18T04:00:00Z";
const START_COMPACT = "20261217T210000Z";
const END_COMPACT = "20261218T040000Z";
const DRESS_CODE_LINE = "Dress code: esporte fino (azul e areia) - https://www.orqestrai.com.br/dress-code";

/** Arquivo .ics estático (iPhone, Android, Outlook no computador e outros). */
export const FESTA_ICS_PATH = "/festa-10-anos/festa-10-anos.ics";
/** O mesmo para os clientes: sem o link da confirmação interna. */
export const FESTA_GUEST_ICS_PATH = "/festa-10-anos/festa-10-anos-convite.ics";

function teamDetails(transport: RsvpTransport | null): string {
  const lines = ["Festa de 10 anos do escritório."];
  if (transport && (usesOutbound(transport) || usesReturn(transport))) {
    const leg = usesOutbound(transport) ? "com saída do escritório" : "ao final da festa, de volta ao escritório";
    lines.push(`Micro-ônibus: ${RSVP_TRANSPORT_LABEL[transport].toLowerCase()}, ${leg}.`);
  }
  lines.push(DRESS_CODE_LINE);
  lines.push("Sua confirmação: https://www.orqestrai.com.br/festa-10-anos");
  return lines.join("\n");
}

function guestDetails(inviteUrl: string | null): string {
  const lines = ["Festa de 10 anos do Bismarchi | Pires.", DRESS_CODE_LINE];
  if (inviteUrl) lines.push(`Seu convite: ${inviteUrl}`);
  return lines.join("\n");
}

function googleUrl(details: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: TITLE,
    dates: `${START_COMPACT}/${END_COMPACT}`,
    location: LOCATION,
    details,
    ctz: "America/Sao_Paulo",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function outlookUrl(host: string, details: string): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: TITLE,
    startdt: START_ISO,
    enddt: END_ISO,
    location: LOCATION,
    body: details,
  });
  return `https://${host}/calendar/0/deeplink/compose?${params.toString()}`;
}

export function googleCalendarUrl(transport: RsvpTransport | null): string {
  return googleUrl(teamDetails(transport));
}

/** Outlook na web do Microsoft 365 (conta do escritório). */
export function outlookCalendarUrl(transport: RsvpTransport | null): string {
  return outlookUrl("outlook.office.com", teamDetails(transport));
}

export function guestGoogleCalendarUrl(inviteUrl: string | null): string {
  return googleUrl(guestDetails(inviteUrl));
}

/** Outlook na web: conta de empresa (Microsoft 365) ou pessoal (Outlook.com / Hotmail). */
export function guestOutlookCalendarUrl(inviteUrl: string | null, account: "empresa" | "pessoal"): string {
  return outlookUrl(account === "empresa" ? "outlook.office.com" : "outlook.live.com", guestDetails(inviteUrl));
}
