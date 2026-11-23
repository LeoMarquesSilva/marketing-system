/**
 * Envio de campanhas pelo Marketing do Resend (Broadcasts). Server-only.
 *
 * Por que: no plano grátis o envio transacional para em 100 e-mails por dia, enquanto o
 * Marketing manda sem limite para até 1.000 contatos por mês. Fluxo de cada campanha:
 *   1. prepara os destinatários (mesma regra do envio em lotes: inscritos da lista);
 *   2. cria um segmento "ORQESTRAI · <campanha>" e põe cada destinatário nele
 *      (POST /contacts com `segments` cria ou reaproveita o contato numa chamada só);
 *   3. cria o broadcast como rascunho, guarda o ID e só então dispara (ou agenda).
 * A etapa 2 é retomável: cada chamada avança até o tempo-limite e a tela chama de novo.
 */

import { getAdminClient, loadCampaign, prepareCampaignRecipients, type CampaignRow } from "@/lib/email-marketing-server";
import { resendApi, ResendApiError, runPool } from "@/lib/email-marketing-resend-api";
import { buildMergeContext, toBroadcastPlaceholders } from "@/lib/email-marketing-merge-tags";
import { wrapCampaignHtml } from "@/lib/email-marketing-templates";

const SEGMENT_PREFIX = "ORQESTRAI · ";
/** Plano grátis do Marketing: 3 segmentos no total (o "General" padrão conta). */
const FREE_SEGMENT_LIMIT = 3;
const SYNC_CONCURRENCY = 6;
const SYNC_PAGE = 60;
const DEFAULT_BUDGET_MS = 40_000;

export type BroadcastPhase = "syncing" | "scheduled" | "sent";

export interface BroadcastProgress {
  phase: BroadcastPhase;
  total: number;
  synced: number;
  skipped: number;
  broadcastId: string | null;
}

/** Tira o marcador do editor visual (base64 enorme) antes de mandar o HTML. */
function stripEditorMarker(html: string): string {
  return html.replace(/^<!-- newsletter-bp:[A-Za-z0-9+/=]+ -->\n?/, "");
}

export function buildBroadcastContent(campaign: Pick<CampaignRow, "subject" | "preview_text" | "html_body">) {
  const body = toBroadcastPlaceholders(stripEditorMarker(campaign.html_body));
  const subject = toBroadcastPlaceholders(campaign.subject);
  const preview = toBroadcastPlaceholders(campaign.preview_text ?? "");
  return {
    subject: subject.text,
    previewText: preview.text,
    html: wrapCampaignHtml(body.text, "{{{RESEND_UNSUBSCRIBE_URL}}}", preview.text),
    unsupported: [...new Set([...body.unsupported, ...subject.unsupported, ...preview.unsupported])],
  };
}

// --- Segmento da campanha ---

async function freeSegmentSlot(): Promise<void> {
  const { data: segments } = await resendApi<{ data: { id: string; name: string; created_at: string }[] }>(
    "GET",
    "/segments"
  );
  if (segments.length < FREE_SEGMENT_LIMIT) return;

  const ours = segments
    .filter((s) => s.name.startsWith(SEGMENT_PREFIX))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (ours.length === 0) {
    throw new Error(
      "O Resend grátis permite 3 segmentos e todos estão ocupados por segmentos criados fora do ORQESTRAI. Apague um no painel do Resend."
    );
  }

  const admin = getAdminClient();
  const { data: campaigns } = await admin
    .from("email_campaigns")
    .select("resend_segment_id, status, sent_at")
    .in("resend_segment_id", ours.map((s) => s.id));
  const byId = new Map((campaigns ?? []).map((c) => [c.resend_segment_id as string, c]));
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

  // Só apaga segmento de campanha já enviada há um tempo (o broadcast já saiu) ou órfão.
  const removable = ours.find((s) => {
    const campaign = byId.get(s.id);
    if (!campaign) return true;
    return campaign.status === "sent" && campaign.sent_at && new Date(campaign.sent_at as string).getTime() < twoHoursAgo;
  });
  if (!removable) {
    throw new Error(
      "O Resend grátis permite 3 segmentos e os do ORQESTRAI ainda estão em uso por campanhas em envio ou agendadas. Tente de novo depois que elas saírem."
    );
  }
  await resendApi("DELETE", `/segments/${removable.id}`);
  await admin.from("email_campaigns").update({ resend_segment_id: null }).eq("resend_segment_id", removable.id);
}

async function ensureCampaignSegment(campaign: CampaignRow): Promise<string> {
  if (campaign.resend_segment_id) return campaign.resend_segment_id;
  await freeSegmentSlot();
  const name = `${SEGMENT_PREFIX}${campaign.name}`.slice(0, 120);
  const created = await resendApi<{ id: string }>("POST", "/segments", { name });
  await getAdminClient().from("email_campaigns").update({ resend_segment_id: created.id }).eq("id", campaign.id);
  return created.id;
}

