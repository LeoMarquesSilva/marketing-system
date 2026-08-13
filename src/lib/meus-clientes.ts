/**
 * Escopo "meus clientes": quais empresas/pessoas um usuário (gestor)
 * é responsável por preencher.
 *
 * Só entram grupos com área responsável marcada (email_client_groups.responsible_area)
 * e cuja área o usuário gestiona em email_area_managers. Sem marcação, o grupo
 * não aparece para gestores — só o admin em "Ver todos".
 */

import type { EmailCompany, EmailContact, EmailGroupResponsible, EmailPerson } from "./email-marketing";
import { personNameKey } from "./email-marketing-normalize";
import { clientProfileIsIncomplete, contactToClientProfile, listClientMissingFieldLabels, personToClientProfile } from "./email-marketing-enrichment";
import { companyNameKey } from "./email-marketing-normalize";

/** Grupos do próprio escritório — não aparecem em Meus Clientes. */
const INTERNAL_CLIENT_GROUP_NAME_KEYS = new Set(["bismarchi pires"]);

export function isInternalClientGroupName(name: string | null | undefined): boolean {
  const key = companyNameKey(name);
  return key !== null && INTERNAL_CLIENT_GROUP_NAME_KEYS.has(key);
}

export function isInternalClientGroup(entity: {
  clientGroupId?: string | null;
  clientGroupName?: string | null;
  name?: string | null;
}): boolean {
  return isInternalClientGroupName(entity.clientGroupName) || isInternalClientGroupName(entity.name);
}

export function filterOutInternalClientGroups<
  T extends { clientGroupId?: string | null; clientGroupName?: string | null; name?: string | null },
>(items: T[]): T[] {
  return items.filter((item) => !isInternalClientGroup(item));
}

export function filterInternalResponsibles(
  responsibles: EmailGroupResponsible[],
  companies: EmailCompany[],
  people: EmailPerson[]
): EmailGroupResponsible[] {
  const internalGroupIds = new Set<string>();
  for (const entity of [...companies, ...people]) {
    if (isInternalClientGroup(entity) && entity.clientGroupId) {
      internalGroupIds.add(entity.clientGroupId);
    }
  }
  if (internalGroupIds.size === 0) return responsibles;
  return responsibles.filter((r) => !r.clientGroupId || !internalGroupIds.has(r.clientGroupId));
}

export function filterInternalContacts(
  contacts: EmailContact[],
  companies: EmailCompany[]
): EmailContact[] {
  const companiesById = new Map(companies.map((c) => [c.id, c]));
  return contacts.filter((contact) => {
    if (isInternalClientGroup(contact)) return false;
    if (contact.companyId) {
      const company = companiesById.get(contact.companyId);
      if (company && isInternalClientGroup(company)) return false;
    }
    return true;
  });
}

export interface EmailAreaManager {
  area: string;
  userId: string;
}

/** Subáreas exibidas/agrupadas dentro de uma área pai (mesmos gestores). */
export const AREA_SUBAREAS: Record<string, string[]> = {
  Cível: ["Recuperação de Crédito"],
};

const AREA_TO_PARENT = new Map<string, string>(
  Object.entries(AREA_SUBAREAS).flatMap(([parent, subs]) => subs.map((sub) => [sub, parent]))
);

/** Área raiz para agrupamento (ex.: Recuperação de Crédito → Cível). */
export function getAreaParent(area: string): string {
  return AREA_TO_PARENT.get(area) ?? area;
}

/** Área + subáreas configuradas para filtros e totais. */
export function expandRootArea(rootArea: string): string[] {
  const parent = getAreaParent(rootArea);
  const subs = AREA_SUBAREAS[parent] ?? [];
  return Array.from(new Set([parent, ...subs]));
}

export function isSubArea(area: string): boolean {
  return AREA_TO_PARENT.has(area);
}

/** Gestor de área pai enxerga também as subáreas. */
export function userCoversEntityArea(userAreas: Set<string>, entityArea: string): boolean {
  if (userAreas.has(entityArea)) return true;
  const parent = getAreaParent(entityArea);
  return parent !== entityArea && userAreas.has(parent);
}

