/**
 * Módulo de E-mail Marketing — tipos e CRUD (client-side, RLS por usuário autenticado).
 * Envio, webhook e descadastro público ficam em src/lib/email-marketing-server.ts
 * (precisam de service role e/ou da API key do Resend).
 */

import { supabase } from "@/utils/supabase/client";
import {
  normalizeCompanyName,
  normalizeCustomFields,
  formatPersonDisplayName,
  normalizePersonName,
  normalizeTags,
  companyNameKey,
  resolveCanonicalCompanyName,
} from "@/lib/email-marketing-normalize";
import { normalizeLegalArea, normalizeLegalAreas, isSubareaOnlyManagerArea } from "@/lib/legal-areas";

export type EmailContactStatus = "subscribed" | "unsubscribed" | "bounced" | "complained";
export type EmailCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "failed";
export type EmailRecipientStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed";

export interface EmailPerson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpfCnpj: string | null;
  cargo: string | null;
  area: string | null;
  npsEligible: boolean;
  partyInvite: boolean;
  enrichedByUserId: string | null;
  invitesClassifiedByUserId: string | null;
  clientGroupId: string | null;
  clientGroupName?: string | null;
  companyId: string | null;
  source: string | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EmailGroupResponsible {
  id: string;
  clientGroupId: string | null;
  companyId: string | null;
  personId: string | null;
  area: string | null;
  advogadoResponsavelName: string | null;
  responsibleUserId: string | null;
  openProcessesCount: number;
}

export interface EmailClientGroup {
  id: string;
  name: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  companyCount?: number;
  contactCount?: number;
}

export interface EmailCompany {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  website: string | null;
  linkedin: string | null;
  cnpj: string | null;
  source: string | null;
  clientGroupId: string | null;
  clientGroupName: string | null;
  legalAreas: string[];
  responsibleUserIds: string[];
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  contactCount?: number;
}

export interface EmailContact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  companyId: string | null;
  companyName?: string | null;
  clientGroupId: string | null;
  clientGroupName?: string | null;
  cargo: string | null;
  npsEligible: boolean;
  partyInvite: boolean;
  enrichedByUserId: string | null;
  invitesClassifiedByUserId: string | null;
  tags: string[];
  status: EmailContactStatus;
  source: string | null;
  customFields: Record<string, unknown>;
  rdUuid: string | null;
  rdSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  unsubscribedAt: string | null;
}

export interface EmailRdEmail {
  id: string;
  rdEmailId: number;
  rdCampaignId: number | null;
  name: string;
  subject: string | null;
  status: string | null;
  sendAt: string | null;
  leadsCount: number;
  htmlBody: string | null;
  analytics: Record<string, unknown>;
  syncedAt: string;
}

export interface EmailList {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  contactCount?: number;
}

export interface EmailCampaignStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
}

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  previewText: string | null;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  htmlBody: string;
  listId: string | null;
  listName?: string | null;
  status: EmailCampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  stats?: EmailCampaignStats;
}

export interface EmailCampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string;
  contactEmail?: string;
  contactName?: string | null;
  status: EmailRecipientStatus;
  openCount: number;
  clickCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  firstClickedAt: string | null;
  bouncedAt: string | null;
  bounceType: string | null;
  complainedAt: string | null;
  sentAt: string | null;
  failedReason: string | null;
}

export interface EmailSenderConfig {
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
}

export async function fetchEmailSenderConfig(): Promise<EmailSenderConfig> {
  const res = await fetch("/api/email-marketing/sender-config");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro ao carregar remetente padrão.");
  return data as EmailSenderConfig;
}

/** Browser: sessão do usuário. Servidor: service role (sem next/headers). */
async function getEmailDb() {
  if (typeof window !== "undefined") return supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(url, serviceKey);
  }
  return supabase;
}

// --- Mappers ---

