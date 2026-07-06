/**
 * Integração RD Station Marketing (OAuth2 + Platform API).
 * Server-only.
 */

import { getAdminClient } from "@/lib/email-marketing-server";
import {
  companyNameKey,
  fixMojibake,
  formatPersonDisplayName,
  normalizeCompanyName,
  normalizePersonName,
  normalizeTags,
  resolveCanonicalCompanyName,
} from "@/lib/email-marketing-normalize";
import { resolveCargoStoredValue } from "@/lib/cargo-options";

const RD_AUTH_URL = "https://api.rd.services/auth/token";
const RD_API_BASE = "https://api.rd.services/platform";
const RD_OAUTH_SETTINGS_KEY = "rd_marketing_oauth";
const DEFAULT_SEGMENTATION_NAME = "Todos os contatos da base de Leads";

interface RdOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface RdOAuthStored {
  refresh_token: string;
  updated_at: string;
}

interface RdSegmentation {
  id: number;
  name: string;
}

interface RdContactListItem {
  uuid: string;
  email: string;
  name?: string;
}

interface RdLegalBase {
  category: string;
  type: string;
  status: string;
}

export interface RdContactDetail {
  uuid: string;
  email: string;
  name?: string;
  personal_phone?: string;
  mobile_phone?: string;
  tags?: string[];
  legal_bases?: RdLegalBase[];
  [key: string]: unknown;
}

export interface RdSyncResult {
  fetched: number;
  upserted: number;
  enriched: number;
  companiesLinked: number;
  errors: number;
  segmentationName: string;
  emailsSynced?: number;
}

interface RdEmailListItem {
  id: number;
  name: string;
  type: string;
  status?: string;
  send_at?: string;
  leads_count?: number;
  campaign_id?: number;
  created_at?: string;
  updated_at?: string;
}

interface RdAnalyticsEmail {
  email_id?: number;
  email_name?: string;
  sent_count?: number;
  delivered_count?: number;
  opened_count?: number;
  clicked_count?: number;
  bounced_count?: number;
  unsubscribed_count?: number;
  spam_reported_count?: number;
}

export interface RdContactEvent {
  event_type: string;
  event_identifier?: string;
  event_timestamp?: string;
  payload?: Record<string, unknown>;
}

function getRdOAuthConfig() {
  const clientId = process.env.RD_MARKETING_CLIENT_ID?.trim();
  const clientSecret = process.env.RD_MARKETING_CLIENT_SECRET?.trim();
  const refreshToken = process.env.RD_MARKETING_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Configure RD_MARKETING_CLIENT_ID, RD_MARKETING_CLIENT_SECRET e RD_MARKETING_REFRESH_TOKEN no .env."
    );
  }
  return { clientId, clientSecret, refreshToken };
}

export function isRdMarketingConfigured(): boolean {
  try {
    getRdOAuthConfig();
    return true;
  } catch {
    return false;
  }
}

async function loadStoredRefreshToken(): Promise<string | null> {
  const admin = getAdminClient();
  const { data } = await admin.from("app_settings").select("value").eq("key", RD_OAUTH_SETTINGS_KEY).maybeSingle();
  const value = data?.value as RdOAuthStored | null;
  return value?.refresh_token ?? null;
}

async function saveRefreshToken(refreshToken: string): Promise<void> {
  const admin = getAdminClient();
  const payload: RdOAuthStored = { refresh_token: refreshToken, updated_at: new Date().toISOString() };
  const { error } = await admin.from("app_settings").upsert({ key: RD_OAUTH_SETTINGS_KEY, value: payload }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function refreshRdAccessToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken: envRefresh } = getRdOAuthConfig();
  const storedRefresh = await loadStoredRefreshToken();
  const refreshToken = storedRefresh ?? envRefresh;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(RD_AUTH_URL, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as RdOAuthTokens & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? "Falha ao renovar token do RD Station.");
  }

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await saveRefreshToken(data.refresh_token);
  }

  return data.access_token;
}

