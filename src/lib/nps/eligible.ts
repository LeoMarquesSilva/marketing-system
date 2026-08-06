/**
 * Monta a lista de respondentes elegíveis ao NPS de um grupo,
 * deduplicando pessoas que já existem como contato (mesmo e-mail ou nome).
 */

export interface NpsEligibleSourceContact {
  id: string;
  name: string | null;
  email: string;
  cargo: string | null;
  npsEligible: boolean;
  clientGroupId: string | null;
}

export interface NpsEligibleSourcePerson {
  id: string;
  name: string;
  email: string | null;
  cargo: string | null;
  npsEligible: boolean;
  clientGroupId: string | null;
}

export interface NpsEligibleRespondent {
  kind: "contact" | "person";
  id: string;
  name: string;
  cargo: string | null;
  /** Preenchido na API pública quando o contato já respondeu nesta campanha. */
  alreadyResponded?: boolean;
  respondedAt?: string | null;
}

function personNameKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Contatos e pessoas do grupo com nps_eligible=true.
 * Pessoas cujo e-mail ou nome já batem com um contato elegível são omitidas.
 */
export function buildEligibleRespondents(
  contacts: NpsEligibleSourceContact[],
  people: NpsEligibleSourcePerson[],
  clientGroupId: string
): NpsEligibleRespondent[] {
  const eligibleContacts = contacts.filter(
    (c) => c.npsEligible && c.clientGroupId === clientGroupId
  );
  const eligiblePeople = people.filter(
    (p) => p.npsEligible && p.clientGroupId === clientGroupId
  );

  const emails = new Set(
    eligibleContacts
      .map((c) => c.email.trim().toLowerCase())
      .filter(Boolean)
  );
  const nameKeys = new Set(
    eligibleContacts
      .map((c) => personNameKey(c.name))
      .filter(Boolean)
  );

  const respondents: NpsEligibleRespondent[] = eligibleContacts.map((c) => ({
    kind: "contact" as const,
    id: c.id,
    name: (c.name ?? "").trim() || c.email,
    cargo: c.cargo,
  }));

  for (const person of eligiblePeople) {
    const email = person.email?.trim().toLowerCase();
    if (email && emails.has(email)) continue;
    const nameKey = personNameKey(person.name);
    if (nameKey && nameKeys.has(nameKey)) continue;
    respondents.push({
      kind: "person",
      id: person.id,
      name: person.name.trim(),
      cargo: person.cargo,
    });
  }

  return respondents.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