export function mapPerson(row: Record<string, unknown>): EmailPerson {
  const joined = (row as { email_client_groups?: { id: string; name: string } | null }).email_client_groups;
  const groupFromJoin = joined?.name
    ? normalizeCompanyName(joined.name) ?? resolveCanonicalCompanyName(joined.name)
    : null;
  const groupFromCustom = normalizeCompanyName(
    (row.custom_fields as Record<string, unknown> | null)?.sioe_grupo_cliente as string | null
  );
  return {
    id: row.id as string,
    name: formatPersonDisplayName(row.name as string) ?? (row.name as string),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    cpfCnpj: normalizeCompanyName(row.cpf_cnpj as string | null),
    cargo: normalizePersonName(row.cargo as string | null),
    area: normalizeLegalArea(row.area as string | null),
    npsEligible: Boolean(row.nps_eligible),
    partyInvite: Boolean(row.party_invite),
    enrichedByUserId: (row.enriched_by_user_id as string | null) ?? null,
    invitesClassifiedByUserId: (row.invites_classified_by_user_id as string | null) ?? null,
    clientGroupId: (row.client_group_id as string | null) ?? joined?.id ?? null,
    clientGroupName: groupFromJoin ?? groupFromCustom,
    companyId: (row.company_id as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    customFields: (row.custom_fields as Record<string, unknown> | null) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapClientGroup(row: Record<string, unknown>): EmailClientGroup {
  const name =
    normalizeCompanyName(row.name as string) ??
    resolveCanonicalCompanyName(row.name as string) ??
    (row.name as string);
  return {
    id: row.id as string,
    name,
    source: (row.source as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapCompany(row: Record<string, unknown>): EmailCompany {
  const joined = (row as { email_client_groups?: { id: string; name: string } | null }).email_client_groups;
  const groupFromJoin = joined?.name
    ? normalizeCompanyName(joined.name) ?? resolveCanonicalCompanyName(joined.name)
    : null;
  const groupFromCustom = normalizeCompanyName(
    (row.custom_fields as Record<string, unknown> | null)?.sioe_grupo_cliente as string | null
  );
  const name = resolveCanonicalCompanyName(row.name as string) ?? normalizeCompanyName(row.name as string) ?? (row.name as string);
  return {
    id: row.id as string,
    name,
    city: normalizeCompanyName(row.city as string | null),
    state: normalizeCompanyName(row.state as string | null),
    country: normalizeCompanyName(row.country as string | null),
    website: normalizeCompanyName(row.website as string | null),
    linkedin: normalizeCompanyName(row.linkedin as string | null),
    cnpj: normalizeCompanyName(row.cnpj as string | null),
    source: (row.source as string | null) ?? null,
    clientGroupId: (row.client_group_id as string | null) ?? joined?.id ?? null,
    clientGroupName: groupFromJoin ?? groupFromCustom,
    legalAreas: normalizeLegalAreas((row.legal_areas as string[] | null) ?? []),
    responsibleUserIds: (row.responsible_user_ids as string[] | null) ?? [],
    customFields: (row.custom_fields as Record<string, unknown> | null) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapContact(row: Record<string, unknown>): EmailContact {
  const joined = (row as { email_companies?: { id: string; name: string } | null }).email_companies;
  const joinedGroup = (row as { email_client_groups?: { id: string; name: string } | null }).email_client_groups;
  const companyFromJoin = joined?.name ? resolveCanonicalCompanyName(joined.name) ?? normalizeCompanyName(joined.name) : null;
  const companyFromField = resolveCanonicalCompanyName(row.company as string | null) ?? normalizeCompanyName(row.company as string | null);
  const groupFromJoin = joinedGroup?.name
    ? normalizeCompanyName(joinedGroup.name) ?? resolveCanonicalCompanyName(joinedGroup.name)
    : null;
  const groupFromCustom = normalizeCompanyName(
    (row.custom_fields as Record<string, unknown> | null)?.sioe_grupo_cliente as string | null
  );
  return {
    id: row.id as string,
    email: row.email as string,
    name: formatPersonDisplayName(row.name as string | null),
    phone: (row.phone as string | null) ?? null,
    company: companyFromField,
    companyId: (row.company_id as string | null) ?? joined?.id ?? null,
    companyName: companyFromJoin ?? companyFromField,
    clientGroupId: (row.client_group_id as string | null) ?? joinedGroup?.id ?? null,
    clientGroupName: groupFromJoin ?? groupFromCustom,
    cargo: normalizePersonName(row.cargo as string | null),
    npsEligible: Boolean(row.nps_eligible),
    partyInvite: Boolean(row.party_invite),
    enrichedByUserId: (row.enriched_by_user_id as string | null) ?? null,
    invitesClassifiedByUserId: (row.invites_classified_by_user_id as string | null) ?? null,
    tags: normalizeTags(row.tags as string[] | null),
    status: row.status as EmailContactStatus,
    source: (row.source as string | null) ?? null,
    customFields: normalizeCustomFields(row.custom_fields as Record<string, unknown> | null),
    rdUuid: (row.rd_uuid as string | null) ?? null,
    rdSyncedAt: (row.rd_synced_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    unsubscribedAt: (row.unsubscribed_at as string | null) ?? null,
  };
}

function mapList(row: Record<string, unknown>): EmailList {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapCampaign(row: Record<string, unknown>): EmailCampaign {
  return {
    id: row.id as string,
    name: row.name as string,
    subject: row.subject as string,
    previewText: (row.preview_text as string | null) ?? null,
    fromName: row.from_name as string,
    fromEmail: row.from_email as string,
    replyTo: (row.reply_to as string | null) ?? null,
    htmlBody: (row.html_body as string) ?? "",
    listId: (row.list_id as string | null) ?? null,
    status: row.status as EmailCampaignStatus,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    totalRecipients: (row.total_recipients as number) ?? 0,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRecipient(row: Record<string, unknown>): EmailCampaignRecipient {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    contactId: row.contact_id as string,
    status: row.status as EmailRecipientStatus,
    openCount: (row.open_count as number) ?? 0,
    clickCount: (row.click_count as number) ?? 0,
    firstOpenedAt: (row.first_opened_at as string | null) ?? null,
    lastOpenedAt: (row.last_opened_at as string | null) ?? null,
    firstClickedAt: (row.first_clicked_at as string | null) ?? null,
    bouncedAt: (row.bounced_at as string | null) ?? null,
    bounceType: (row.bounce_type as string | null) ?? null,
    complainedAt: (row.complained_at as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    failedReason: (row.failed_reason as string | null) ?? null,
  };
}

// --- Contatos ---

export async function fetchEmailContacts(): Promise<EmailContact[]> {
  const db = await getEmailDb();
  const { data, error } = await db
    .from("email_contacts")
    .select("*, email_companies(id, name), email_client_groups(id, name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContact);
}

export async function fetchEmailPeople(): Promise<EmailPerson[]> {
  const db = await getEmailDb();
  const { data, error } = await db
    .from("email_people")
    .select("*, email_client_groups(id, name)")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPerson);
}

export function mapGroupResponsible(row: Record<string, unknown>): EmailGroupResponsible {
  return {
    id: row.id as string,
    clientGroupId: (row.client_group_id as string | null) ?? null,
    companyId: (row.company_id as string | null) ?? null,
    personId: (row.person_id as string | null) ?? null,
    area: normalizeLegalArea(row.area as string | null),
    advogadoResponsavelName: formatPersonDisplayName(row.advogado_responsavel_name as string | null),
    responsibleUserId: (row.responsible_user_id as string | null) ?? null,
    openProcessesCount: (row.open_processes_count as number) ?? 0,
  };
}

export async function fetchEmailGroupResponsibles(): Promise<EmailGroupResponsible[]> {
  const db = await getEmailDb();
  const { data, error } = await db
    .from("email_group_responsibles")
    .select(
      "id, client_group_id, company_id, person_id, area, advogado_responsavel_name, responsible_user_id, open_processes_count"
    );
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapGroupResponsible);
}

export interface EmailAreaManagerRow {
  area: string;
  userId: string;
  userName?: string | null;
}

/** Sócio/gerente de cada área jurídica — vê todos os clientes da área, não só onde é advogado_responsavel. */
export async function fetchEmailAreaManagers(): Promise<EmailAreaManagerRow[]> {
  const db = await getEmailDb();
  const { data, error } = await db
    .from("email_area_managers")
    .select("area, user_id, users!email_area_managers_user_id_fkey(name)")
    .order("area", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => {
      const joined = (row as { users?: { name: string } | { name: string }[] | null }).users;
      const userName = Array.isArray(joined) ? (joined[0]?.name ?? null) : (joined?.name ?? null);
      return {
        area: row.area as string,
        userId: row.user_id as string,
        userName,
      };
    })
    .filter((row) => !isSubareaOnlyManagerArea(row.area));
}

export interface UpdateEmailPersonInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  cargo?: string | null;
  area?: string | null;
  npsEligible?: boolean;
  partyInvite?: boolean;
  enrichedByUserId?: string;
  invitesClassifiedByUserId?: string;
}

/**
 * Atualiza uma pessoa (email_people). Se um e-mail válido for definido, promove/sincroniza
 * automaticamente para email_contacts para que ela entre nas campanhas de e-mail.
 */
export async function updateEmailPerson(id: string, patch: UpdateEmailPersonInput): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = formatPersonDisplayName(patch.name) ?? patch.name;
  if (patch.email !== undefined) payload.email = patch.email?.trim().toLowerCase() || null;
  if (patch.phone !== undefined) payload.phone = patch.phone?.trim() || null;
  if (patch.cargo !== undefined) payload.cargo = patch.cargo?.trim() || null;
  if (patch.area !== undefined) payload.area = patch.area?.trim() || null;
  if (patch.npsEligible !== undefined) payload.nps_eligible = patch.npsEligible;
  if (patch.partyInvite !== undefined) payload.party_invite = patch.partyInvite;
  if (patch.enrichedByUserId) payload.enriched_by_user_id = patch.enrichedByUserId;
  if (patch.invitesClassifiedByUserId) payload.invites_classified_by_user_id = patch.invitesClassifiedByUserId;

  const { data, error } = await supabase
    .from("email_people")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const person = mapPerson(data);
  if (person.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) {
    await promotePersonToContact(person);
  }
}

/** Cria/atualiza o email_contacts correspondente a uma pessoa de email_people com e-mail válido. */
async function promotePersonToContact(person: EmailPerson): Promise<void> {
  if (!person.email) return;
  const { error } = await supabase.from("email_contacts").upsert(
    {
      email: person.email,
      name: person.name,
      phone: person.phone,
      cargo: person.cargo,
      nps_eligible: person.npsEligible,
      party_invite: person.partyInvite,
      enriched_by_user_id: person.enrichedByUserId,
      invites_classified_by_user_id: person.invitesClassifiedByUserId,
      company_id: null,
      client_group_id: person.clientGroupId,
      source: person.source ?? "sioe",
      custom_fields: { sioe_pessoa_id: person.customFields?.sioe_pessoa_id ?? null },
    },
    { onConflict: "email" }
  );
  if (error) throw new Error(error.message);
}

export async function fetchEmailCompanies(): Promise<EmailCompany[]> {
  const db = await getEmailDb();
  const { data, error } = await db
    .from("email_companies")
    .select("*, email_contacts(count), email_client_groups(id, name)")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const company = mapCompany(row as Record<string, unknown>);
    const counts = (row as { email_contacts?: { count: number }[] }).email_contacts;
    company.contactCount = counts?.[0]?.count ?? 0;
    return company;
  });
}

export async function fetchEmailCompanyContacts(companyId: string): Promise<EmailContact[]> {
  const { data, error } = await supabase
    .from("email_contacts")
    .select("*, email_companies(id, name)")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContact);
}

export interface CreateEmailCompanyInput {
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  website?: string | null;
  linkedin?: string | null;
  cnpj?: string | null;
  source?: string | null;
}

export async function createEmailCompany(input: CreateEmailCompanyInput): Promise<EmailCompany> {
  const name = resolveCanonicalCompanyName(input.name) ?? normalizeCompanyName(input.name);
  if (!name) throw new Error("Informe o nome da empresa.");
  const key = companyNameKey(name);
  if (!key) throw new Error("Nome de empresa inválido.");

  const { data, error } = await supabase
    .from("email_companies")
    .upsert(
      {
        name,
        name_normalized: key,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        country: input.country?.trim() || null,
        website: input.website?.trim() || null,
        linkedin: input.linkedin?.trim() || null,
        cnpj: input.cnpj?.trim() || null,
        source: input.source ?? "manual",
      },
      { onConflict: "name_normalized" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCompany(data);
}

export async function updateEmailCompany(
  id: string,
  patch: Partial<CreateEmailCompanyInput>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = resolveCanonicalCompanyName(patch.name) ?? normalizeCompanyName(patch.name);
    if (!name) throw new Error("Nome de empresa inválido.");
    payload.name = name;
    payload.name_normalized = companyNameKey(name);
  }
  if (patch.city !== undefined) payload.city = patch.city?.trim() || null;
  if (patch.state !== undefined) payload.state = patch.state?.trim() || null;
  if (patch.country !== undefined) payload.country = patch.country?.trim() || null;
  if (patch.website !== undefined) payload.website = patch.website?.trim() || null;
  if (patch.linkedin !== undefined) payload.linkedin = patch.linkedin?.trim() || null;
  if (patch.cnpj !== undefined) payload.cnpj = patch.cnpj?.trim() || null;

  const { error } = await supabase.from("email_companies").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEmailCompany(id: string): Promise<void> {
  const { error } = await supabase.from("email_companies").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function resolveCompanyId(
  companyId?: string | null,
  companyName?: string | null
): Promise<{ companyId: string | null; companyName: string | null }> {
  if (companyId) {
    const { data } = await supabase.from("email_companies").select("name").eq("id", companyId).maybeSingle();
    const resolved = data?.name ? resolveCanonicalCompanyName(data.name) ?? normalizeCompanyName(data.name) : null;
    return { companyId, companyName: resolved ?? companyName ?? null };
  }
  const normalized = resolveCanonicalCompanyName(companyName) ?? normalizeCompanyName(companyName);
  if (!normalized) return { companyId: null, companyName: null };
  const created = await createEmailCompany({ name: normalized });
  return { companyId: created.id, companyName: created.name };
}

export interface CreateEmailContactInput {
  email: string;
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  companyId?: string | null;
  clientGroupId?: string | null;
  tags?: string[];
  source?: string | null;
  cargo?: string | null;
  npsEligible?: boolean;
  partyInvite?: boolean;
  enrichedByUserId?: string;
  invitesClassifiedByUserId?: string;
}

export async function createEmailContact(input: CreateEmailContactInput): Promise<EmailContact> {
  const useGroup = Boolean(input.clientGroupId);
  const { companyId, companyName } = useGroup
    ? { companyId: null, companyName: input.company?.trim() || null }
    : await resolveCompanyId(input.companyId, input.company);
  const { data, error } = await supabase
    .from("email_contacts")
    .insert({
      email: input.email.trim().toLowerCase(),
      name: formatPersonDisplayName(input.name),
      phone: input.phone?.trim() || null,
      company: companyName,
      company_id: companyId,
      client_group_id: input.clientGroupId ?? null,
      tags: normalizeTags(input.tags ?? []),
      source: input.source ?? "manual",
      cargo: input.cargo?.trim() || null,
      nps_eligible: input.npsEligible ?? false,
      party_invite: input.partyInvite ?? false,
      enriched_by_user_id: input.enrichedByUserId ?? null,
      invites_classified_by_user_id: input.invitesClassifiedByUserId ?? null,
    })
    .select("*, email_companies(id, name)")
    .single();
  if (error) throw new Error(error.message);
  return mapContact(data);
}

export async function updateEmailContact(
  id: string,
  patch: Partial<CreateEmailContactInput> & { status?: EmailContactStatus }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.email !== undefined) payload.email = patch.email.trim().toLowerCase();
  if (patch.name !== undefined) payload.name = formatPersonDisplayName(patch.name);
  if (patch.phone !== undefined) payload.phone = patch.phone?.trim() || null;
  if (patch.tags !== undefined) payload.tags = normalizeTags(patch.tags);
  if (patch.cargo !== undefined) payload.cargo = patch.cargo?.trim() || null;
  if (patch.npsEligible !== undefined) payload.nps_eligible = patch.npsEligible;
  if (patch.partyInvite !== undefined) payload.party_invite = patch.partyInvite;
  if (patch.enrichedByUserId) payload.enriched_by_user_id = patch.enrichedByUserId;
  if (patch.invitesClassifiedByUserId) payload.invites_classified_by_user_id = patch.invitesClassifiedByUserId;
  if (patch.clientGroupId !== undefined) payload.client_group_id = patch.clientGroupId;
  if (patch.company !== undefined || patch.companyId !== undefined) {
    const { companyId, companyName } = await resolveCompanyId(patch.companyId, patch.company);
    payload.company = companyName;
    payload.company_id = companyId;
  }
  if (patch.status !== undefined) {
    payload.status = patch.status;
    payload.unsubscribed_at = patch.status === "unsubscribed" ? new Date().toISOString() : null;
  }
  const { error } = await supabase.from("email_contacts").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEmailContact(id: string): Promise<void> {
  const { error } = await supabase.from("email_contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Listas ---

export async function fetchEmailLists(): Promise<EmailList[]> {
  const { data, error } = await supabase
    .from("email_lists")
    .select("*, email_list_contacts(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const list = mapList(row as Record<string, unknown>);
    const counts = (row as { email_list_contacts?: { count: number }[] }).email_list_contacts;
    list.contactCount = counts?.[0]?.count ?? 0;
    return list;
  });
}

export async function createEmailList(name: string, description?: string | null): Promise<EmailList> {
  const { data, error } = await supabase
    .from("email_lists")
    .insert({ name: name.trim(), description: description?.trim() || null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapList(data);
}

export async function deleteEmailList(id: string): Promise<void> {
  const { error } = await supabase.from("email_lists").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchListContactIds(listId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("email_list_contacts")
    .select("contact_id")
    .eq("list_id", listId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.contact_id as string);
}

export async function setListContacts(listId: string, contactIds: string[]): Promise<void> {
  const { error: delError } = await supabase
    .from("email_list_contacts")
    .delete()
    .eq("list_id", listId);
  if (delError) throw new Error(delError.message);
  if (contactIds.length === 0) return;
  const { error: insError } = await supabase
    .from("email_list_contacts")
    .insert(contactIds.map((contact_id) => ({ list_id: listId, contact_id })));
  if (insError) throw new Error(insError.message);
}

// --- E-mails RD Station (importados) ---

function mapRdEmail(row: Record<string, unknown>): EmailRdEmail {
  const raw = (row.raw_data as Record<string, unknown> | null) ?? {};
  return {
    id: row.id as string,
    rdEmailId: row.rd_email_id as number,
    rdCampaignId: (row.rd_campaign_id as number | null) ?? null,
    name: row.name as string,
    subject:
      (row.subject as string | null) ??
      (typeof raw.subject === "string" ? raw.subject : null),
    status: (row.status as string | null) ?? null,
    sendAt: (row.send_at as string | null) ?? null,
    leadsCount: (row.leads_count as number) ?? 0,
    htmlBody:
      (row.html_body as string | null) ??
      (typeof raw.html_body === "string" ? raw.html_body : null),
    analytics: (row.analytics as Record<string, unknown> | null) ?? {},
    syncedAt: row.synced_at as string,
  };
}

export async function fetchEmailRdEmails(): Promise<EmailRdEmail[]> {
  const { data, error } = await supabase
    .from("email_rd_emails")
    .select("*")
    .order("send_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRdEmail(row as Record<string, unknown>));
}

// --- Campanhas ---

export async function fetchEmailCampaigns(): Promise<EmailCampaign[]> {
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("*, email_lists(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const campaign = mapCampaign(row as Record<string, unknown>);
    campaign.listName = (row as { email_lists?: { name: string } | null }).email_lists?.name ?? null;
    return campaign;
  });
}

export async function fetchEmailCampaignStats(campaignId: string): Promise<EmailCampaignStats> {
  const { data, error } = await supabase
    .from("email_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);
  const stats: EmailCampaignStats = {
    total: data?.length ?? 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    failed: 0,
  };
  for (const row of data ?? []) {
    const status = row.status as EmailRecipientStatus;
    if (status === "sent") stats.sent++;
    if (status === "delivered") stats.delivered++;
    if (status === "opened") stats.opened++;
    if (status === "clicked") stats.clicked++;
    if (status === "bounced") stats.bounced++;
    if (status === "complained") stats.complained++;
    if (status === "failed") stats.failed++;
  }
  // aberto/clicado contam também os que avançaram de estágio
  return stats;
}

export async function fetchEmailCampaignRecipients(
  campaignId: string
): Promise<EmailCampaignRecipient[]> {
  const { data, error } = await supabase
    .from("email_campaign_recipients")
    .select("*, email_contacts(email, name)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const recipient = mapRecipient(row as Record<string, unknown>);
    const contact = (row as { email_contacts?: { email: string; name: string | null } | null })
      .email_contacts;
    recipient.contactEmail = contact?.email;
    recipient.contactName = contact?.name ?? null;
    return recipient;
  });
}

export interface CreateEmailCampaignInput {
  name: string;
  subject: string;
  previewText?: string | null;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  htmlBody: string;
  listId?: string | null;
}

/** `email_campaigns.created_by` referencia public.users(id), não auth.users. */
async function resolveCampaignCreatedById(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  return profile?.id ?? null;
}

export async function createEmailCampaign(input: CreateEmailCampaignInput): Promise<EmailCampaign> {
  const createdBy = await resolveCampaignCreatedById();
  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      name: input.name.trim(),
      subject: input.subject.trim(),
      preview_text: input.previewText?.trim() || null,
      from_name: input.fromName.trim(),
      from_email: input.fromEmail.trim(),
      reply_to: input.replyTo?.trim() || null,
      html_body: input.htmlBody,
      list_id: input.listId || null,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCampaign(data);
}

export async function updateEmailCampaign(
  id: string,
  patch: Partial<CreateEmailCampaignInput>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.subject !== undefined) payload.subject = patch.subject.trim();
  if (patch.previewText !== undefined) payload.preview_text = patch.previewText?.trim() || null;
  if (patch.fromName !== undefined) payload.from_name = patch.fromName.trim();
  if (patch.fromEmail !== undefined) payload.from_email = patch.fromEmail.trim();
  if (patch.replyTo !== undefined) payload.reply_to = patch.replyTo?.trim() || null;
  if (patch.htmlBody !== undefined) payload.html_body = patch.htmlBody;
  if (patch.listId !== undefined) payload.list_id = patch.listId || null;
  const { error } = await supabase.from("email_campaigns").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEmailCampaign(id: string): Promise<void> {
  const { error } = await supabase.from("email_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Volta uma campanha agendada para rascunho (não afeta campanhas já em envio/enviadas). */
export async function cancelScheduledCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from("email_campaigns")
    .update({ status: "draft", scheduled_at: null })
    .eq("id", id)
    .eq("status", "scheduled");
  if (error) throw new Error(error.message);
}

export const EMAIL_CAMPAIGN_STATUS_LABEL: Record<EmailCampaignStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sending: "Enviando",
  sent: "Enviada",
  paused: "Pausada",
  failed: "Falhou",
};

export const EMAIL_CONTACT_STATUS_LABEL: Record<EmailContactStatus, string> = {
  subscribed: "Inscrito",
  unsubscribed: "Descadastrado",
  bounced: "E-mail inválido",
  complained: "Marcou como spam",
};