function entityHasAnyArea(entityAreas: string[], targetAreas: string[]): boolean {
  return entityAreas.some((area) => targetAreas.includes(area));
}

function personHasAnyArea(
  personId: string,
  targetAreas: string[],
  personAreas: Map<string, Set<string>>
): boolean {
  const areas = personAreas.get(personId);
  if (!areas) return false;
  return Array.from(areas).some((area) => targetAreas.includes(area));
}

export interface MyClientScope {
  companyIds: Set<string>;
  personIds: Set<string>;
}

export function buildResponsibleAreaByGroupId(
  companies: EmailCompany[],
  people: EmailPerson[] = []
): Map<string, string> {
  const map = new Map<string, string>();
  for (const company of companies) {
    if (company.clientGroupId && company.responsibleArea) {
      map.set(company.clientGroupId, company.responsibleArea);
    }
  }
  for (const person of people) {
    if (person.clientGroupId && person.responsibleArea && !map.has(person.clientGroupId)) {
      map.set(person.clientGroupId, person.responsibleArea);
    }
  }
  return map;
}

function assignedAreaForGroup(
  groupId: string | null | undefined,
  areaByGroupId: Map<string, string>
): string | null {
  if (!groupId) return null;
  return areaByGroupId.get(groupId) ?? null;
}

export function computeMyClientScope(
  companies: EmailCompany[],
  responsibles: EmailGroupResponsible[],
  userId: string,
  areaManagers: EmailAreaManager[] = [],
  people: EmailPerson[] = []
): MyClientScope {
  const userAreas = new Set(areaManagers.filter((m) => m.userId === userId).map((m) => m.area));
  const areaByGroupId = buildResponsibleAreaByGroupId(companies, people);

  const companyIds = new Set<string>();
  for (const company of companies) {
    const ownerArea =
      assignedAreaForGroup(company.clientGroupId, areaByGroupId) ?? company.responsibleArea;
    // Escopo exclusivo: só gestores da área marcada (exata), sem herdar da área pai.
    if (ownerArea && userAreas.has(ownerArea)) {
      companyIds.add(company.id);
    }
  }

  const personIds = new Set<string>();
  for (const person of people) {
    const ownerArea =
      assignedAreaForGroup(person.clientGroupId, areaByGroupId) ?? person.responsibleArea;
    if (ownerArea && userAreas.has(ownerArea)) {
      personIds.add(person.id);
    }
  }

  return { companyIds, personIds };
}

export interface ManagerSummaryRow {
  userId: string;
  userName: string;
  areas: string[];
  companiesCount: number;
  companiesWithoutContact: number;
  contactsComplete: number;
  contactsPending: number;
  peopleComplete: number;
  peoplePending: number;
}

/**
 * Resumo (para o admin) de quantas empresas/contatos/pessoas ficaram no escopo
 * de cada gestor OFICIAL de área (email_area_managers) — não inclui todo advogado
 * que aparece individualmente como advogado_responsavel em algum processo, só
 * quem foi explicitamente cadastrado como gestor de uma área.
 */
export function buildManagerSummary(
  companies: EmailCompany[],
  contacts: EmailContact[],
  people: EmailPerson[],
  responsibles: EmailGroupResponsible[],
  areaManagers: EmailAreaManager[],
  userNameById: Map<string, string>
): ManagerSummaryRow[] {
  const userIds = new Set(areaManagers.map((m) => m.userId));

  const contactsByCompany = new Map<string, EmailContact[]>();
  for (const contact of contacts) {
    if (!contact.companyId) continue;
    const list = contactsByCompany.get(contact.companyId) ?? [];
    list.push(contact);
    contactsByCompany.set(contact.companyId, list);
  }
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const rows: ManagerSummaryRow[] = [];
  for (const userId of userIds) {
    const scope = computeMyClientScope(companies, responsibles, userId, areaManagers, people);
    if (scope.companyIds.size === 0 && scope.personIds.size === 0) continue;

    // Mostra apenas a(s) área(s) pela(s) qual(is) o usuário é gestor oficial —
    // não a união de todas as áreas das empresas no escopo dele (uma empresa
    // pode ter processos em várias áreas diferentes das dele).
    const areas = new Set<string>();
    for (const m of areaManagers) if (m.userId === userId) areas.add(m.area);

    let contactsComplete = 0;
    let contactsPending = 0;
    let companiesWithoutContact = 0;
    for (const companyId of scope.companyIds) {
      const companyContacts = contactsByCompany.get(companyId) ?? [];
      if (companyContacts.length === 0) {
        companiesWithoutContact++;
        continue;
      }
      for (const contact of companyContacts) {
        if (listClientMissingFieldLabels(contactToClientProfile(contact)).length > 0) contactsPending++;
        else contactsComplete++;
      }
    }

    let peopleComplete = 0;
    let peoplePending = 0;
    for (const personId of scope.personIds) {
      const person = peopleById.get(personId);
      if (!person) continue;
      if (listClientMissingFieldLabels(personToClientProfile(person)).length > 0) peoplePending++;
      else peopleComplete++;
    }

    rows.push({
      userId,
      userName: userNameById.get(userId) ?? "Usuário removido",
      areas: Array.from(areas).sort((a, b) => a.localeCompare(b, "pt-BR")),
      companiesCount: scope.companyIds.size,
      companiesWithoutContact,
      contactsComplete,
      contactsPending,
      peopleComplete,
      peoplePending,
    });
  }

  return rows.sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
}

