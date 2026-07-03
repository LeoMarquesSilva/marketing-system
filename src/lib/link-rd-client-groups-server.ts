/**
 * Vincula registros importados do RD Station (sem client_group_id)
 * aos grupos de cliente do SIOE (email_client_groups).
 */

import { getAdminClient } from "@/lib/email-marketing-server";
import { companyNameKey, normalizeCompanyName } from "@/lib/email-marketing-normalize";
import { isInternalClientGroupName } from "@/lib/meus-clientes";

export interface LinkRdGroupsResult {
  groupsIndexed: number;
  companiesMatched: number;
  companiesUpdated: number;
  contactsMatched: number;
  contactsUpdated: number;
  unmatchedCompanySamples: string[];
  ambiguousSamples: string[];
}

function stripGrupoPrefix(key: string): string {
  return key.replace(/^grupo\s+/, "").trim();
}

/** Gera chaves candidatas para casar um nome livre (RD) com grupos SIOE. */
export function candidateGroupKeys(rawName: string | null | undefined): string[] {
  const normalized = normalizeCompanyName(rawName);
  if (!normalized) return [];
  if (isInternalClientGroupName(normalized)) return [];

  const keys = new Set<string>();
  const primary = companyNameKey(normalized);
  if (primary) {
    keys.add(primary);
    if (!primary.startsWith("grupo ")) {
      const withGrupo = companyNameKey(`Grupo ${normalized}`);
      if (withGrupo) keys.add(withGrupo);
    } else {
      keys.add(stripGrupoPrefix(primary));
    }
  }

  const lower = normalized.toLowerCase();
  keys.add(lower);
  if (!lower.startsWith("grupo ")) keys.add(`grupo ${lower}`);

  return Array.from(keys).filter((k) => k.length >= 2);
}

type GroupLookup = Map<string, string[]>;

function addToLookup(lookup: GroupLookup, key: string | null, groupId: string) {
  if (!key || key.length < 2) return;
  const list = lookup.get(key) ?? [];
  if (!list.includes(groupId)) list.push(groupId);
  lookup.set(key, list);
}

function pickGroupId(lookup: GroupLookup, keys: string[]): string | null {
  for (const key of keys) {
    const ids = lookup.get(key);
    if (ids?.length === 1) return ids[0];
  }
  return null;
}

function pickAmbiguous(lookup: GroupLookup, keys: string[]): string | null {
  for (const key of keys) {
    const ids = lookup.get(key);
    if (ids && ids.length > 1) return `${key} → ${ids.length} grupos`;
  }
  return null;
}

export async function linkRdRecordsToSioeGroups(options?: {
  dryRun?: boolean;
}): Promise<LinkRdGroupsResult> {
  const dryRun = options?.dryRun ?? false;
  const admin = getAdminClient();

  const [{ data: groups }, { data: sioeCompanies }, { data: rdCompanies }, { data: rdContacts }] =
    await Promise.all([
      admin.from("email_client_groups").select("id, name, name_normalized"),
      admin
        .from("email_companies")
        .select("id, name, name_normalized, client_group_id")
        .eq("source", "sioe")
        .not("client_group_id", "is", null),
      admin
        .from("email_companies")
        .select("id, name, name_normalized, client_group_id")
        .eq("source", "rd-station")
        .is("client_group_id", null),
      admin
        .from("email_contacts")
        .select("id, company, company_id, client_group_id")
        .eq("source", "rd-station")
        .is("client_group_id", null),
    ]);

  const lookup: GroupLookup = new Map();

  for (const group of groups ?? []) {
    if (isInternalClientGroupName(group.name as string)) continue;
    const groupId = group.id as string;
    const normalized = group.name_normalized as string;
    addToLookup(lookup, normalized, groupId);
    addToLookup(lookup, companyNameKey(group.name as string), groupId);
    const core = stripGrupoPrefix(normalized);
    if (core.length >= 3) addToLookup(lookup, core, groupId);
  }

  for (const company of sioeCompanies ?? []) {
    const groupId = company.client_group_id as string;
    addToLookup(lookup, company.name_normalized as string, groupId);
    addToLookup(lookup, companyNameKey(company.name as string), groupId);
  }

  let companiesMatched = 0;
  let companiesUpdated = 0;
  const unmatchedCompanySamples: string[] = [];
  const ambiguousSamples: string[] = [];
  const companyGroupUpdates = new Map<string, string>();

  for (const company of rdCompanies ?? []) {
    const keys = candidateGroupKeys(company.name as string);
    const groupId = pickGroupId(lookup, keys);
    if (!groupId) {
      const amb = pickAmbiguous(lookup, keys);
      if (amb && ambiguousSamples.length < 20) ambiguousSamples.push(`${company.name}: ${amb}`);
      else if (unmatchedCompanySamples.length < 25) unmatchedCompanySamples.push(company.name as string);
      continue;
    }
    companiesMatched++;
    companyGroupUpdates.set(company.id as string, groupId);
    if (!dryRun) {
      const { error } = await admin
        .from("email_companies")
        .update({ client_group_id: groupId })
        .eq("id", company.id);
      if (error) throw new Error(error.message);
      companiesUpdated++;
    }
  }

  let contactsMatched = 0;
  let contactsUpdated = 0;
  const companyGroupById = new Map<string, string>();

  const { data: allCompanies } = await admin
    .from("email_companies")
    .select("id, name, client_group_id")
    .not("client_group_id", "is", null);
  for (const co of allCompanies ?? []) {
    companyGroupById.set(co.id as string, co.client_group_id as string);
  }

  // Propaga grupo da empresa para contatos RD já vinculados por company_id.
  if (!dryRun) {
    for (const contact of rdContacts ?? []) {
      if (contact.client_group_id || !contact.company_id) continue;
      const groupId = companyGroupById.get(contact.company_id as string);
      if (!groupId) continue;
      const { error } = await admin
        .from("email_contacts")
        .update({ client_group_id: groupId })
        .eq("id", contact.id);
      if (error) throw new Error(error.message);
      contactsMatched++;
      contactsUpdated++;
    }
  }

  for (const contact of rdContacts ?? []) {
    if (contact.client_group_id) continue;

    const keys = candidateGroupKeys(contact.company as string | null);
    const groupId = pickGroupId(lookup, keys);

    if (!groupId) continue;
    contactsMatched++;
    if (!dryRun) {
      const { error } = await admin
        .from("email_contacts")
        .update({ client_group_id: groupId })
        .eq("id", contact.id);
      if (error) throw new Error(error.message);
      contactsUpdated++;
    }
  }

  return {
    groupsIndexed: groups?.length ?? 0,
    companiesMatched,
    companiesUpdated: dryRun ? 0 : companiesUpdated,
    contactsMatched,
    contactsUpdated: dryRun ? 0 : contactsUpdated,
    unmatchedCompanySamples,
    ambiguousSamples,
  };
}
