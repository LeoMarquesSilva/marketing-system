/**
 * NPS — operações server-side via service role.
 * Páginas/APIs públicas NÃO usam RLS anon; tudo passa por aqui.
 */

import { createHash, createHmac } from "node:crypto";
import { createClient as createPublicClient } from "@/utils/supabase/server";
import { getAdminClient } from "@/lib/email-marketing-server";
import { canAccessPath, type AccessProfile } from "@/lib/access-control";
import {
  mapCompany,
  mapContact,
  mapGroupResponsible,
  mapPerson,
  type EmailAreaManagerRow,
  type EmailCompany,
  type EmailGroupResponsible,
  type EmailPerson,
} from "@/lib/email-marketing";
import {
  computeMyClientScope,
  filterInternalContacts,
  filterInternalResponsibles,
  filterOutInternalClientGroups,
} from "@/lib/meus-clientes";
import { buildEligibleRespondents, type NpsEligibleRespondent } from "@/lib/nps/eligible";
import { buildNpsWhatsAppMessage } from "@/lib/nps/message";
import { getNpsPublicUrl } from "@/lib/nps/public-url";
import {
  NPS_QUESTIONS,
  validateNpsResponsePayload,
} from "@/lib/nps/questions";
import {
  computeDimensionAverages,
  computeNpsSummary,
  type NpsDimensionAverages,
  type NpsScoreSummary,
} from "@/lib/nps/scoring";
import { generateNpsToken, isValidNpsToken } from "@/lib/nps/token";
import {
  mapNpsCampaign,
  mapNpsResponse,
  mapNpsSurveyLink,
  type NpsCampaign,
  type NpsCampaignStatus,
  type NpsResponseRow,
  type NpsSentInfo,
  type NpsSurveyLink,
} from "@/lib/nps/types";

const RATE_LIMIT_PER_MINUTE = 20;

export class NpsHttpError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "NPS_ERROR") {
    super(message);
    this.name = "NpsHttpError";
    this.status = status;
    this.code = code;
  }
}

async function resolveProfile(authUserId: string): Promise<AccessProfile & { id: string }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, role, permissions")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário sem cadastro no sistema.");
  return data as AccessProfile & { id: string };
}

async function requireMeusClientesAccess(authUserId: string) {
  const publicClient = await createPublicClient();
  const {
    data: { user },
  } = await publicClient.auth.getUser();
  if (!user || user.id !== authUserId) {
    throw new NpsHttpError("Não autenticado.", 401, "UNAUTHORIZED");
  }
  const profile = await resolveProfile(authUserId);
  if (!canAccessPath(profile, "/meus-clientes")) {
    throw new NpsHttpError("Sem permissão para Meus Clientes.", 403, "FORBIDDEN");
  }
  return profile;
}

function mapAreaManagers(rows: Record<string, unknown>[] | null): EmailAreaManagerRow[] {
  return (rows ?? []).flatMap((row) => {
    const joined = (
      row as {
        users?: { name: string; is_active: boolean | null } | { name: string; is_active: boolean | null }[] | null;
      }
    ).users;
    const user = Array.isArray(joined) ? joined[0] : joined;
    if (!user || user.is_active === false) return [];
    return [{
      area: row.area as string,
      userId: row.user_id as string,
      userName: user.name ?? null,
    }];
  });
}

