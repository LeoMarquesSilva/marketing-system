import { isExplicitNpsNo } from "@/lib/meus-clientes-invite-filter";

export { resolveNpsCollectionArea } from "@/lib/meus-clientes";

export interface NpsEligibleSourceContact {
  id: string;
  name: string | null;
  email: string;
  cargo: string | null;
  npsEligible: boolean;
  clientGroupId: string | null;
  invitesClassifiedByUserId?: string | null;
}

export interface NpsEligibleSourcePerson {
  id: string;
  name: string;
  email: string | null;
  cargo: string | null;
  npsEligible: boolean;
  clientGroupId: string | null;
  invitesClassifiedByUserId?: string | null;
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

/** NPS sim ou ainda sem classificação — exclui só quem marcou “não”. */
export function isNpsOutreachCandidate(member: {
  npsEligible: boolean;
  invitesClassifiedByUserId?: string | null;
}): boolean {
  return !isExplicitNpsNo(member);
}

/**
 * Contatos e pessoas do grupo com nps_eligible=true.
 * Pessoas cujo e-mail ou nome já batem com um contato elegível são omitidas.
 * Com `includeUnclassified`, entra também quem ainda não classificou o NPS.
 */
export function buildEligibleRespondents(
  contacts: NpsEligibleSourceContact[],
  people: NpsEligibleSourcePerson[],
  clientGroupId: string,
  options?: { includeUnclassified?: boolean }
): NpsEligibleRespondent[] {
  const matches = (member: {
    npsEligible: boolean;
    clientGroupId: string | null;
    invitesClassifiedByUserId?: string | null;
  }) => {
    if (member.clientGroupId !== clientGroupId) return false;
    if (options?.includeUnclassified) return isNpsOutreachCandidate(member);
    return member.npsEligible;
  };

  const eligibleContacts = contacts.filter(matches);
  const eligiblePeople = people.filter(matches);

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

export const NPS_OUTREACH_NO_AREA = "Sem área";
export const NPS_OUTREACH_NO_SENDER = "Sem colaborador definido";

export interface NpsOutreachAreaGroup {
  id: string;
  name: string;
  eligiblePeople: number;
  sent: boolean;
  respondedPeople: number;
  senderUserId: string | null;
  senderName: string;
  senderAvatarUrl: string | null;
}

export interface NpsOutreachAreaBreakdown {
  area: string;
  eligiblePeople: number;
  eligibleGroups: number;
  sentGroups: number;
  respondedPeople: number;
  groups: NpsOutreachAreaGroup[];
}

export interface NpsOutreachProgress {
  eligiblePeople: number;
  eligibleGroups: number;
  sentGroups: number;
  respondedPeople: number;
  byArea: NpsOutreachAreaBreakdown[];
}

function toCountMap(
  input: Map<string, number> | Record<string, number> | undefined
): Map<string, number> {
  if (!input) return new Map();
  return input instanceof Map ? input : new Map(Object.entries(input));
}

function toStringMap(
  input: Map<string, string | null> | Record<string, string | null> | undefined
): Map<string, string | null> | null {
  if (!input) return null;
  return input instanceof Map ? input : new Map(Object.entries(input));
}

function toNameMap(
  input: Map<string, string> | Record<string, string> | undefined
): Map<string, string> {
  if (!input) return new Map();
  return input instanceof Map ? input : new Map(Object.entries(input));
}

function emptyAreaRow(area: string): NpsOutreachAreaBreakdown {
  return {
    area,
    eligiblePeople: 0,
    eligibleGroups: 0,
    sentGroups: 0,
    respondedPeople: 0,
    groups: [],
  };
}

export function computeNpsOutreachProgress(options: {
  eligibleCountByGroupId: Map<string, number> | Record<string, number>;
  sentGroupIds: Iterable<string>;
  respondedPeople?: number;
  respondedCountByGroupId?: Map<string, number> | Record<string, number>;
  areaByGroupId?: Map<string, string | null> | Record<string, string | null>;
  groupNameById?: Map<string, string> | Record<string, string>;
  senderByGroupId?: Map<
    string,
    { userId: string; name: string; avatarUrl: string | null } | null
  >;
}): NpsOutreachProgress {
  const eligible = toCountMap(options.eligibleCountByGroupId);
  const responded = toCountMap(options.respondedCountByGroupId);
  const areaByGroupId = toStringMap(options.areaByGroupId);
  const groupNameById = toNameMap(options.groupNameById);

  let eligiblePeople = 0;
  let eligibleGroups = 0;
  for (const count of eligible.values()) {
    if (count <= 0) continue;
    eligibleGroups += 1;
    eligiblePeople += count;
  }

  const sentSet = new Set(options.sentGroupIds);
  let sentGroups = 0;
  for (const groupId of sentSet) {
    if ((eligible.get(groupId) ?? 0) > 0) sentGroups += 1;
  }

  let respondedPeople = 0;
  if (options.respondedPeople != null) {
    respondedPeople = Math.max(0, options.respondedPeople);
  } else {
    for (const count of responded.values()) respondedPeople += Math.max(0, count);
  }

  const byAreaMap = new Map<string, NpsOutreachAreaBreakdown>();
  const areaOf = (groupId: string) => {
    const labeled = areaByGroupId?.get(groupId)?.trim();
    return labeled || NPS_OUTREACH_NO_AREA;
  };
  const rowFor = (groupId: string) => {
    const area = areaOf(groupId);
    const existing = byAreaMap.get(area);
    if (existing) return existing;
    const created = emptyAreaRow(area);
    byAreaMap.set(area, created);
    return created;
  };

  if (areaByGroupId) {
    for (const [groupId, count] of eligible) {
      if (count <= 0) continue;
      const row = rowFor(groupId);
      row.eligiblePeople += count;
      row.eligibleGroups += 1;
      const sender = options.senderByGroupId?.get(groupId);
      row.groups.push({
        id: groupId,
        name: groupNameById.get(groupId) || groupId,
        eligiblePeople: count,
        sent: sentSet.has(groupId),
        respondedPeople: responded.get(groupId) ?? 0,
        senderUserId: sender?.userId ?? null,
        senderName: sender?.name ?? NPS_OUTREACH_NO_SENDER,
        senderAvatarUrl: sender?.avatarUrl ?? null,
      });
    }
    for (const groupId of sentSet) {
      if ((eligible.get(groupId) ?? 0) <= 0) continue;
      rowFor(groupId).sentGroups += 1;
    }
    for (const [groupId, count] of responded) {
      if (count <= 0) continue;
      rowFor(groupId).respondedPeople += count;
    }
    for (const row of byAreaMap.values()) {
      row.groups.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
  }

  const byArea = Array.from(byAreaMap.values()).sort((a, b) => {
    if (b.eligiblePeople !== a.eligiblePeople) return b.eligiblePeople - a.eligiblePeople;
    return a.area.localeCompare(b.area, "pt-BR");
  });

  return {
    eligiblePeople,
    eligibleGroups,
    sentGroups,
    respondedPeople,
    byArea,
  };
}
