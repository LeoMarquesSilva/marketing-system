/**
 * Módulo de E-mail Marketing — envio, webhook e descadastro (server-only).
 * Precisa de RESEND_API_KEY / SUPABASE_SERVICE_ROLE_KEY. CRUD de contatos/listas/
 * campanhas (sem segredos) fica em src/lib/email-marketing.ts.
 */

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { getMarketingPublicUrl } from "@/lib/evolution-whatsapp";
import { wrapCampaignHtml } from "@/lib/email-marketing-templates";
import {
  applyMergeTags,
  buildMergeContext,
  SAMPLE_MERGE_CONTEXT,
} from "@/lib/email-marketing-merge-tags";
import {
  companyNameKey,
  normalizeCompanyName,
  normalizePersonName,
  normalizeTags,
  resolveCanonicalCompanyName,
} from "@/lib/email-marketing-normalize";
import type { WebhookEventPayload } from "resend";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const BATCH_SIZE = 100;
const MAX_CAMPAIGNS_PER_CRON_RUN = 5;

export function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export function isEmailMarketingConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada.");
  return new Resend(apiKey);
}

export function getDefaultFromName(): string {
  return process.env.EMAIL_MARKETING_DEFAULT_FROM_NAME?.trim() || "Bismarchi Pires";
}

export function getFromDomain(): string | null {
  return process.env.EMAIL_MARKETING_FROM_DOMAIN?.trim() || null;
}

export function getDefaultFromEmail(): string {
  const explicit = process.env.EMAIL_MARKETING_FROM_EMAIL?.trim();
  if (explicit) return explicit;
  const domain = getFromDomain();
  if (domain) return `contato@${domain}`;
  return "";
}

export function getDefaultReplyTo(): string | null {
  return process.env.EMAIL_MARKETING_REPLY_TO?.trim() || null;
}

export interface EmailSenderConfig {
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
}

/** Remetente padrão de todas as campanhas (variáveis de ambiente). */
export function getEmailSenderConfig(): EmailSenderConfig {
  return {
    fromName: getDefaultFromName(),
    fromEmail: getDefaultFromEmail(),
    replyTo: getDefaultReplyTo(),
  };
}

function getBaseUrl(): string {
  return getMarketingPublicUrl() || "http://localhost:3000";
}