let empresaPropertyReady = false;

/** Propriedade `empresa` do contato (usada por {{empresa}}); criar de novo devolve erro e ignoramos. */
async function ensureContactProperties(): Promise<void> {
  if (empresaPropertyReady) return;
  const { data } = await resendApi<{ data: { key: string }[] }>("GET", "/contact-properties");
  if (!data.some((p) => p.key === "empresa")) {
    await resendApi("POST", "/contact-properties", { key: "empresa", type: "string", fallback_value: "" });
  }
  empresaPropertyReady = true;
}

// --- Destinatários → segmento ---

interface PendingRecipientRow {
  id: string;
  contact_id: string;
  email_contacts: {
    email: string;
    name: string | null;
    company: string | null;
    email_companies: { name: string } | { name: string }[] | null;
  } | null;
}

function splitName(fullName: string | null | undefined): { first: string; last: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

async function addRecipientToSegment(row: PendingRecipientRow, segmentId: string): Promise<"added" | "skipped"> {
  const admin = getAdminClient();
  const contact = row.email_contacts;
  const now = new Date().toISOString();
  if (!contact?.email) {
    await admin
      .from("email_campaign_recipients")
      .update({ status: "failed", failed_reason: "Contato sem e-mail." })
      .eq("id", row.id);
    return "skipped";
  }

  const companyJoin = Array.isArray(contact.email_companies) ? contact.email_companies[0] : contact.email_companies;
  const ctx = buildMergeContext({
    email: contact.email,
    name: contact.name,
    company: contact.company,
    companyName: companyJoin?.name ?? null,
  });
  const { first, last } = splitName(contact.name);

  try {
    const created = await resendApi<{ id: string }>("POST", "/contacts", {
      email: contact.email.trim().toLowerCase(),
      first_name: first || undefined,
      last_name: last || undefined,
      properties: ctx.empresa ? { empresa: ctx.empresa } : undefined,
      segments: [{ id: segmentId }],
    });
    await Promise.all([
      admin
        .from("email_contacts")
        .update({ resend_contact_id: created.id, resend_synced_at: now })
        .eq("id", row.contact_id),
      admin.from("email_campaign_recipients").update({ segment_added_at: now }).eq("id", row.id),
    ]);
    return "added";
  } catch (err) {
    // E-mail recusado pelo Resend (formato inválido etc.): o destinatário sai da campanha.
    if (err instanceof ResendApiError && err.status >= 400 && err.status < 500 && err.status !== 429) {
      await admin
        .from("email_campaign_recipients")
        .update({ status: "failed", failed_reason: `Resend: ${err.message}` })
        .eq("id", row.id);
      return "skipped";
    }
    throw err;
  }
}

async function countRecipients(campaignId: string) {
  const admin = getAdminClient();
  const [total, synced, skipped] = await Promise.all([
    admin.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    admin
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("segment_added_at", "is", null),
    admin
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["failed", "skipped"]),
  ]);
  return { total: total.count ?? 0, synced: synced.count ?? 0, skipped: skipped.count ?? 0 };
}

// --- Broadcast ---

async function createOrSendBroadcast(campaign: CampaignRow, segmentId: string, scheduledAt: string | null) {
  const admin = getAdminClient();
  let broadcastId = campaign.resend_broadcast_id;

  if (!broadcastId) {
    const content = buildBroadcastContent(campaign);
    const created = await resendApi<{ id: string }>("POST", "/broadcasts", {
      segment_id: segmentId,
      from: `${campaign.from_name} <${campaign.from_email}>`,
      subject: content.subject,
      reply_to: campaign.reply_to || undefined,
      preview_text: content.previewText || undefined,
      html: content.html,
      name: campaign.name,
    });
    broadcastId = created.id;
    // Guarda antes de disparar: se algo falhar daqui em diante, a próxima tentativa não cria outro.
    await admin.from("email_campaigns").update({ resend_broadcast_id: broadcastId }).eq("id", campaign.id);
  }

  const current = await resendApi<{ status: string }>("GET", `/broadcasts/${broadcastId}`);
  if (current.status === "draft") {
    await resendApi("POST", `/broadcasts/${broadcastId}/send`, scheduledAt ? { scheduled_at: scheduledAt } : {});
  }
  return broadcastId;
}

/**
 * Avança o envio de uma campanha por Broadcasts. Chamar de novo enquanto `phase` for "syncing".
 * `scheduledAt` (ISO, no futuro) agenda o broadcast no próprio Resend em vez de mandar já.
 */