async function loadScopeDataset() {
  const admin = getAdminClient();
  const [
    { data: companyRows },
    { data: peopleRows },
    { data: contactRows },
    { data: responsibleRows },
    { data: managerRows },
  ] = await Promise.all([
    admin.from("email_companies").select("*, email_client_groups(id, name, responsible_area)"),
    admin.from("email_people").select("*, email_client_groups(id, name, responsible_area)"),
    admin.from("email_contacts").select("*, email_companies(id, name), email_client_groups(id, name, responsible_area)"),
    admin
      .from("email_group_responsibles")
      .select(
        "id, client_group_id, company_id, person_id, area, advogado_responsavel_name, responsible_user_id, open_processes_count"
      ),
    admin
      .from("email_area_managers")
      .select("area, user_id, users!email_area_managers_user_id_fkey(name, is_active)"),
  ]);

  const companies = filterOutInternalClientGroups(
    (companyRows ?? []).map((row) => mapCompany(row as Record<string, unknown>))
  );
  const people = filterOutInternalClientGroups(
    (peopleRows ?? []).map((row) => mapPerson(row as Record<string, unknown>))
  );
  const contacts = filterInternalContacts(
    (contactRows ?? []).map((row) => mapContact(row as Record<string, unknown>)),
    companies
  );
  const responsibles = filterInternalResponsibles(
    (responsibleRows ?? []).map((row) => mapGroupResponsible(row as Record<string, unknown>)),
    companies,
    people
  );
  const areaManagers = mapAreaManagers(managerRows as Record<string, unknown>[] | null);

  return { companies, people, contacts, responsibles, areaManagers };
}

function scopedGroupIdsForUser(
  companies: EmailCompany[],
  people: EmailPerson[],
  responsibles: EmailGroupResponsible[],
  areaManagers: EmailAreaManagerRow[],
  userId: string
): Set<string> {
  const scope = computeMyClientScope(companies, responsibles, userId, areaManagers, people);
  const scopedCompanies = companies.filter((c) => scope.companyIds.has(c.id));
  const scopedPeople = people.filter((p) => scope.personIds.has(p.id));
  return new Set([
    ...(scopedCompanies.map((c) => c.clientGroupId).filter(Boolean) as string[]),
    ...(scopedPeople.map((p) => p.clientGroupId).filter(Boolean) as string[]),
  ]);
}

async function assertGroupInScope(
  profile: AccessProfile & { id: string },
  clientGroupId: string
): Promise<void> {
  const isAdmin = (profile.role ?? "").toLowerCase() === "admin";
  if (isAdmin) return;

  const { companies, people, responsibles, areaManagers } = await loadScopeDataset();
  const ids = scopedGroupIdsForUser(companies, people, responsibles, areaManagers, profile.id);
  if (!ids.has(clientGroupId)) {
    throw new NpsHttpError("Grupo fora do seu escopo.", 403, "FORBIDDEN");
  }
}

function getClientIp(request: Request | null | undefined): string | null {
  if (!request) return null;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret =
    process.env.NPS_IP_HASH_SECRET ||
    process.env.NFC_IP_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "nps-fallback";
  return createHmac("sha256", secret).update(ip).digest("hex");
}

function rateLimitKey(token: string, ipHash: string | null): string {
  return createHash("sha256").update(`${token}:${ipHash ?? "anon"}`).digest("hex").slice(0, 32);
}