export function buildUnsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/email-marketing/unsubscribe?token=${encodeURIComponent(token)}`;
}

function buildUnsubscribeHeaders(unsubscribeUrl: string, fromEmail: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<mailto:${fromEmail}?subject=unsubscribe>, <${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  html_body: string;
  list_id: string | null;
  status: string;
  total_recipients: number;
}

async function loadCampaign(campaignId: string): Promise<CampaignRow> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Campanha não encontrada.");
  return data as CampaignRow;
}

// --- Envio de teste ---

export async function sendTestEmail(campaignId: string, testEmail: string): Promise<void> {
  const campaign = await loadCampaign(campaignId);
  const resend = getResendClient();
  const fakeUnsubscribeUrl = `${getBaseUrl()}/api/email-marketing/unsubscribe?token=teste`;
  const ctx = { ...SAMPLE_MERGE_CONTEXT, email: testEmail };
  const html = wrapCampaignHtml(
    applyMergeTags(campaign.html_body, ctx),
    fakeUnsubscribeUrl,
    applyMergeTags(campaign.preview_text ?? "", ctx)
  );
  const { error } = await resend.emails.send({
    from: `${campaign.from_name} <${campaign.from_email}>`,
    to: testEmail,
    subject: `[TESTE] ${applyMergeTags(campaign.subject, ctx)}`,
    html,
    replyTo: campaign.reply_to || undefined,
  });
  if (error) throw new Error(error.message);
}

// --- Preparo e disparo de campanhas ---

async function fetchTargetContacts(
  listId: string | null
): Promise<{ id: string; email: string; name: string | null }[]> {
  const admin = getAdminClient();
  if (listId) {
    const { data, error } = await admin
      .from("email_list_contacts")
      .select("email_contacts(id, email, name, status)")
      .eq("list_id", listId);
    if (error) throw new Error(error.message);
    type JoinedContact = { id: string; email: string; name: string | null; status: string };
    return (data ?? [])
      .map((row) => {
        const value = (row as { email_contacts: unknown }).email_contacts;
        return (Array.isArray(value) ? value[0] : value) as JoinedContact | null;
      })
      .filter((c): c is JoinedContact => c !== null && c.status === "subscribed")
      .map((c) => ({ id: c.id, email: c.email, name: c.name }));
  }
  const { data, error } = await admin
    .from("email_contacts")
    .select("id, email, name")
    .eq("status", "subscribed");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Cria as linhas de destinatário (idempotente) e atualiza o total da campanha. */
export async function prepareCampaignRecipients(campaignId: string): Promise<number> {
  const campaign = await loadCampaign(campaignId);
  const contacts = await fetchTargetContacts(campaign.list_id);
  const admin = getAdminClient();

  if (contacts.length > 0) {
    const rows = contacts.map((c) => ({
      campaign_id: campaignId,
      contact_id: c.id,
      status: "queued" as const,
    }));
    const { error } = await admin
      .from("email_campaign_recipients")
      .upsert(rows, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  await admin
    .from("email_campaigns")
    .update({ total_recipients: contacts.length })
    .eq("id", campaignId);

  return contacts.length;
}

/** Dispara imediatamente: prepara destinatários e marca como 'sending'. O cron cuida dos lotes. */
export async function startCampaignNow(campaignId: string): Promise<number> {
  const total = await prepareCampaignRecipients(campaignId);
  const admin = getAdminClient();
  const { error } = await admin
    .from("email_campaigns")
    .update({ status: "sending" })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
  return total;
}

export async function scheduleCampaign(campaignId: string, scheduledAt: string): Promise<void> {
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new Error("Data de agendamento inválida (deve ser no futuro).");
  }
  const admin = getAdminClient();
  const { error } = await admin
    .from("email_campaigns")
    .update({ status: "scheduled", scheduled_at: date.toISOString() })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
}

interface RecipientBatchRow {
  id: string;
  contact_id: string;
  email_contacts: {
    email: string;
    name: string | null;
    phone: string | null;
    company: string | null;
    custom_fields: Record<string, unknown> | null;
    unsubscribe_token: string;
    email_companies: { name: string } | null;
  } | null;
}

/** Envia o próximo lote (até BATCH_SIZE) de uma campanha em status 'sending'. */
export async function sendNextBatch(
  campaignId: string
): Promise<{ processed: number; remaining: boolean; finished: boolean }> {
  const admin = getAdminClient();
  const campaign = await loadCampaign(campaignId);

  const { data: pending, error } = await admin
    .from("email_campaign_recipients")
    .select(
      "id, contact_id, email_contacts(email, name, phone, company, custom_fields, unsubscribe_token, email_companies(name))"
    )
    .eq("campaign_id", campaignId)
    .eq("status", "queued")
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);

  const rows = (pending ?? []) as unknown as RecipientBatchRow[];

  if (rows.length === 0) {
    await admin
      .from("email_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
    return { processed: 0, remaining: false, finished: true };
  }

  const resend = getResendClient();
  const payload = rows.map((row) => {
    const contact = row.email_contacts;
    const companyJoin = contact?.email_companies;
    const companyName = Array.isArray(companyJoin)
      ? companyJoin[0]?.name
      : companyJoin?.name;
    const unsubscribeUrl = buildUnsubscribeUrl(contact?.unsubscribe_token ?? "");
    const mergeCtx = buildMergeContext({
      email: contact?.email ?? "",
      name: contact?.name,
      phone: contact?.phone,
      company: contact?.company,
      companyName: companyName ?? null,
      customFields: contact?.custom_fields,
    });
    const subject = applyMergeTags(campaign.subject, mergeCtx);
    const html = wrapCampaignHtml(
      applyMergeTags(campaign.html_body, mergeCtx),
      unsubscribeUrl,
      applyMergeTags(campaign.preview_text ?? "", mergeCtx)
    );
    return {
      from: `${campaign.from_name} <${campaign.from_email}>`,
      to: contact?.email ?? "",
      subject,
      html,
      replyTo: campaign.reply_to || undefined,
      headers: buildUnsubscribeHeaders(unsubscribeUrl, campaign.from_email),
      tags: [{ name: "campaign_id", value: campaignId }],
    };
  });

  const { data, error: sendError } = await resend.batch.send(payload);

  if (sendError || !data) {
    await admin
      .from("email_campaign_recipients")
      .update({ status: "failed", failed_reason: sendError?.message ?? "Erro desconhecido no envio." })
      .in("id", rows.map((r) => r.id));
    return { processed: rows.length, remaining: true, finished: false };
  }

  const results = data.data;
  const now = new Date().toISOString();
  await Promise.all(
    rows.map((row, index) => {
      const resendId = results[index]?.id ?? null;
      return admin
        .from("email_campaign_recipients")
        .update({
          resend_email_id: resendId,
          status: resendId ? "sent" : "failed",
          sent_at: resendId ? now : null,
          failed_reason: resendId ? null : "Sem retorno de ID do Resend.",
        })
        .eq("id", row.id);
    })
  );

  const { count } = await admin
    .from("email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "queued");

  const remaining = (count ?? 0) > 0;
  if (!remaining) {
    await admin
      .from("email_campaigns")
      .update({ status: "sent", sent_at: now })
      .eq("id", campaignId);
  }

  return { processed: rows.length, remaining, finished: !remaining };
}

/**
 * Envia lotes em sequência até terminar a campanha ou estourar o orçamento de tempo.
 * Usado no "enviar agora" para não depender só da frequência do cron (bases pequenas
 * de ~2 mil contatos terminam em uma única chamada).
 */
export async function sendAllPendingBatches(
  campaignId: string,
  maxMs = 50_000
): Promise<{ processed: number; finished: boolean }> {
  const start = Date.now();
  let processed = 0;
  while (Date.now() - start < maxMs) {
    const result = await sendNextBatch(campaignId);
    processed += result.processed;
    if (result.finished) return { processed, finished: true };
    if (result.processed === 0) return { processed, finished: false }; // lote falhou sem avançar
  }
  return { processed, finished: false };
}

/** Cron: promove campanhas agendadas cuja hora chegou e envia um lote de cada campanha em andamento. */
export async function processScheduledEmailCampaigns(): Promise<{
  promoted: number;
  batchesSent: number;
}> {
  const admin = getAdminClient();
  let promoted = 0;

  const { data: due } = await admin
    .from("email_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  for (const row of due ?? []) {
    await prepareCampaignRecipients(row.id as string);
    await admin.from("email_campaigns").update({ status: "sending" }).eq("id", row.id as string);
    promoted++;
  }

  const { data: sending } = await admin
    .from("email_campaigns")
    .select("id")
    .eq("status", "sending")
    .limit(MAX_CAMPAIGNS_PER_CRON_RUN);

  let batchesSent = 0;
  for (const row of sending ?? []) {
    await sendNextBatch(row.id as string);
    batchesSent++;
  }

  return { promoted, batchesSent };
}

// --- Webhook do Resend ---

export function verifyResendWebhook(rawBody: string, headers: Headers): WebhookEventPayload {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("RESEND_WEBHOOK_SECRET não configurado.");
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Cabeçalhos de assinatura do webhook ausentes.");
  }
  const resend = getResendClient();
  return resend.webhooks.verify({
    payload: rawBody,
    headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
    webhookSecret: secret,
  });
}

export async function handleResendWebhookEvent(event: WebhookEventPayload): Promise<void> {
  const admin = getAdminClient();
  const emailId = (event.data as { email_id?: string }).email_id;
  if (!emailId) return;

  const { data: recipient } = await admin
    .from("email_campaign_recipients")
    .select("id, contact_id, open_count, click_count")
    .eq("resend_email_id", emailId)
    .maybeSingle();

  if (!recipient) return; // pode ser um envio de teste, sem correspondência

  await admin.from("email_events").insert({
    campaign_recipient_id: recipient.id,
    event_type: event.type,
    event_data: event.data as unknown as Record<string, unknown>,
  });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  switch (event.type) {
    case "email.delivered":
      patch.status = "delivered";
      break;
    case "email.opened":
      patch.status = "opened";
      patch.open_count = (recipient.open_count ?? 0) + 1;
      patch.last_opened_at = now;
      break;
    case "email.clicked":
      patch.status = "clicked";
      patch.click_count = (recipient.click_count ?? 0) + 1;
      patch.first_clicked_at = now;
      break;
    case "email.bounced":
      patch.status = "bounced";
      patch.bounced_at = now;
      patch.bounce_type = (event.data as { bounce?: { type?: string } }).bounce?.type ?? null;
      await admin.from("email_contacts").update({ status: "bounced" }).eq("id", recipient.contact_id);
      break;
    case "email.complained":
      patch.status = "complained";
      patch.complained_at = now;
      await admin.from("email_contacts").update({ status: "complained" }).eq("id", recipient.contact_id);
      break;
    case "email.failed":
      patch.status = "failed";
      patch.failed_reason = (event.data as { failed?: { reason?: string } }).failed?.reason ?? null;
      break;
    default:
      break;
  }

  if (event.type === "email.opened") {
    const { data: current } = await admin
      .from("email_campaign_recipients")
      .select("first_opened_at")
      .eq("id", recipient.id)
      .maybeSingle();
    if (!current?.first_opened_at) patch.first_opened_at = now;
  }

  if (Object.keys(patch).length > 0) {
    await admin.from("email_campaign_recipients").update(patch).eq("id", recipient.id);
  }
}

// --- Descadastro público ---

export async function unsubscribeContactByToken(token: string): Promise<{ email: string } | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("email_contacts")
    .select("id, email, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (error || !data) return null;
  if (data.status !== "unsubscribed") {
    await admin
      .from("email_contacts")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("id", data.id);
  }
  return { email: data.email as string };
}

// --- Importação em massa ---

export interface ImportContactRow {
  email: string;
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  tags?: string[];
}

async function upsertEmailCompany(
  admin: ReturnType<typeof getAdminClient>,
  companyName: string | null
): Promise<string | null> {
  const name = resolveCanonicalCompanyName(companyName) ?? normalizeCompanyName(companyName);
  const key = companyNameKey(name);
  if (!name || !key) return null;

  const { data, error } = await admin
    .from("email_companies")
    .upsert({ name, name_normalized: key, source: "import" }, { onConflict: "name_normalized" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function importEmailContacts(
  rows: ImportContactRow[]
): Promise<{ imported: number; skipped: number }> {
  const admin = getAdminClient();
  const seen = new Set<string>();
  const clean = rows
    .map((r) => ({
      email: r.email?.trim().toLowerCase(),
      name: normalizePersonName(r.name),
      phone: r.phone?.trim() || null,
      company: resolveCanonicalCompanyName(r.company) ?? normalizeCompanyName(r.company),
      tags: normalizeTags(r.tags ?? []),
    }))
    .filter((r): r is { email: string; name: string | null; phone: string | null; company: string | null; tags: string[] } => {
      if (!r.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return false;
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

  if (clean.length === 0) return { imported: 0, skipped: rows.length };

  const companyCache = new Map<string, string | null>();
  const payload = [];
  for (const row of clean) {
    let companyId: string | null = null;
    if (row.company) {
      const key = companyNameKey(row.company)!;
      if (!companyCache.has(key)) {
        companyCache.set(key, await upsertEmailCompany(admin, row.company));
      }
      companyId = companyCache.get(key) ?? null;
    }
    payload.push({
      email: row.email,
      name: row.name,
      phone: row.phone,
      company: row.company,
      company_id: companyId,
      tags: row.tags,
      source: "import",
    });
  }

  const { error } = await admin.from("email_contacts").upsert(payload, { onConflict: "email" });
  if (error) throw new Error(error.message);

  return { imported: clean.length, skipped: rows.length - clean.length };
}

// --- Status de domínio (para a aba Configurações) ---

export interface EmailDomainStatus {
  name: string;
  status: string;
  openTracking: boolean;
  clickTracking: boolean;
  trackingSubdomain: string | null;
}

export async function listEmailDomains(): Promise<EmailDomainStatus[]> {
  const resend = getResendClient();
  const { data, error } = await resend.domains.list();
  if (error || !data) throw new Error(error?.message ?? "Erro ao consultar domínios do Resend.");
  return data.data.map((d) => ({
    name: d.name,
    status: d.status,
    openTracking: Boolean(d.open_tracking),
    clickTracking: Boolean(d.click_tracking),
    trackingSubdomain: d.tracking_subdomain ?? null,
  }));
}
