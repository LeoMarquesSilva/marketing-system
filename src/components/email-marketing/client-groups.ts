import type { EmailCompany, EmailContact, EmailPerson } from "@/lib/email-marketing";
import {
  contactToEnrichable,
  listMissingFieldLabels,
  matchesEnrichmentFilter,
  personToEnrichable,
  profileIsComplete,
  type EnrichmentFilterId,
} from "@/lib/email-marketing-enrichment";
import type { ClientGroupMeta } from "./email-marketing-visuals";

/** Um cliente (Grupo Cliente do SIOE) com as empresas, os contatos com e-mail e as pessoas do cadastro. */
export interface ClientGroupBucket {
  key: string;
  id: string | null;
  name: string;
  companies: EmailCompany[];
  contacts: EmailContact[];
  people: EmailPerson[];
  area: string | null;
  responsibleUserIds: string[];
  inactive: boolean;
  /** Cadastros (contatos + pessoas) e quantos estão completos. */
  profiles: number;
  complete: number;
  subscribed: number;
}

export const SEM_GRUPO = "__sem_grupo__";

function groupKey(entity: { clientGroupId: string | null; clientGroupName?: string | null }): string {
  return entity.clientGroupId ?? entity.clientGroupName ?? SEM_GRUPO;
}

export function buildClientGroups(
  companies: EmailCompany[],
  contacts: EmailContact[],
  people: EmailPerson[],
  meta: Map<string, ClientGroupMeta>
): ClientGroupBucket[] {
  const buckets = new Map<string, ClientGroupBucket>();
  const companyGroup = new Map<string, string>();

  const bucketFor = (key: string, id: string | null, name: string | null | undefined): ClientGroupBucket => {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        id,
        name: name ?? (id ? meta.get(id)?.name : null) ?? "Sem grupo",
        companies: [],
        contacts: [],
        people: [],
        area: null,
        responsibleUserIds: [],
        inactive: false,
        profiles: 0,
        complete: 0,
        subscribed: 0,
      };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const company of companies) {
    const key = groupKey(company);
    companyGroup.set(company.id, key);
    bucketFor(key, company.clientGroupId, company.clientGroupName).companies.push(company);
  }
  for (const contact of contacts) {
    // Sem grupo no contato, vale o grupo da empresa dele.
    const key = contact.clientGroupId ?? (contact.companyId ? companyGroup.get(contact.companyId) : undefined) ?? groupKey(contact);
    bucketFor(key, contact.clientGroupId, contact.clientGroupName).contacts.push(contact);
  }
  for (const person of people) {
    const key = groupKey(person);
    bucketFor(key, person.clientGroupId, person.clientGroupName).people.push(person);
  }

  for (const bucket of buckets.values()) {
    const info = bucket.id ? meta.get(bucket.id) : undefined;
    bucket.area =
      info?.responsibleArea ??
      bucket.companies.find((c) => c.responsibleArea)?.responsibleArea ??
      bucket.people.find((p) => p.responsibleArea)?.responsibleArea ??
      null;
    bucket.responsibleUserIds = Array.from(
      new Set([...(info?.responsibleUserIds ?? []), ...bucket.companies.flatMap((c) => c.responsibleUserIds)])
    );
    bucket.inactive = info?.gestorAtividade === "inativo";
    const profiles = [...bucket.contacts.map(contactToEnrichable), ...bucket.people.map(personToEnrichable)];
    bucket.profiles = profiles.length;
    bucket.complete = profiles.filter(profileIsComplete).length;
    bucket.subscribed = bucket.contacts.filter((c) => c.status === "subscribed").length;
  }

  return Array.from(buckets.values());
}

/** O grupo tem alguém (contato ou pessoa) que bate com a pendência escolhida? */
export function groupMatchesEnrichment(bucket: ClientGroupBucket, filter: EnrichmentFilterId): boolean {
  if (filter === "all") return true;
  return (
    bucket.contacts.some((c) => matchesEnrichmentFilter(contactToEnrichable(c), filter)) ||
    bucket.people.some((p) => matchesEnrichmentFilter(personToEnrichable(p), filter))
  );
}

export function contactMissing(contact: EmailContact): string[] {
  return listMissingFieldLabels(contactToEnrichable(contact));
}

export function personMissing(person: EmailPerson): string[] {
  return listMissingFieldLabels(personToEnrichable(person));
}