export interface AreaManagerStat {
  userId: string;
  userName: string;
  /** Contatos + pessoas desta área que este gestor salvou/ajustou pessoalmente. */
  adjustedCount: number;
  /** Subconjunto dos ajustados que já estão com cadastro completo. */
  adjustedComplete: number;
}

export interface AreaSubSummary {
  area: string;
  groupsCount: number;
  groupsWithoutContact: number;
  profilesComplete: number;
  profilesPending: number;
}

export interface AreaSummaryGroup {
  area: string;
  subAreas: AreaSubSummary[];
  groupsCount: number;
  groupsWithoutContact: number;
  profilesComplete: number;
  profilesPending: number;
  managers: AreaManagerStat[];
}

/**
 * Resumo (para o admin) separado por área jurídica: totais da área no cabeçalho e,
 * para cada gestor, quantos registros ele pessoalmente ajustou (enriched_by_user_id).
 */
export function buildAreaManagerSummary(
  companies: EmailCompany[],
  contacts: EmailContact[],
  people: EmailPerson[],
  responsibles: EmailGroupResponsible[],
  areaManagers: EmailAreaManager[],
  userNameById: Map<string, string>
): AreaSummaryGroup[] {
  const companiesById = new Map(companies.map((c) => [c.id, c]));
  const contactsByGroup = buildContactsByGroup(contacts, companies);

  const personAreas = new Map<string, Set<string>>();
  for (const r of responsibles) {
    if (!r.personId || !r.area) continue;
    if (!personAreas.has(r.personId)) personAreas.set(r.personId, new Set());
    personAreas.get(r.personId)!.add(r.area);
  }

  function contactInArea(contact: EmailContact, companiesInArea: EmailCompany[]): boolean {
    const groupKey = resolveContactGroupKey(contact, companiesById);
    return companiesInArea.some((c) => resolveClientGroupKey(c) === groupKey);
  }

  function countProfilesInSlice(
    companiesInSlice: EmailCompany[],
    peopleInSlice: EmailPerson[]
  ): { profilesComplete: number; profilesPending: number } {
    const groupKeysInSlice = new Set<string>();
    for (const company of companiesInSlice) groupKeysInSlice.add(resolveClientGroupKey(company));
    for (const person of peopleInSlice) groupKeysInSlice.add(resolveClientGroupKey(person));

    let profilesComplete = 0;
    let profilesPending = 0;
    const countedContacts = new Set<string>();
    const contactEmailsInSlice = new Set<string>();
    const contactNameKeysInSlice = new Set<string>();
    for (const key of groupKeysInSlice) {
      for (const contact of contactsByGroup.get(key) ?? []) {
        if (countedContacts.has(contact.id)) continue;
        countedContacts.add(contact.id);
        contactEmailsInSlice.add(contact.email.toLowerCase());
        const nameKey = personNameKey(contact.name);
        if (nameKey) contactNameKeysInSlice.add(nameKey);
        if (listClientMissingFieldLabels(contactToClientProfile(contact)).length > 0) profilesPending++;
        else profilesComplete++;
      }
    }
    for (const person of peopleInSlice) {
      const email = person.email?.trim().toLowerCase();
      if (email && contactEmailsInSlice.has(email)) continue;
      const nameKey = personNameKey(person.name);
      if (nameKey && contactNameKeysInSlice.has(nameKey)) continue;
      if (listClientMissingFieldLabels(personToClientProfile(person)).length > 0) profilesPending++;
      else profilesComplete++;
    }
    return { profilesComplete, profilesPending };
  }

  function sliceForAreas(areaLabels: string[]): {
    companiesInSlice: EmailCompany[];
    peopleInSlice: EmailPerson[];
  } {
    const companiesInSlice = companies.filter((c) => entityHasAnyArea(c.legalAreas, areaLabels));
    const peopleInSlice = people.filter((p) => personHasAnyArea(p.id, areaLabels, personAreas));
    return { companiesInSlice, peopleInSlice };
  }

  function countAdjustedByUser(
    userId: string,
    areaLabels: string[],
    companiesInSlice: EmailCompany[]
  ): { adjustedCount: number; adjustedComplete: number } {
    let adjustedCount = 0;
    let adjustedComplete = 0;

    for (const contact of contacts) {
      if (contact.enrichedByUserId !== userId || !contactInArea(contact, companiesInSlice)) continue;
      adjustedCount++;
      if (listClientMissingFieldLabels(contactToClientProfile(contact)).length === 0) adjustedComplete++;
    }

    for (const person of people) {
      if (person.enrichedByUserId !== userId || !personHasAnyArea(person.id, areaLabels, personAreas)) continue;
      adjustedCount++;
      if (listClientMissingFieldLabels(personToClientProfile(person)).length === 0) adjustedComplete++;
    }

    return { adjustedCount, adjustedComplete };
  }

  const rootAreas = Array.from(
    new Set(areaManagers.map((m) => getAreaParent(m.area)))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return rootAreas.map((rootArea) => {
    const areaLabels = expandRootArea(rootArea);
    const { companiesInSlice, peopleInSlice } = sliceForAreas(areaLabels);

    const { profilesComplete, profilesPending: profilePendingOnly } = countProfilesInSlice(
      companiesInSlice,
      peopleInSlice
    );
    const { groupsCount, groupsWithoutContact } = countClientGroups(
      companiesInSlice,
      peopleInSlice,
      contacts
    );
    const profilesPending = profilePendingOnly + groupsWithoutContact;

    const subAreas: AreaSubSummary[] = (AREA_SUBAREAS[rootArea] ?? []).map((subArea) => {
      const { companiesInSlice: co, peopleInSlice: pe } = sliceForAreas([subArea]);
      const stats = countProfilesInSlice(co, pe);
      const groups = countClientGroups(co, pe, contacts);
      return {
        area: subArea,
        groupsCount: groups.groupsCount,
        groupsWithoutContact: groups.groupsWithoutContact,
        profilesComplete: stats.profilesComplete,
        profilesPending: stats.profilesPending + groups.groupsWithoutContact,
      };
    });

    const managerIds = Array.from(
      new Set(areaManagers.filter((m) => getAreaParent(m.area) === rootArea).map((m) => m.userId))
    );
    const managers: AreaManagerStat[] = managerIds
      .map((userId) => {
        const { adjustedCount, adjustedComplete } = countAdjustedByUser(
          userId,
          areaLabels,
          companiesInSlice
        );
        return {
          userId,
          userName: userNameById.get(userId) ?? "Usuário removido",
          adjustedCount,
          adjustedComplete,
        };
      })
      .sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));

    return {
      area: rootArea,
      subAreas,
      groupsCount,
      groupsWithoutContact,
      profilesComplete,
      profilesPending,
      managers,
    };
  });
}

