/**
 * Agregação de progresso de preenchimento (e-mail, cargo, telefone, área) por
 * área jurídica + advogado responsável, usada no painel de admin.
 */

import type { EmailContact, EmailGroupResponsible, EmailPerson } from "./email-marketing";
import {
  computeEnrichmentStats,
  contactToEnrichable,
  personToEnrichable,
  type EnrichableFields,
  type EnrichmentStats,
} from "./email-marketing-enrichment";

export interface ResponsibleProgressRow {
  key: string;
  userId: string | null;
  userName: string;
  matched: boolean;
  area: string | null;
  stats: EnrichmentStats;
}

export function buildResponsibleProgress(
  responsibles: EmailGroupResponsible[],
  contacts: EmailContact[],
  people: EmailPerson[],
  userNameById: Map<string, string>
): ResponsibleProgressRow[] {
  const contactsByCompany = new Map<string, EmailContact[]>();
  for (const contact of contacts) {
    if (!contact.companyId) continue;
    const list = contactsByCompany.get(contact.companyId) ?? [];
    list.push(contact);
    contactsByCompany.set(contact.companyId, list);
  }
  const peopleById = new Map(people.map((p) => [p.id, p]));

  interface Bucket {
    userId: string | null;
    userName: string;
    matched: boolean;
    area: string | null;
    profiles: EnrichableFields[];
    seenPersonIds: Set<string>;
    seenCompanyIds: Set<string>;
  }
  const buckets = new Map<string, Bucket>();

  for (const row of responsibles) {
    const matched = Boolean(row.responsibleUserId);
    const userName = row.responsibleUserId
      ? userNameById.get(row.responsibleUserId) ?? "Usuário removido"
      : row.advogadoResponsavelName
        ? `${row.advogadoResponsavelName} (não vinculado)`
        : "Sem responsável identificado";
    const key = `${row.responsibleUserId ?? row.advogadoResponsavelName ?? "sem-responsavel"}::${row.area ?? "sem-area"}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        userId: row.responsibleUserId,
        userName,
        matched,
        area: row.area,
        profiles: [],
        seenPersonIds: new Set(),
        seenCompanyIds: new Set(),
      };
      buckets.set(key, bucket);
    }

    if (row.companyId && !bucket.seenCompanyIds.has(row.companyId)) {
      bucket.seenCompanyIds.add(row.companyId);
      const companyContacts = contactsByCompany.get(row.companyId) ?? [];
      bucket.profiles.push(...companyContacts.map(contactToEnrichable));
    } else if (row.personId && !bucket.seenPersonIds.has(row.personId)) {
      bucket.seenPersonIds.add(row.personId);
      const person = peopleById.get(row.personId);
      if (person) bucket.profiles.push(personToEnrichable(person));
    }
  }

  return Array.from(buckets.values())
    .filter((bucket) => bucket.profiles.length > 0)
    .map((bucket) => ({
      key: `${bucket.userId ?? bucket.userName}::${bucket.area ?? ""}`,
      userId: bucket.userId,
      userName: bucket.userName,
      matched: bucket.matched,
      area: bucket.area,
      stats: computeEnrichmentStats(bucket.profiles),
    }))
    .sort((a, b) => {
      const nameCompare = a.userName.localeCompare(b.userName, "pt-BR");
      if (nameCompare !== 0) return nameCompare;
      return (a.area ?? "").localeCompare(b.area ?? "", "pt-BR");
    });
}
