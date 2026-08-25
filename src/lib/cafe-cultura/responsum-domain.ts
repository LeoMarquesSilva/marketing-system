import { extractCafeEventDate } from "./dates";

export interface ResponsumAbsenceTicket {
  id: string;
  title: string;
  description: string | null;
  createdBy: string;
  createdByEmail: string | null;
}

export interface ResponsumUserLink {
  id: string;
  email: string | null;
}

interface SupabaseApiKeyRecord {
  name?: unknown;
  type?: unknown;
  api_key?: unknown;
  key?: unknown;
}

export function selectResponsumServiceKey(records: unknown): string | null {
  if (!Array.isArray(records)) return null;
  for (const candidate of records as SupabaseApiKeyRecord[]) {
    const role = typeof candidate.name === "string" ? candidate.name : candidate.type;
    if (role !== "service_role") continue;
    const value = typeof candidate.api_key === "string" ? candidate.api_key : candidate.key;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeEmail(value: string | null): string | null {
  const normalized = value?.trim().toLocaleLowerCase("pt-BR");
  return normalized || null;
}

export function mapResponsumAbsences(
  tickets: ResponsumAbsenceTicket[],
  users: ResponsumUserLink[],
  eventDate: string
): { matches: Array<{ userId: string; ticketIds: string[] }>; unmatchedTicketIds: string[] } {
  const referenceYear = Number(eventDate.slice(0, 4));
  const usersById = new Map(users.map((user) => [user.id, user]));
  const usersByEmail = new Map(
    users
      .map((user) => [normalizeEmail(user.email), user] as const)
      .filter((entry): entry is readonly [string, ResponsumUserLink] => Boolean(entry[0]))
  );
  const grouped = new Map<string, string[]>();
  const unmatchedTicketIds: string[] = [];

  for (const ticket of tickets) {
    const text = `${ticket.title}\n${ticket.description ?? ""}`;
    const ticketDate = extractCafeEventDate(text, referenceYear);
    if (!ticketDate) {
      unmatchedTicketIds.push(ticket.id);
      continue;
    }
    if (ticketDate !== eventDate) continue;

    const user = usersById.get(ticket.createdBy) ?? usersByEmail.get(normalizeEmail(ticket.createdByEmail) ?? "");
    if (!user) {
      unmatchedTicketIds.push(ticket.id);
      continue;
    }
    grouped.set(user.id, [...(grouped.get(user.id) ?? []), ticket.id]);
  }

  return {
    matches: [...grouped].map(([userId, ticketIds]) => ({ userId, ticketIds })),
    unmatchedTicketIds,
  };
}