export interface EnrichmentTotals {
  groupsCount: number;
  groupsWithoutContact: number;
  profilesComplete: number;
  profilesPending: number;
  adjustedCount: number;
  adjustedComplete: number;
}

export function resolveClientGroupKey(entity: {
  clientGroupId: string | null;
  clientGroupName?: string | null;
}): string {
  return entity.clientGroupId ?? entity.clientGroupName ?? "__sem_grupo__";
}

export function resolveContactGroupKey(
  contact: EmailContact,
  companiesById: Map<string, EmailCompany>
): string {
  if (contact.clientGroupId || contact.clientGroupName) return resolveClientGroupKey(contact);
  if (contact.companyId) {
    const company = companiesById.get(contact.companyId);
    if (company) return resolveClientGroupKey(company);
  }
  return "__sem_grupo__";
}

/** Valor do filtro “Sem área” (UI e export CSV). */
export const CLIENT_AREA_FILTER_SEM = "__sem_area__";

function groupAreasMatchRootFilter(groupAreas: string[], filterArea: string): boolean {
  const root = getAreaParent(filterArea);
  const expanded = expandRootArea(root);
  return groupAreas.some((area) => getAreaParent(area) === root || expanded.includes(area));
}

/** Áreas atribuídas a um grupo (empresas, pessoas e responsáveis por grupo). */
export function resolveClientGroupAreas(
  groupKey: string,
  companies: EmailCompany[],
  people: EmailPerson[],
  personAreas: Map<string, string[]>,
  responsibles: EmailGroupResponsible[] = []
): string[] {
  const set = new Set<string>();
  for (const company of companies) {
    if (resolveClientGroupKey(company) !== groupKey) continue;
    for (const area of company.legalAreas) set.add(area);
  }
  for (const person of people) {
    if (resolveClientGroupKey(person) !== groupKey) continue;
    for (const area of personAreas.get(person.id) ?? []) set.add(area);
  }
  for (const responsible of responsibles) {
    if (!responsible.area || responsible.clientGroupId !== groupKey) continue;
    set.add(responsible.area);
  }
  return Array.from(set);
}