async function rdFetch<T>(path: string, accessToken: string, retries = 3): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`${RD_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    const text = await res.text();
    let data: (T & { message?: string; error_description?: string }) | undefined;
    try {
      data = JSON.parse(text) as T & { message?: string; error_description?: string };
    } catch {
      lastError = new Error(`Resposta inválida do RD Station (${res.status}).`);
      if (res.status >= 500 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      break;
    }
    if (res.ok) return data as T;
    lastError = new Error(data.error_description ?? data.message ?? `Erro RD Station (${res.status}).`);
    if (res.status >= 500 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    break;
  }
  throw lastError ?? new Error("Erro RD Station.");
}

async function findDefaultSegmentation(accessToken: string): Promise<RdSegmentation> {
  const data = await rdFetch<{ segmentations: RdSegmentation[] }>(
    `/segmentations?page=1&page_size=50`,
    accessToken
  );
  const match =
    data.segmentations.find((s) => s.name.toLowerCase() === DEFAULT_SEGMENTATION_NAME.toLowerCase()) ??
    data.segmentations.find((s) => s.name.toLowerCase().includes("todos os contatos")) ??
    data.segmentations[0];
  if (!match) throw new Error("Nenhuma segmentação encontrada no RD Station.");
  return match;
}

async function listSegmentationContacts(
  accessToken: string,
  segmentationId: number
): Promise<RdContactListItem[]> {
  const all: RdContactListItem[] = [];
  let page = 1;
  while (true) {
    const data = await rdFetch<{ contacts: RdContactListItem[] }>(
      `/segmentations/${segmentationId}/contacts?page=${page}&page_size=100`,
      accessToken
    );
    const batch = data.contacts ?? [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

async function fetchContactDetail(accessToken: string, uuid: string): Promise<RdContactDetail> {
  return rdFetch<RdContactDetail>(`/contacts/${uuid}`, accessToken);
}

function pickCfString(contact: RdContactDetail, keys: string[]): string | null {
  for (const key of keys) {
    const value = contact[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function mapRdCommunicationsStatus(legalBases?: RdLegalBase[]): "subscribed" | "unsubscribed" | undefined {
  const comm = legalBases?.find((b) => b.category === "communications");
  if (!comm) return undefined;
  return comm.status === "granted" ? "subscribed" : "unsubscribed";
}

function extractCustomFields(contact: RdContactDetail): Record<string, unknown> {
  const result: Record<string, unknown> = {
    rd_uuid: contact.uuid,
    rd_legal_bases: contact.legal_bases ?? [],
  };
  for (const [key, value] of Object.entries(contact)) {
    if (!key.startsWith("cf_") || value == null || value === "") continue;
    result[key.replace(/^cf_/, "rd_")] = value;
  }
  return result;
}

async function upsertEmailCompanyFromRd(
  admin: ReturnType<typeof getAdminClient>,
  contact: RdContactDetail
): Promise<{ companyId: string | null; companyName: string | null }> {
  const rawCompany =
    pickCfString(contact, ["cf_grupo_empresa", "cf_empresa", "cf_razao_social", "cf_company"]) ??
    pickCfString(contact, ["company"]);
  const companyName = resolveCanonicalCompanyName(rawCompany) ?? normalizeCompanyName(rawCompany);
  if (!companyName) return { companyId: null, companyName: null };

  const key = companyNameKey(companyName);
  if (!key) return { companyId: null, companyName: null };

  const { data, error } = await admin
    .from("email_companies")
    .upsert(
      {
        name: companyName,
        name_normalized: key,
        city: normalizeCompanyName(pickCfString(contact, ["cf_cidade_empresa", "cf_cidade"])),
        state: normalizeCompanyName(pickCfString(contact, ["cf_estado_empresa", "cf_estado"])),
        cnpj: pickCfString(contact, ["cf_cnpj"]),
        website: pickCfString(contact, ["cf_website", "cf_site"]),
        linkedin: pickCfString(contact, ["cf_linkedin_empresa", "cf_linkedin"]),
        source: "rd-station",
      },
      { onConflict: "name_normalized" }
    )
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  return { companyId: data.id as string, companyName: data.name as string };
}

async function upsertContactFromRd(
  admin: ReturnType<typeof getAdminClient>,
  detail: RdContactDetail,
  existingByEmail: Map<string, Record<string, unknown>>
): Promise<{ upserted: boolean; companyLinked: boolean }> {
  const email = detail.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { upserted: false, companyLinked: false };
  }

  const existing = existingByEmail.get(email);
  const { companyId, companyName } = await upsertEmailCompanyFromRd(admin, detail);

  const rdTags = normalizeTags(detail.tags ?? []);
  const existingTags = normalizeTags((existing?.tags as string[] | undefined) ?? []);
  const mergedTags = normalizeTags([...existingTags, ...rdTags]);

  const rdCustom = extractCustomFields(detail);
  const existingCustom = (existing?.custom_fields as Record<string, unknown> | undefined) ?? {};
  const custom_fields = { ...existingCustom, ...rdCustom };

  const existingCargo = (existing?.cargo as string | null | undefined)?.trim() || null;
  const rdCargoRaw =
    (typeof rdCustom.rd_cargo_e_book === "string" ? rdCustom.rd_cargo_e_book : null) ??
    (typeof existingCustom.rd_cargo_e_book === "string" ? existingCustom.rd_cargo_e_book : null);
  const mappedCargo = existingCargo ?? resolveCargoStoredValue(rdCargoRaw);

  const rdStatus = mapRdCommunicationsStatus(detail.legal_bases);
  const phone =
    fixMojibake(detail.mobile_phone) ??
    fixMojibake(detail.personal_phone) ??
    (existing?.phone as string | null) ??
    null;

  const payload = {
    email,
    name: formatPersonDisplayName(detail.name) ?? formatPersonDisplayName(existing?.name as string | null),
    phone,
    company: companyName ?? (existing?.company as string | null) ?? null,
    company_id: companyId ?? (existing?.company_id as string | null) ?? null,
    tags: mergedTags,
    status: rdStatus ?? (existing?.status as string | undefined) ?? "subscribed",
    source: (existing?.source as string | undefined) ?? "rd-station",
    custom_fields,
    cargo: mappedCargo,
    rd_uuid: detail.uuid,
    rd_synced_at: new Date().toISOString(),
    unsubscribed_at:
      rdStatus === "unsubscribed"
        ? (existing?.unsubscribed_at as string | null) ?? new Date().toISOString()
        : rdStatus === "subscribed"
          ? null
          : (existing?.unsubscribed_at as string | null) ?? null,
  };

  const { error } = await admin.from("email_contacts").upsert(payload, { onConflict: "email" });
  if (error) throw new Error(error.message);

  return { upserted: true, companyLinked: Boolean(companyId) };
}

export async function testRdMarketingConnection(): Promise<{
  ok: boolean;
  segmentation?: string;
  contactCountSample?: number;
  message?: string;
}> {
  try {
    const token = await refreshRdAccessToken();
    const segmentation = await findDefaultSegmentation(token);
    const sample = await rdFetch<{ contacts: RdContactListItem[] }>(
      `/segmentations/${segmentation.id}/contacts?page=1&page_size=1`,
      token
    );
    return {
      ok: true,
      segmentation: segmentation.name,
      contactCountSample: sample.contacts?.length ?? 0,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Erro ao conectar no RD Station." };
  }
}

async function listRdSentEmails(accessToken: string): Promise<RdEmailListItem[]> {
  const all: RdEmailListItem[] = [];
  let page = 1;
  while (true) {
    const data = await rdFetch<{ total: number; items: RdEmailListItem[] }>(
      `/emails?page=${page}&page_size=100`,
      accessToken
    );
    const batch = (data.items ?? []).filter((item) => item.type === "email");
    all.push(...batch);
    if (batch.length === 0 || all.length >= (data.total ?? 0)) break;
    page++;
  }
  return all;
}

async function fetchRecentEmailAnalytics(accessToken: string): Promise<Map<number, RdAnalyticsEmail>> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 44);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  try {
    const data = await rdFetch<{ emails: RdAnalyticsEmail[] }>(
      `/analytics/emails?start_date=${fmt(start)}&end_date=${fmt(end)}`,
      accessToken
    );
    const map = new Map<number, RdAnalyticsEmail>();
    for (const row of data.emails ?? []) {
      if (row.email_id) map.set(row.email_id, row);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function syncRdMarketingEmails(): Promise<{ synced: number }> {
  const accessToken = await refreshRdAccessToken();
  const admin = getAdminClient();
  const emails = await listRdSentEmails(accessToken);
  const analytics = await fetchRecentEmailAnalytics(accessToken);

  let synced = 0;
  for (const email of emails) {
    const stats = analytics.get(email.id);
    const payload = {
      rd_email_id: email.id,
      rd_campaign_id: email.campaign_id ?? null,
      name: email.name,
      status: email.status ?? null,
      send_at: email.send_at ?? null,
      leads_count: email.leads_count ?? 0,
      analytics: stats ?? {},
      raw_data: email as unknown as Record<string, unknown>,
      synced_at: new Date().toISOString(),
    };
    const { error } = await admin.from("email_rd_emails").upsert(payload, { onConflict: "rd_email_id" });
    if (!error) synced++;
  }

  return { synced };
}

export async function fetchRdContactEvents(rdUuid: string): Promise<RdContactEvent[]> {
  const accessToken = await refreshRdAccessToken();
  const events: RdContactEvent[] = [];
  for (const eventType of ["CONVERSION", "OPPORTUNITY"] as const) {
    try {
      const batch = await rdFetch<RdContactEvent[]>(
        `/contacts/${rdUuid}/events?event_type=${eventType}&page=1&page_size=50`,
        accessToken
      );
      events.push(...(batch ?? []));
    } catch {
      // ignora tipo sem eventos
    }
  }
  return events.sort((a, b) => {
    const ta = a.event_timestamp ? Date.parse(a.event_timestamp) : 0;
    const tb = b.event_timestamp ? Date.parse(b.event_timestamp) : 0;
    return tb - ta;
  });
}

export async function syncRdMarketingContacts(options?: {
  maxContacts?: number;
  concurrency?: number;
  force?: boolean;
  includeEmails?: boolean;
}): Promise<RdSyncResult> {
  const maxContacts = options?.maxContacts ?? 10_000;
  const concurrency = options?.concurrency ?? 2;
  const force = options?.force ?? false;

  const accessToken = await refreshRdAccessToken();
  const segmentation = await findDefaultSegmentation(accessToken);

  const admin = getAdminClient();
  const { data: existingRows } = await admin
    .from("email_contacts")
    .select("email, name, phone, company, company_id, tags, status, custom_fields, unsubscribed_at, source, rd_synced_at");
  const existingByEmail = new Map((existingRows ?? []).map((row) => [String(row.email).toLowerCase(), row as Record<string, unknown>]));

  const listedAll = await listSegmentationContacts(accessToken, segmentation.id);
  const listed = listedAll.filter((item) => {
    if (force) return true;
    const existing = existingByEmail.get(item.email.toLowerCase());
    return !existing?.rd_synced_at;
  }).slice(0, maxContacts);

  let upserted = 0;
  let enriched = 0;
  let companiesLinked = 0;
  let errors = 0;

  for (let i = 0; i < listed.length; i += concurrency) {
    const batch = listed.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (item) => {
        try {
          await new Promise((r) => setTimeout(r, 150));
          const detail = await fetchContactDetail(accessToken, item.uuid);
          const hadExisting = existingByEmail.has(detail.email.toLowerCase());
          const result = await upsertContactFromRd(admin, detail, existingByEmail);
          if (result.upserted) upserted++;
          if (hadExisting) enriched++;
          if (result.companyLinked) companiesLinked++;
        } catch {
          errors++;
        }
      })
    );
  }

  let emailsSynced: number | undefined;
  if (options?.includeEmails !== false) {
    try {
      const emailResult = await syncRdMarketingEmails();
      emailsSynced = emailResult.synced;
    } catch {
      emailsSynced = 0;
    }
  }

  return {
    fetched: listed.length,
    upserted,
    enriched: enriched || upserted,
    companiesLinked,
    errors,
    segmentationName: segmentation.name,
    emailsSynced,
  };
}