/** Rate limit in-memory simples (por processo). Suficiente para Vercel serverless com cold starts. */
const rateBucket = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(token: string, ipHash: string | null): boolean {
  const key = rateLimitKey(token, ipHash);
  const now = Date.now();
  const entry = rateBucket.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBucket.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

// ─── Campanhas ───────────────────────────────────────────────────────────────

export async function listNpsCampaigns(authUserId: string): Promise<NpsCampaign[]> {
  await requireMeusClientesAccess(authUserId);
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("nps_campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapNpsCampaign(row as Record<string, unknown>));
}

export async function getActiveNpsCampaign(): Promise<NpsCampaign | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("nps_campaigns")
    .select("*")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapNpsCampaign(data as Record<string, unknown>) : null;
}

export async function createNpsCampaign(options: {
  authUserId: string;
  name: string;
  startsAt?: string | null;
  endsAt?: string | null;
  activate?: boolean;
}): Promise<NpsCampaign> {
  const profile = await requireMeusClientesAccess(options.authUserId);
  if ((profile.role ?? "").toLowerCase() !== "admin") {
    throw new NpsHttpError("Apenas administradores podem criar campanhas.", 403, "FORBIDDEN");
  }

  const name = options.name.trim();
  if (!name) throw new NpsHttpError("Informe o nome da campanha.", 400, "INVALID_NAME");

  const admin = getAdminClient();
  const status: NpsCampaignStatus = options.activate ? "active" : "draft";

  if (status === "active") {
    await admin.from("nps_campaigns").update({ status: "closed" }).eq("status", "active");
  }

  const { data, error } = await admin
    .from("nps_campaigns")
    .insert({
      name,
      status,
      starts_at: options.startsAt ?? null,
      ends_at: options.endsAt ?? null,
      created_by_user_id: profile.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapNpsCampaign(data as Record<string, unknown>);
}

export async function updateNpsCampaign(options: {
  authUserId: string;
  campaignId: string;
  patch: {
    name?: string;
    status?: NpsCampaignStatus;
    startsAt?: string | null;
    endsAt?: string | null;
  };
}): Promise<NpsCampaign> {
  const profile = await requireMeusClientesAccess(options.authUserId);
  if ((profile.role ?? "").toLowerCase() !== "admin") {
    throw new NpsHttpError("Apenas administradores podem editar campanhas.", 403, "FORBIDDEN");
  }

  const admin = getAdminClient();
  const update: Record<string, unknown> = {};
  if (options.patch.name !== undefined) {
    const name = options.patch.name.trim();
    if (!name) throw new NpsHttpError("Informe o nome da campanha.", 400, "INVALID_NAME");
    update.name = name;
  }
  if (options.patch.startsAt !== undefined) update.starts_at = options.patch.startsAt;
  if (options.patch.endsAt !== undefined) update.ends_at = options.patch.endsAt;
  if (options.patch.status !== undefined) {
    if (!["draft", "active", "closed"].includes(options.patch.status)) {
      throw new NpsHttpError("Status inválido.", 400, "INVALID_STATUS");
    }
    if (options.patch.status === "active") {
      await admin
        .from("nps_campaigns")
        .update({ status: "closed" })
        .eq("status", "active")
        .neq("id", options.campaignId);
    }
    update.status = options.patch.status;
  }

  if (Object.keys(update).length === 0) {
    throw new NpsHttpError("Nenhuma alteração informada.", 400, "EMPTY_PATCH");
  }

  const { data, error } = await admin
    .from("nps_campaigns")
    .update(update)
    .eq("id", options.campaignId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapNpsCampaign(data as Record<string, unknown>);
}

async function resolveSentInfo(
  sentAt: string | null,
  sentByUserId: string | null
): Promise<NpsSentInfo | null> {
  if (!sentAt || !sentByUserId) return null;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, name, avatar_url")
    .eq("id", sentByUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    sentAt,
    sentBy: {
      id: sentByUserId,
      name: (data?.name as string | null)?.trim() || "Usuário",
      avatarUrl: (data?.avatar_url as string | null) ?? null,
    },
  };
}

/** Mapa groupId → envio da campanha ativa (para badges na lista). */
export async function fetchActiveCampaignNpsSentMap(
  groupIds: string[]
): Promise<Record<string, { sentAt: string; sentByName: string }>> {
  if (groupIds.length === 0) return {};

  const campaign = await getActiveNpsCampaign();
  if (!campaign) return {};

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("nps_survey_links")
    .select("client_group_id, sent_at, sent_by_user_id")
    .eq("campaign_id", campaign.id)
    .in("client_group_id", groupIds)
    .not("sent_at", "is", null);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const userIds = Array.from(
    new Set(
      rows
        .map((r) => r.sent_by_user_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  );
  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await admin
      .from("users")
      .select("id, name")
      .in("id", userIds);
    if (usersError) throw new Error(usersError.message);
    for (const u of users ?? []) {
      nameById.set(u.id as string, ((u.name as string | null)?.trim() || "Usuário") as string);
    }
  }

  const map: Record<string, { sentAt: string; sentByName: string }> = {};
  for (const row of rows) {
    const groupId = row.client_group_id as string;
    const sentAt = row.sent_at as string;
    const sentByUserId = row.sent_by_user_id as string | null;
    map[groupId] = {
      sentAt,
      sentByName: sentByUserId ? (nameById.get(sentByUserId) ?? "Usuário") : "Usuário",
    };
  }
  return map;
}

export async function markNpsSurveyLinkSent(options: {
  authUserId: string;
  clientGroupId: string;
  campaignId?: string | null;
}): Promise<{ sent: NpsSentInfo; alreadySent: boolean }> {
  const profile = await requireMeusClientesAccess(options.authUserId);
  await assertGroupInScope(profile, options.clientGroupId);

  // Garante que o link exista (cria se necessário).
  const bundle = await getOrCreateSurveyLink({
    authUserId: options.authUserId,
    clientGroupId: options.clientGroupId,
    campaignId: options.campaignId ?? null,
  });

  if (bundle.sent) {
    return { sent: bundle.sent, alreadySent: true };
  }

  const admin = getAdminClient();
  const now = new Date().toISOString();

  // Só marca se ainda null (primeiro clique trava).
  const { data, error } = await admin
    .from("nps_survey_links")
    .update({
      sent_at: now,
      sent_by_user_id: profile.id,
    })
    .eq("id", bundle.link.id)
    .is("sent_at", null)
    .select("sent_at, sent_by_user_id")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    // Race: outro request marcou entre o read e o update.
    const { data: current, error: currentError } = await admin
      .from("nps_survey_links")
      .select("sent_at, sent_by_user_id")
      .eq("id", bundle.link.id)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    const sent = await resolveSentInfo(
      (current?.sent_at as string | null) ?? null,
      (current?.sent_by_user_id as string | null) ?? null
    );
    if (!sent) {
      throw new NpsHttpError("Não foi possível marcar o envio.", 500, "MARK_SENT_FAILED");
    }
    return { sent, alreadySent: true };
  }

  const sent = await resolveSentInfo(
    data.sent_at as string,
    (data.sent_by_user_id as string | null) ?? profile.id
  );
  if (!sent) {
    throw new NpsHttpError("Não foi possível marcar o envio.", 500, "MARK_SENT_FAILED");
  }
  return { sent, alreadySent: false };
}

// ─── Links ───────────────────────────────────────────────────────────────────

export interface NpsLinkBundle {
  link: NpsSurveyLink;
  campaign: NpsCampaign;
  groupName: string;
  surveyUrl: string;
  whatsappMessage: string;
  eligibleCount: number;
  respondents: Array<{ name: string; submittedAt: string }>;
  sent: NpsSentInfo | null;
}

export async function getOrCreateSurveyLink(options: {
  authUserId: string;
  clientGroupId: string;
  campaignId?: string | null;
}): Promise<NpsLinkBundle> {
  const profile = await requireMeusClientesAccess(options.authUserId);
  await assertGroupInScope(profile, options.clientGroupId);

  const admin = getAdminClient();

  let campaign: NpsCampaign | null = null;
  if (options.campaignId) {
    const { data, error } = await admin
      .from("nps_campaigns")
      .select("*")
      .eq("id", options.campaignId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NpsHttpError("Campanha não encontrada.", 404, "CAMPAIGN_NOT_FOUND");
    campaign = mapNpsCampaign(data as Record<string, unknown>);
  } else {
    campaign = await getActiveNpsCampaign();
    if (!campaign) {
      throw new NpsHttpError(
        "Não há campanha NPS ativa. Peça ao administrador para criar/ativar uma.",
        400,
        "NO_ACTIVE_CAMPAIGN"
      );
    }
  }

  if (campaign.status === "closed") {
    throw new NpsHttpError("Esta campanha está encerrada.", 400, "CAMPAIGN_CLOSED");
  }

  const { data: groupRow, error: groupError } = await admin
    .from("email_client_groups")
    .select("id, name")
    .eq("id", options.clientGroupId)
    .maybeSingle();
  if (groupError) throw new Error(groupError.message);
  if (!groupRow) throw new NpsHttpError("Grupo não encontrado.", 404, "GROUP_NOT_FOUND");

  const { data: existing } = await admin
    .from("nps_survey_links")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("client_group_id", options.clientGroupId)
    .maybeSingle();

  let link: NpsSurveyLink;
  if (existing) {
    link = mapNpsSurveyLink(existing as Record<string, unknown>);
    if (link.revokedAt) {
      const { data: restored, error: restoreError } = await admin
        .from("nps_survey_links")
        .update({ revoked_at: null })
        .eq("id", link.id)
        .select("*")
        .single();
      if (restoreError) throw new Error(restoreError.message);
      link = mapNpsSurveyLink(restored as Record<string, unknown>);
    }
  } else {
    let created: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
      const { data, error } = await admin
        .from("nps_survey_links")
        .insert({
          campaign_id: campaign.id,
          client_group_id: options.clientGroupId,
          token: generateNpsToken(),
          created_by_user_id: profile.id,
        })
        .select("*")
        .single();
      if (!error) {
        created = data as Record<string, unknown>;
      } else if (error.code !== "23505") {
        throw new Error(error.message);
      }
    }
    if (!created) throw new NpsHttpError("Não foi possível gerar o link.", 500, "TOKEN_COLLISION");
    link = mapNpsSurveyLink(created);
  }

  const [eligible, responses] = await Promise.all([
    loadEligibleForGroup(options.clientGroupId),
    admin
      .from("nps_responses")
      .select("respondent_name, submitted_at")
      .eq("campaign_id", campaign.id)
      .eq("client_group_id", options.clientGroupId)
      .order("submitted_at", { ascending: false }),
  ]);

  const surveyUrl = getNpsPublicUrl(link.token);
  const groupName = groupRow.name as string;
  const sent = await resolveSentInfo(link.sentAt, link.sentByUserId);

  return {
    link,
    campaign,
    groupName,
    surveyUrl,
    whatsappMessage: buildNpsWhatsAppMessage({
      groupName,
      surveyUrl,
      campaignName: campaign.name,
    }),
    eligibleCount: eligible.length,
    respondents: (responses.data ?? []).map((r) => ({
      name: r.respondent_name as string,
      submittedAt: r.submitted_at as string,
    })),
    sent,
  };
}

async function loadEligibleForGroup(clientGroupId: string): Promise<NpsEligibleRespondent[]> {
  const admin = getAdminClient();
  const [{ data: contactRows }, { data: peopleRows }] = await Promise.all([
    admin
      .from("email_contacts")
      .select("id, name, email, cargo, nps_eligible, client_group_id")
      .eq("client_group_id", clientGroupId)
      .eq("nps_eligible", true),
    admin
      .from("email_people")
      .select("id, name, email, cargo, nps_eligible, client_group_id")
      .eq("client_group_id", clientGroupId)
      .eq("nps_eligible", true),
  ]);

  const contacts = (contactRows ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? null,
    email: row.email as string,
    cargo: (row.cargo as string | null) ?? null,
    npsEligible: Boolean(row.nps_eligible),
    clientGroupId: (row.client_group_id as string | null) ?? null,
  }));
  const people = (peopleRows ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string | null) ?? null,
    cargo: (row.cargo as string | null) ?? null,
    npsEligible: Boolean(row.nps_eligible),
    clientGroupId: (row.client_group_id as string | null) ?? null,
  }));

  return buildEligibleRespondents(contacts, people, clientGroupId);
}

