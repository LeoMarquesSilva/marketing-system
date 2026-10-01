import { describe, expect, it } from "vitest";
import type { EmailContact, EmailPerson } from "./email-marketing";
import { clientGuestCandidates, matchesGuest, uniqueGuestCandidates, type GuestCandidate } from "./event-guest-import";

const candidate = (extra: Partial<GuestCandidate> = {}): GuestCandidate => ({
  key: "person:one", name: "Ana Silva", email: "ana@example.com", phone: null,
  company: "Empresa A", guestType: "cliente", avatarUrl: null, detail: null, ...extra,
});

describe("event guest import", () => {
  it("imports only explicit party selections, including people without email", () => {
    const people = [
      { id: "yes", name: "Ana", email: null, partyInvite: true },
      { id: "no", name: "Bia", npsEligible: true, partyInvite: false },
    ] as EmailPerson[];
    const contacts = [{ id: "contact", name: "Carlos", email: "c@example.com", partyInvite: true }] as EmailContact[];
    expect(clientGuestCandidates(people, contacts).map(item => item.key)).toEqual(["person:yes", "contact:contact"]);
  });
  it("deduplicates the same email in people and contacts regardless of casing", () => {
    expect(uniqueGuestCandidates([candidate(), candidate({ key: "contact:two", email: " ANA@example.com " })])).toHaveLength(1);
  });
  it("keeps homonyms with different emails or companies", () => {
    expect(uniqueGuestCandidates([candidate(), candidate({ key: "other", email: "other@example.com" })])).toHaveLength(2);
    expect(uniqueGuestCandidates([candidate({ email: null }), candidate({ key: "other", email: null, company: "Empresa B" })])).toHaveLength(2);
  });
  it("recognizes a previously imported person after their contact details change", () => {
    expect(matchesGuest(candidate(), { name: "Old name", email: "old@example.com", company: null, notes: "[event-guest-source:person:one]" })).toBe(true);
  });
  it("recognizes a manual entry without email by full name and organization", () => {
    expect(matchesGuest(candidate({ email: null }), { name: " ANA SILVA ", email: null, company: "Empresa A" })).toBe(true);
  });
});
