import type { EmailContact, EmailPerson } from "./email-marketing";
import { getPartyInviteTipoLabel } from "./party-invite-types";

export type GuestImportSource = "office" | "clients";
export interface GuestCandidate {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  guestType: "colaborador" | "cliente";
  avatarUrl: string | null;
  detail: string | null;
}
export interface ExistingGuest {
  id?: string;
  name: string;
  email: string | null;
  company: string | null;
  notes?: string | null;
}
export const normalizeGuestText = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

// Email identifies a person across sources. Without an email, require both
// full name and organization; do not collapse homonyms from different companies.
export function matchesGuest(candidate: GuestCandidate, guest: ExistingGuest): boolean {
  if (guest.notes?.includes(`[event-guest-source:${candidate.key}]`)) return true;
  const email = normalizeGuestText(candidate.email);
  const otherEmail = normalizeGuestText(guest.email);
  if (email && otherEmail) return email === otherEmail;
  return normalizeGuestText(candidate.name) === normalizeGuestText(guest.name)
    && normalizeGuestText(candidate.company) === normalizeGuestText(guest.company);
}

export function uniqueGuestCandidates(candidates: GuestCandidate[]): GuestCandidate[] {
  const unique: GuestCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.name.trim() || unique.some(guest => matchesGuest(candidate, guest))) continue;
    unique.push(candidate);
  }
  return unique.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function clientGuestCandidates(people: EmailPerson[], contacts: EmailContact[]): GuestCandidate[] {
  return uniqueGuestCandidates([
    ...people.filter(person => person.partyInvite).map(person => ({
      key: `person:${person.id}`, name: person.name, email: person.email,
      phone: person.phone, company: person.clientGroupName ?? null,
      guestType: "cliente" as const, avatarUrl: null,
      detail: getPartyInviteTipoLabel(person.partyInviteTipo),
    })),
    ...contacts.filter(contact => contact.partyInvite).map(contact => ({
      key: `contact:${contact.id}`, name: contact.name?.trim() || contact.email,
      email: contact.email, phone: contact.phone,
      company: contact.clientGroupName || contact.companyName || contact.company || null,
      guestType: "cliente" as const, avatarUrl: null,
      detail: getPartyInviteTipoLabel(contact.partyInviteTipo),
    })),
  ]);
}