/** Grupos sem nenhuma área atribuída (considerando todas as entidades do grupo). */
export function buildClientGroupKeysWithoutArea(
  companies: EmailCompany[],
  people: EmailPerson[],
  personAreas: Map<string, string[]>,
  responsibles: EmailGroupResponsible[] = []
): Set<string> {
  const groupKeys = new Set<string>();
  for (const company of companies) groupKeys.add(resolveClientGroupKey(company));
  for (const person of people) groupKeys.add(resolveClientGroupKey(person));

  const withoutArea = new Set<string>();
  for (const groupKey of groupKeys) {
    if (
      resolveClientGroupAreas(groupKey, companies, people, personAreas, responsibles).length === 0
    ) {
      withoutArea.add(groupKey);
    }
  }
  return withoutArea;
}

/**
 * Grupos que entram no filtro de área.
 * Regra: se qualquer empresa/pessoa do grupo tem a área, o grupo inteiro conta
 * (ex.: 1 de 30 empresas com Trabalhista → Grupo Y é Trabalhista).
 */
export function buildClientGroupKeysForAreaFilter(
  filterArea: string,
  companies: EmailCompany[],
  people: EmailPerson[],
  personAreas: Map<string, string[]>,
  responsibles: EmailGroupResponsible[] = []
): Set<string> {
  if (filterArea === CLIENT_AREA_FILTER_SEM) {
    return buildClientGroupKeysWithoutArea(companies, people, personAreas, responsibles);
  }

  const groupKeys = new Set<string>();
  for (const company of companies) groupKeys.add(resolveClientGroupKey(company));
  for (const person of people) groupKeys.add(resolveClientGroupKey(person));

  const matching = new Set<string>();
  for (const groupKey of groupKeys) {
    const areas = resolveClientGroupAreas(groupKey, companies, people, personAreas, responsibles);
    if (groupAreasMatchRootFilter(areas, filterArea)) {
      matching.add(groupKey);
    }
  }
  return matching;
}

function contactDedupKeys(contacts: EmailContact[]): {
  emails: Set<string>;
  nameKeys: Set<string>;
} {
  const emails = new Set<string>();
  const nameKeys = new Set<string>();
  for (const contact of contacts) {
    if (contact.email) emails.add(contact.email.trim().toLowerCase());
    const key = personNameKey(contact.name);
    if (key) nameKeys.add(key);
  }
  return { emails, nameKeys };
}