// ─── Público ─────────────────────────────────────────────────────────────────

export type PublicSurveyState =
  | {
      state: "ready";
      campaign: { id: string; name: string };
      group: { id: string; name: string };
      respondents: NpsEligibleRespondent[];
      questions: typeof NPS_QUESTIONS;
    }
  | { state: "not_found"; message: string }
  | { state: "revoked"; message: string }
  | { state: "closed"; message: string }
  | {
      state: "no_respondents";
      message: string;
      campaign: { id: string; name: string };
      group: { id: string; name: string };
    }
  | {
      state: "all_responded";
      message: string;
      campaign: { id: string; name: string };
      group: { id: string; name: string };
      respondedCount: number;
    }
  | { state: "rate_limited"; message: string };

export async function resolvePublicSurvey(
  token: string,
  request?: Request
): Promise<PublicSurveyState> {
  if (!isValidNpsToken(token)) {
    return { state: "not_found", message: "Pesquisa não encontrada." };
  }

  const ipHash = hashIp(getClientIp(request ?? null));
  if (checkRateLimit(token, ipHash)) {
    return { state: "rate_limited", message: "Muitas tentativas. Aguarde um minuto e tente novamente." };
  }

  const admin = getAdminClient();
  const { data: linkRow, error } = await admin
    .from("nps_survey_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!linkRow) return { state: "not_found", message: "Pesquisa não encontrada." };

  const link = mapNpsSurveyLink(linkRow as Record<string, unknown>);
  if (link.revokedAt) {
    return { state: "revoked", message: "Este link foi desativado." };
  }

  const [{ data: campaignRow }, { data: groupRow }] = await Promise.all([
    admin.from("nps_campaigns").select("*").eq("id", link.campaignId).maybeSingle(),
    admin.from("email_client_groups").select("id, name").eq("id", link.clientGroupId).maybeSingle(),
  ]);

  if (!campaignRow || !groupRow) {
    return { state: "not_found", message: "Pesquisa não encontrada." };
  }

  const campaign = mapNpsCampaign(campaignRow as Record<string, unknown>);
  if (campaign.status === "closed" || campaign.status === "draft") {
    return { state: "closed", message: "Esta pesquisa não está disponível no momento." };
  }

  // Contabiliza abertura (best-effort).
  void admin
    .from("nps_survey_links")
    .update({
      opens_count: link.opensCount + 1,
      first_opened_at: link.firstOpenedAt ?? new Date().toISOString(),
      last_opened_at: new Date().toISOString(),
    })
    .eq("id", link.id);

  const [respondents, existingResponses] = await Promise.all([
    loadEligibleForGroup(link.clientGroupId),
    admin
      .from("nps_responses")
      .select("contact_id, person_id, submitted_at")
      .eq("campaign_id", campaign.id)
      .eq("client_group_id", link.clientGroupId),
  ]);

  const group = { id: groupRow.id as string, name: groupRow.name as string };
  const campaignBrief = { id: campaign.id, name: campaign.name };

  if (respondents.length === 0) {
    return {
      state: "no_respondents",
      message: "Não há contatos elegíveis para responder esta pesquisa.",
      campaign: campaignBrief,
      group,
    };
  }

  if (existingResponses.error) throw new Error(existingResponses.error.message);

  const respondedAtByContact = new Map<string, string>();
  const respondedAtByPerson = new Map<string, string>();
  for (const row of existingResponses.data ?? []) {
    const submittedAt = row.submitted_at as string;
    if (row.contact_id) respondedAtByContact.set(row.contact_id as string, submittedAt);
    if (row.person_id) respondedAtByPerson.set(row.person_id as string, submittedAt);
  }

  const annotatedRespondents: NpsEligibleRespondent[] = respondents.map((r) => {
    const respondedAt =
      r.kind === "contact"
        ? (respondedAtByContact.get(r.id) ?? null)
        : (respondedAtByPerson.get(r.id) ?? null);
    return {
      ...r,
      alreadyResponded: Boolean(respondedAt),
      respondedAt,
    };
  });

  const pendingCount = annotatedRespondents.filter((r) => !r.alreadyResponded).length;
  const respondedCount = annotatedRespondents.length - pendingCount;

  if (pendingCount === 0) {
    return {
      state: "all_responded",
      message:
        "Todos os contatos deste cliente já responderam esta pesquisa. Obrigado pela participação.",
      campaign: campaignBrief,
      group,
      respondedCount,
    };
  }

  return {
    state: "ready",
    campaign: campaignBrief,
    group,
    respondents: annotatedRespondents,
    questions: NPS_QUESTIONS,
  };
}

export type SubmitSurveyResult =
  | { ok: true; responseId: string }
  | { ok: false; code: string; message: string; status: number };

export async function submitSurveyResponse(
  token: string,
  rawPayload: unknown,
  request?: Request
): Promise<SubmitSurveyResult> {
  if (!isValidNpsToken(token)) {
    return { ok: false, code: "NOT_FOUND", message: "Pesquisa não encontrada.", status: 404 };
  }

  const ipHash = hashIp(getClientIp(request ?? null));
  if (checkRateLimit(`submit:${token}`, ipHash)) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Muitas tentativas. Aguarde um minuto e tente novamente.",
      status: 429,
    };
  }

  const validated = validateNpsResponsePayload(rawPayload);
  if (!validated.ok) {
    return { ok: false, code: "INVALID_PAYLOAD", message: validated.error, status: 400 };
  }
  const payload = validated.data;

  const admin = getAdminClient();
  const { data: linkRow } = await admin
    .from("nps_survey_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!linkRow) {
    return { ok: false, code: "NOT_FOUND", message: "Pesquisa não encontrada.", status: 404 };
  }

  const link = mapNpsSurveyLink(linkRow as Record<string, unknown>);
  if (link.revokedAt) {
    return { ok: false, code: "REVOKED", message: "Este link foi desativado.", status: 410 };
  }

  const { data: campaignRow } = await admin
    .from("nps_campaigns")
    .select("*")
    .eq("id", link.campaignId)
    .maybeSingle();
  if (!campaignRow) {
    return { ok: false, code: "NOT_FOUND", message: "Pesquisa não encontrada.", status: 404 };
  }
  const campaign = mapNpsCampaign(campaignRow as Record<string, unknown>);
  if (campaign.status !== "active") {
    return {
      ok: false,
      code: "CLOSED",
      message: "Esta pesquisa não está disponível no momento.",
      status: 410,
    };
  }

  const eligible = await loadEligibleForGroup(link.clientGroupId);
  const respondent = eligible.find(
    (r) => r.kind === payload.respondentKind && r.id === payload.respondentId
  );
  if (!respondent) {
    return {
      ok: false,
      code: "INVALID_RESPONDENT",
      message: "Contato não elegível para esta pesquisa.",
      status: 400,
    };
  }

  // Snapshot de e-mail (não exposto publicamente).
  let respondentEmail: string | null = null;
  if (payload.respondentKind === "contact") {
    const { data } = await admin
      .from("email_contacts")
      .select("email")
      .eq("id", payload.respondentId)
      .maybeSingle();
    respondentEmail = (data?.email as string | null) ?? null;
  } else {
    const { data } = await admin
      .from("email_people")
      .select("email")
      .eq("id", payload.respondentId)
      .maybeSingle();
    respondentEmail = (data?.email as string | null) ?? null;
  }

  const userAgent = request?.headers.get("user-agent")?.slice(0, 500) ?? null;

  const insertRow = {
    campaign_id: campaign.id,
    link_id: link.id,
    client_group_id: link.clientGroupId,
    respondent_kind: payload.respondentKind,
    contact_id: payload.respondentKind === "contact" ? payload.respondentId : null,
    person_id: payload.respondentKind === "person" ? payload.respondentId : null,
    respondent_name: respondent.name,
    respondent_email: respondentEmail,
    respondent_cargo: respondent.cargo,
    score_recommend: payload.score_recommend,
    reason: payload.reason,
    score_availability: payload.score_availability,
    score_communication: payload.score_communication,
    score_innovation: payload.score_innovation,
    score_technical: payload.score_technical,
    improvement: payload.improvement,
    ip_hash: ipHash,
    user_agent: userAgent,
  };

  const { data, error } = await admin.from("nps_responses").insert(insertRow).select("id").single();
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        code: "ALREADY_RESPONDED",
        message: "Você já respondeu esta pesquisa. Obrigado!",
        status: 409,
      };
    }
    throw new Error(error.message);
  }

  return { ok: true, responseId: data.id as string };
}