export async function advanceBroadcastCampaign(
  campaignId: string,
  options: { scheduledAt?: string | null; budgetMs?: number } = {}
): Promise<BroadcastProgress> {
  const started = Date.now();
  const budget = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const admin = getAdminClient();
  let campaign = await loadCampaign(campaignId);

  if (campaign.status === "sent" || (campaign.status === "scheduled" && campaign.resend_broadcast_id)) {
    const counts = await countRecipients(campaignId);
    return { phase: campaign.status === "sent" ? "sent" : "scheduled", ...counts, broadcastId: campaign.resend_broadcast_id };
  }

  const scheduledAt = options.scheduledAt ?? null;
  if (scheduledAt) {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now() + 60_000) {
      throw new Error("Escolha um horário pelo menos alguns minutos no futuro.");
    }
  }

  if (campaign.status === "draft" || campaign.status === "failed") {
    const total = await prepareCampaignRecipients(campaignId);
    if (total === 0) throw new Error("Nenhum contato inscrito nesta lista.");
    await admin
      .from("email_campaigns")
      .update({ status: "sending", last_error: null, send_mode: "broadcast" })
      .eq("id", campaignId);
    campaign = await loadCampaign(campaignId);
  }

  try {
    await ensureContactProperties();
    const segmentId = await ensureCampaignSegment(campaign);

    while (Date.now() - started < budget) {
      const { data, error } = await admin
        .from("email_campaign_recipients")
        .select("id, contact_id, email_contacts(email, name, company, email_companies(name))")
        .eq("campaign_id", campaignId)
        .eq("status", "queued")
        .is("segment_added_at", null)
        .limit(SYNC_PAGE);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as PendingRecipientRow[];
      if (rows.length === 0) break;
      await runPool(rows, SYNC_CONCURRENCY, async (row) => {
        await addRecipientToSegment(row, segmentId);
      });
    }

    const counts = await countRecipients(campaignId);
    const { count: pending } = await admin
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "queued")
      .is("segment_added_at", null);
    if ((pending ?? 0) > 0) {
      return { phase: "syncing", ...counts, broadcastId: null };
    }
    if (counts.synced === 0) throw new Error("Nenhum destinatário pôde ser preparado no Resend.");

    // O segmento leva alguns instantes para refletir os últimos contatos incluídos.
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const broadcastId = await createOrSendBroadcast(campaign, segmentId, scheduledAt);
    const now = new Date().toISOString();

    if (scheduledAt) {
      await admin
        .from("email_campaigns")
        .update({ status: "scheduled", scheduled_at: new Date(scheduledAt).toISOString() })
        .eq("id", campaignId);
      return { phase: "scheduled", ...counts, broadcastId };
    }

    await admin.from("email_campaigns").update({ status: "sent", sent_at: now }).eq("id", campaignId);
    await admin
      .from("email_campaign_recipients")
      .update({ status: "sent", sent_at: now })
      .eq("campaign_id", campaignId)
      .eq("status", "queued")
      .not("segment_added_at", "is", null);
    return { phase: "sent", ...counts, broadcastId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro no envio pelo Resend.";
    await admin.from("email_campaigns").update({ last_error: message }).eq("id", campaignId);
    throw err;
  }
}

/** Cancela um broadcast agendado no Resend e devolve a campanha para rascunho. */
export async function cancelScheduledBroadcast(campaignId: string): Promise<void> {
  const admin = getAdminClient();
  const campaign = await loadCampaign(campaignId);
  if (campaign.status !== "scheduled") throw new Error("A campanha não está agendada.");
  if (campaign.resend_broadcast_id) {
    await resendApi("DELETE", `/broadcasts/${campaign.resend_broadcast_id}`);
  }
  // O segmento sai junto: se a lista mudar até o novo envio, ele é montado de novo do zero.
  if (campaign.resend_segment_id) {
    await resendApi("DELETE", `/segments/${campaign.resend_segment_id}`).catch(() => undefined);
  }
  await admin
    .from("email_campaigns")
    .update({ status: "draft", scheduled_at: null, resend_broadcast_id: null, resend_segment_id: null })
    .eq("id", campaignId);
  await admin
    .from("email_campaign_recipients")
    .update({ status: "queued", segment_added_at: null, sent_at: null })
    .eq("campaign_id", campaignId);
}

/** Cron: campanhas agendadas por Broadcast cuja hora passou viram "enviada" (o Resend já disparou). */
export async function settleScheduledBroadcasts(): Promise<number> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("email_campaigns")
    .select("id, scheduled_at")
    .eq("status", "scheduled")
    .eq("send_mode", "broadcast")
    .not("resend_broadcast_id", "is", null)
    .lte("scheduled_at", new Date().toISOString());
  for (const row of data ?? []) {
    await admin
      .from("email_campaigns")
      .update({ status: "sent", sent_at: row.scheduled_at })
      .eq("id", row.id as string);
    await admin
      .from("email_campaign_recipients")
      .update({ status: "sent", sent_at: row.scheduled_at })
      .eq("campaign_id", row.id as string)
      .eq("status", "queued")
      .not("segment_added_at", "is", null);
  }
  return data?.length ?? 0;
}