/** Remove pessoas SIOE que já existem como contato RD/SIOE (e-mail ou nome). */
export function filterPeopleNotInContacts(
  groupPeople: EmailPerson[],
  groupContacts: EmailContact[]
): EmailPerson[] {
  const { emails, nameKeys } = contactDedupKeys(groupContacts);
  return groupPeople.filter((person) => {
    const email = person.email?.trim().toLowerCase();
    if (email && emails.has(email)) return false;
    const nameKey = personNameKey(person.name);
    if (nameKey && nameKeys.has(nameKey)) return false;
    return true;
  });
}

export function mergeGroupMembers(
  groupContacts: EmailContact[],
  groupPeople: EmailPerson[]
): { contacts: EmailContact[]; people: EmailPerson[] } {
  return {
    contacts: groupContacts,
    people: filterPeopleNotInContacts(groupPeople, groupContacts),
  };
}

function buildContactsByGroup(
  contacts: EmailContact[],
  companies: EmailCompany[]
): Map<string, EmailContact[]> {
  const companiesById = new Map(companies.map((c) => [c.id, c]));
  const map = new Map<string, EmailContact[]>();
  for (const contact of contacts) {
    const key = resolveContactGroupKey(contact, companiesById);
    const list = map.get(key) ?? [];
    list.push(contact);
    map.set(key, list);
  }
  return map;
}

function countClientGroups(
  companies: EmailCompany[],
  people: EmailPerson[],
  contacts: EmailContact[]
): { groupsCount: number; groupsWithoutContact: number } {
  const groupKeys = new Set<string>();

  for (const company of companies) groupKeys.add(resolveClientGroupKey(company));
  for (const person of people) groupKeys.add(resolveClientGroupKey(person));

  const contactsByGroup = buildContactsByGroup(contacts, companies);

  let groupsWithoutContact = 0;
  const peopleByGroupKey = new Map<string, EmailPerson[]>();
  for (const person of people) {
    const key = resolveClientGroupKey(person);
    const list = peopleByGroupKey.get(key) ?? [];
    list.push(person);
    peopleByGroupKey.set(key, list);
  }

  for (const key of groupKeys) {
    const groupContacts = contactsByGroup.get(key) ?? [];
    const groupPeople = peopleByGroupKey.get(key) ?? [];
    if (countGroupMembers(groupPeople, groupContacts) === 0) groupsWithoutContact++;
  }

  return { groupsCount: groupKeys.size, groupsWithoutContact };
}

/** Totais de enriquecimento (grupos únicos, sem duplicar por área). */
export function computeEnrichmentTotals(
  companies: EmailCompany[],
  contacts: EmailContact[],
  people: EmailPerson[],
  scope?: { companyIds?: Set<string>; personIds?: Set<string> }
): EnrichmentTotals {
  const companyList = scope?.companyIds
    ? companies.filter((c) => scope.companyIds!.has(c.id))
    : companies;
  const peopleList = scope?.personIds ? people.filter((p) => scope.personIds!.has(p.id)) : people;

  const scopedGroupKeys = new Set<string>();
  for (const company of companyList) scopedGroupKeys.add(resolveClientGroupKey(company));
  for (const person of peopleList) scopedGroupKeys.add(resolveClientGroupKey(person));

  const companiesById = new Map(companies.map((c) => [c.id, c]));

  let profilesComplete = 0;
  let profilesPending = 0;
  const countedContacts = new Set<string>();
  const contactEmailsInScope = new Set<string>();
  const contactNameKeysInScope = new Set<string>();
  for (const contact of contacts) {
    const key = resolveContactGroupKey(contact, companiesById);
    if (!scopedGroupKeys.has(key) || countedContacts.has(contact.id)) continue;
    countedContacts.add(contact.id);
    contactEmailsInScope.add(contact.email.toLowerCase());
    const nameKey = personNameKey(contact.name);
    if (nameKey) contactNameKeysInScope.add(nameKey);
    if (listClientMissingFieldLabels(contactToClientProfile(contact)).length > 0) profilesPending++;
    else profilesComplete++;
  }
  for (const person of peopleList) {
    const email = person.email?.trim().toLowerCase();
    if (email && contactEmailsInScope.has(email)) continue;
    const nameKey = personNameKey(person.name);
    if (nameKey && contactNameKeysInScope.has(nameKey)) continue;
    if (!scopedGroupKeys.has(resolveClientGroupKey(person))) continue;
    if (listClientMissingFieldLabels(personToClientProfile(person)).length > 0) profilesPending++;
    else profilesComplete++;
  }

  const { groupsCount, groupsWithoutContact } = countClientGroups(companyList, peopleList, contacts);

  let adjustedCount = 0;
  let adjustedComplete = 0;
  for (const contact of contacts) {
    if (!contact.enrichedByUserId) continue;
    const key = resolveContactGroupKey(contact, companiesById);
    if (!scopedGroupKeys.has(key)) continue;
    adjustedCount++;
    if (listClientMissingFieldLabels(contactToClientProfile(contact)).length === 0) adjustedComplete++;
  }
  for (const person of peopleList) {
    const email = person.email?.trim().toLowerCase();
    if (email && contactEmailsInScope.has(email)) continue;
    const nameKey = personNameKey(person.name);
    if (nameKey && contactNameKeysInScope.has(nameKey)) continue;
    if (!scopedGroupKeys.has(resolveClientGroupKey(person))) continue;
    if (!person.enrichedByUserId) continue;
    adjustedCount++;
    if (listClientMissingFieldLabels(personToClientProfile(person)).length === 0) adjustedComplete++;
  }

  return {
    groupsCount,
    groupsWithoutContact,
    profilesComplete,
    profilesPending: profilesPending + groupsWithoutContact,
    adjustedCount,
    adjustedComplete,
  };
}