// ─── Resultados ──────────────────────────────────────────────────────────────

export interface NpsGroupResult {
  clientGroupId: string;
  groupName: string;
  summary: NpsScoreSummary;
  dimensions: NpsDimensionAverages;
  responseCount: number;
}

export interface NpsResultsPayload {
  campaign: NpsCampaign;
  campaigns: NpsCampaign[];
  isAdmin: boolean;
  summary: NpsScoreSummary;
  dimensions: NpsDimensionAverages;
  groups: NpsGroupResult[];
  responses: Array<
    NpsResponseRow & {
      groupName: string;
    }
  >;
}

export async function fetchNpsResults(options: {
  authUserId: string;
  campaignId?: string | null;
}): Promise<NpsResultsPayload> {
  const profile = await requireMeusClientesAccess(options.authUserId);
  const isAdmin = (profile.role ?? "").toLowerCase() === "admin";
  const admin = getAdminClient();

  const { data: campaignRows, error: campaignsError } = await admin
    .from("nps_campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (campaignsError) throw new Error(campaignsError.message);
  const campaigns = (campaignRows ?? []).map((row) => mapNpsCampaign(row as Record<string, unknown>));

  let campaign =
    (options.campaignId
      ? campaigns.find((c) => c.id === options.campaignId)
      : campaigns.find((c) => c.status === "active")) ?? null;
  if (!campaign) campaign = campaigns[0] ?? null;
  if (!campaign) {
    throw new NpsHttpError("Nenhuma campanha NPS encontrada.", 404, "NO_CAMPAIGN");
  }

  let allowedGroupIds: Set<string> | null = null;
  if (!isAdmin) {
    const { companies, people, responsibles, areaManagers } = await loadScopeDataset();
    allowedGroupIds = scopedGroupIdsForUser(
      companies,
      people,
      responsibles,
      areaManagers,
      profile.id
    );
  }

  let query = admin
    .from("nps_responses")
    .select("*")
    .eq("campaign_id", campaign.id)
    .order("submitted_at", { ascending: false });

  if (allowedGroupIds) {
    if (allowedGroupIds.size === 0) {
      return {
        campaign,
        campaigns,
        isAdmin,
        summary: computeNpsSummary([]),
        dimensions: computeDimensionAverages([]),
        groups: [],
        responses: [],
      };
    }
    query = query.in("client_group_id", Array.from(allowedGroupIds));
  }

  const { data: responseRows, error: responsesError } = await query;
  if (responsesError) throw new Error(responsesError.message);

  const responses = (responseRows ?? []).map((row) => mapNpsResponse(row as Record<string, unknown>));

  const groupIds = Array.from(new Set(responses.map((r) => r.clientGroupId)));
  const groupNameById = new Map<string, string>();
  if (groupIds.length > 0) {
    const { data: groups } = await admin
      .from("email_client_groups")
      .select("id, name")
      .in("id", groupIds);
    for (const g of groups ?? []) {
      groupNameById.set(g.id as string, g.name as string);
    }
  }

  const byGroup = new Map<string, NpsResponseRow[]>();
  for (const response of responses) {
    const list = byGroup.get(response.clientGroupId) ?? [];
    list.push(response);
    byGroup.set(response.clientGroupId, list);
  }

  const groups: NpsGroupResult[] = Array.from(byGroup.entries()).map(([clientGroupId, list]) => {
    const scoreRows = list.map((r) => ({
      score_recommend: r.scoreRecommend,
      score_availability: r.scoreAvailability,
      score_communication: r.scoreCommunication,
      score_innovation: r.scoreInnovation,
      score_technical: r.scoreTechnical,
    }));
    return {
      clientGroupId,
      groupName: groupNameById.get(clientGroupId) ?? "Grupo",
      summary: computeNpsSummary(list.map((r) => r.scoreRecommend)),
      dimensions: computeDimensionAverages(scoreRows),
      responseCount: list.length,
    };
  });
  groups.sort((a, b) => (b.summary.nps ?? -999) - (a.summary.nps ?? -999));

  const allScores = responses.map((r) => ({
    score_recommend: r.scoreRecommend,
    score_availability: r.scoreAvailability,
    score_communication: r.scoreCommunication,
    score_innovation: r.scoreInnovation,
    score_technical: r.scoreTechnical,
  }));

  return {
    campaign,
    campaigns,
    isAdmin,
    summary: computeNpsSummary(responses.map((r) => r.scoreRecommend)),
    dimensions: computeDimensionAverages(allScores),
    groups,
    responses: responses.map((r) => ({
      ...r,
      groupName: groupNameById.get(r.clientGroupId) ?? "Grupo",
    })),
  };
}

// Re-export útil para metadata
export { isValidNpsToken };