export function totalsFromAreaGroup(group: AreaSummaryGroup): EnrichmentTotals {
  const adjustedCount = group.managers.reduce((s, m) => s + m.adjustedCount, 0);
  const adjustedComplete = group.managers.reduce((s, m) => s + m.adjustedComplete, 0);
  return {
    groupsCount: group.groupsCount,
    groupsWithoutContact: group.groupsWithoutContact,
    profilesComplete: group.profilesComplete,
    profilesPending: group.profilesPending,
    adjustedCount,
    adjustedComplete,
  };
}

export function countGroupMembers(
  groupPeople: EmailPerson[],
  groupContacts: EmailContact[]
): number {
  const { contacts, people } = mergeGroupMembers(groupContacts, groupPeople);
  return contacts.length + people.length;
}

export function groupHasNoContacts(
  groupPeople: EmailPerson[],
  groupContacts: EmailContact[]
): boolean {
  return countGroupMembers(groupPeople, groupContacts) === 0;
}

export function groupIsPending(
  groupPeople: EmailPerson[],
  groupContacts: EmailContact[]
): boolean {
  if (groupHasNoContacts(groupPeople, groupContacts)) return true;
  return countGroupIncompleteProfiles(groupPeople, groupContacts) > 0;
}

export function countGroupIncompleteProfiles(
  groupPeople: EmailPerson[],
  groupContacts: EmailContact[]
): number {
  const { people } = mergeGroupMembers(groupContacts, groupPeople);
  const pendingPeople = people.filter((p) => clientProfileIsIncomplete(personToClientProfile(p))).length;
  const pendingContacts = groupContacts.filter((c) => clientProfileIsIncomplete(contactToClientProfile(c))).length;
  return pendingPeople + pendingContacts;
}

export function countGroupPendingMembers(
  groupPeople: EmailPerson[],
  groupContacts: EmailContact[]
): number {
  if (groupHasNoContacts(groupPeople, groupContacts)) return 1;
  return countGroupIncompleteProfiles(groupPeople, groupContacts);
}

export function compareGroupsByPendingFirst<
  T extends { name: string; groupPeople: EmailPerson[] },
>(a: T, b: T, contactsByGroup: Map<string, EmailContact[]>, groupKey: (g: T) => string): number {
  const pendingA = countGroupPendingMembers(a.groupPeople, contactsByGroup.get(groupKey(a)) ?? []);
  const pendingB = countGroupPendingMembers(b.groupPeople, contactsByGroup.get(groupKey(b)) ?? []);
  if (pendingA !== pendingB) return pendingB - pendingA;
  return a.name.localeCompare(b.name, "pt-BR");
}

