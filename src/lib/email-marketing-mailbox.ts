import "server-only";

/**
 * Campanhas que saem da caixa do próprio remetente no Microsoft 365 (ex.: o sócio dono do produto),
 * um e-mail por pessoa, via Graph. Chega como mensagem pessoal, de um endereço que o cliente conhece,
 * e a cópia fica nos Itens Enviados do sócio.
 *
 * O Graph não conta aberturas nem cliques, então o ORQESTRAI mede sozinho: uma imagem invisível
 * (/api/email-marketing/t/o/<destinatário>) e os links passando por /api/email-marketing/t/c/<destinatário>.
 * Exchange Online aceita até 30 mensagens por minuto por caixa: o envio espaça os e-mails e cada
 * chamada da tela avança uma leva (a tela chama de novo até terminar).
 */

import { getMarketingPublicUrl } from "@/lib/evolution-whatsapp";
import {
  buildUnsubscribeUrl,
  getAdminClient,
  loadCampaign,
  prepareCampaignRecipients,
  RECIPIENT_STATUS_RANK,
  type CampaignRow,
} from "@/lib/email-marketing-server";
import { applyMergeTags, buildMergeContext, SAMPLE_MERGE_CONTEXT } from "@/lib/email-marketing-merge-tags";
import { wrapCampaignHtml } from "@/lib/email-marketing-templates";
import { enviarEmailMicrosoft, MicrosoftMailError } from "@/lib/microsoft-mail";

/** ~24 por minuto, abaixo das 30/min do Exchange Online. */
const PACE_MS = 2_500;
const DEFAULT_BUDGET_MS = 45_000;
/** Destinatário "reservado" por uma chamada que caiu no meio volta para a fila depois disso. */
const STALE_CLAIM_MS = 10 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MailboxProgress {
  phase: "sending" | "sent";
  total: number;
  sent: number;
  failed: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function trackingBaseUrl(): string {
  return (getMarketingPublicUrl() || "https://www.orqestrai.com.br").replace(/\/$/, "");
}

function stripEditorMarker(html: string): string {
  return html.replace(/^<!-- newsletter-bp:[A-Za-z0-9+/=]+ -->\n?/, "");
}

const decodeHrefEntities = (url: string) => url.replace(/&amp;/g, "&");

/** Links http(s) passam pelo ORQESTRAI (conta o clique) e entra a imagem invisível de abertura. */
export function addTracking(html: string, recipientId: string): string {
  const base = trackingBaseUrl();
  const withLinks = html.replace(/href="(https?:\/\/[^"]+)"/gi, (match, rawUrl: string) => {
    if (rawUrl.includes("/api/email-marketing/unsubscribe")) return match;
    const url = decodeHrefEntities(rawUrl);
    return `href="${base}/api/email-marketing/t/c/${recipientId}?u=${encodeURIComponent(url)}"`;
  });
  const pixel = `<img src="${base}/api/email-marketing/t/o/${recipientId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  return /<\/body>/i.test(withLinks) ? withLinks.replace(/<\/body>/i, `${pixel}</body>`) : `${withLinks}${pixel}`;
}

interface MailboxRecipientRow {
  id: string;
  contact_id: string;
  email_contacts: {
    email: string;
    name: string | null;
    phone: string | null;
    company: string | null;
    custom_fields: Record<string, unknown> | null;
    unsubscribe_token: string;
    email_companies: { name: string } | { name: string }[] | null;
  } | null;
}

function buildPersonalMessage(campaign: CampaignRow, row: MailboxRecipientRow) {
  const contact = row.email_contacts!;
  const company = Array.isArray(contact.email_companies) ? contact.email_companies[0] : contact.email_companies;
  const ctx = buildMergeContext({
    email: contact.email,
    name: contact.name,
    phone: contact.phone,
    company: contact.company,
    companyName: company?.name ?? null,
    customFields: contact.custom_fields,
  });
  const body = applyMergeTags(stripEditorMarker(campaign.html_body), ctx);
  const html = wrapCampaignHtml(
    body,
    buildUnsubscribeUrl(contact.unsubscribe_token),
    applyMergeTags(campaign.preview_text ?? "", ctx)
  );
  return { subject: applyMergeTags(campaign.subject, ctx), html: addTracking(html, row.id) };
}

async function countMailbox(campaignId: string) {
  const admin = getAdminClient();
  const [total, sent, failed] = await Promise.all([
    admin.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    admin
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("status", "in", "(queued,failed,skipped)"),
    admin
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["failed", "skipped"]),
  ]);
  return { total: total.count ?? 0, sent: sent.count ?? 0, failed: failed.count ?? 0 };
}

/** Reserva o destinatário (sent_at como marca) para duas chamadas ao mesmo tempo não mandarem em dobro. */
async function claimRecipient(id: string): Promise<boolean> {
  const admin = getAdminClient();
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data } = await admin
    .from("email_campaign_recipients")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "queued")
    .or(`sent_at.is.null,sent_at.lt.${staleBefore}`)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/**
 * Avança o envio pela caixa do remetente (campaign.from_email). Chamar de novo enquanto
 * `phase` for "sending". Para de vez se a Microsoft negar a caixa (permissão do app).
 */
export async function advanceMailboxCampaign(
  campaignId: string,
  options: { budgetMs?: number } = {}
): Promise<MailboxProgress> {
  const started = Date.now();
  const budget = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const admin = getAdminClient();
  let campaign = await loadCampaign(campaignId);

  if (campaign.status === "sent") return { phase: "sent", ...(await countMailbox(campaignId)) };
  if (!campaign.from_email?.trim()) throw new Error("Informe o e-mail do remetente (a caixa que vai enviar).");

  if (campaign.status === "draft" || campaign.status === "failed") {
    const total = await prepareCampaignRecipients(campaignId);
    if (total === 0) throw new Error("Nenhum contato inscrito nesta lista.");
    await admin.from("email_campaigns").update({ status: "sending", last_error: null }).eq("id", campaignId);
    campaign = await loadCampaign(campaignId);
  }

  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data, error } = await admin
    .from("email_campaign_recipients")
    .select(
      "id, contact_id, email_contacts(email, name, phone, company, custom_fields, unsubscribe_token, email_companies(name))"
    )
    .eq("campaign_id", campaignId)
    .eq("status", "queued")
    .or(`sent_at.is.null,sent_at.lt.${staleBefore}`)
    .limit(Math.ceil(budget / PACE_MS) + 2);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as MailboxRecipientRow[];

  for (const row of rows) {
    if (Date.now() - started > budget - PACE_MS) break;
    if (!(await claimRecipient(row.id))) continue;

    if (!row.email_contacts?.email) {
      await admin
        .from("email_campaign_recipients")
        .update({ status: "failed", failed_reason: "Contato sem e-mail." })
        .eq("id", row.id);
      continue;
    }

    const message = buildPersonalMessage(campaign, row);
    try {
      await enviarEmailMicrosoft({
        para: row.email_contacts.email.trim(),
        assunto: message.subject,
        html: message.html,
        remetente: campaign.from_email,
        responderPara: campaign.reply_to && campaign.reply_to !== campaign.from_email ? campaign.reply_to : null,
        salvarEmEnviados: true,
      });
      await admin
        .from("email_campaign_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString(), failed_reason: null })
        .eq("id", row.id);
    } catch (err) {
      const status = err instanceof MicrosoftMailError ? err.status : undefined;
      // Devolve o destinatário para a fila: limite por minuto ou caixa sem permissão não são culpa dele.
      await admin.from("email_campaign_recipients").update({ sent_at: null }).eq("id", row.id);
      if (status === 429) break;
      const msg = err instanceof Error ? err.message : "Erro no envio pela Microsoft.";
      if (status === 401 || status === 403 || status === 404) {
        await admin.from("email_campaigns").update({ last_error: msg }).eq("id", campaignId);
        throw new Error(
          status === 404
            ? `A caixa ${campaign.from_email} não foi encontrada no Microsoft 365.`
            : `O Microsoft 365 não deixou o ORQESTRAI enviar pela caixa ${campaign.from_email}. ${msg}`
        );
      }
      await admin
        .from("email_campaign_recipients")
        .update({ status: "failed", failed_reason: msg })
        .eq("id", row.id);
    }
    await sleep(PACE_MS);
  }

  const counts = await countMailbox(campaignId);
  const { count: pending } = await admin
    .from("email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "queued");
  if ((pending ?? 0) === 0) {
    await admin.from("email_campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", campaignId);
    return { phase: "sent", ...counts };
  }
  return { phase: "sending", ...counts };
}

/** Teste: sai da mesma caixa da campanha, com dados de exemplo e "[TESTE]" no assunto, sem rastreio. */
export async function sendMailboxTest(campaignId: string, testEmail: string): Promise<void> {
  const campaign = await loadCampaign(campaignId);
  if (!campaign.from_email?.trim()) throw new Error("Informe o e-mail do remetente (a caixa que vai enviar).");
  const ctx = { ...SAMPLE_MERGE_CONTEXT, email: testEmail };
  const html = wrapCampaignHtml(
    applyMergeTags(stripEditorMarker(campaign.html_body), ctx),
    `${trackingBaseUrl()}/api/email-marketing/unsubscribe?token=teste`,
    applyMergeTags(campaign.preview_text ?? "", ctx)
  );
  try {
    await enviarEmailMicrosoft({
      para: testEmail,
      assunto: `[TESTE] ${applyMergeTags(campaign.subject, ctx)}`,
      html,
      remetente: campaign.from_email,
      responderPara: campaign.reply_to && campaign.reply_to !== campaign.from_email ? campaign.reply_to : null,
      salvarEmEnviados: true,
    });
  } catch (err) {
    const status = err instanceof MicrosoftMailError ? err.status : undefined;
    if (status === 403) {
      throw new Error(`O Microsoft 365 não deixou o ORQESTRAI enviar pela caixa ${campaign.from_email}.`);
    }
    throw err;
  }
}

// --- Rastreio (rotas públicas) ---

/** Abertura (imagem) ou clique (link) de um destinatário de campanha enviada pela caixa. */
export async function recordMailboxTracking(
  recipientId: string,
  kind: "opened" | "clicked",
  info: { url?: string; userAgent?: string | null } = {}
): Promise<void> {
  if (!UUID_RE.test(recipientId)) return;
  const admin = getAdminClient();
  const { data: recipient } = await admin
    .from("email_campaign_recipients")
    .select("id, status, open_count, click_count, first_opened_at, first_clicked_at")
    .eq("id", recipientId)
    .maybeSingle();
  if (!recipient) return;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (kind === "opened") {
    patch.open_count = (recipient.open_count ?? 0) + 1;
    patch.last_opened_at = now;
    if (!recipient.first_opened_at) patch.first_opened_at = now;
  } else {
    patch.click_count = (recipient.click_count ?? 0) + 1;
    if (!recipient.first_clicked_at) patch.first_clicked_at = now;
    // Quem clicou abriu, mesmo que o leitor tenha bloqueado a imagem.
    if (!recipient.first_opened_at) patch.first_opened_at = now;
  }
  const current = RECIPIENT_STATUS_RANK[recipient.status as string] ?? 0;
  if ((RECIPIENT_STATUS_RANK[kind] ?? 0) > current && current >= RECIPIENT_STATUS_RANK.sent) patch.status = kind;

  await Promise.all([
    admin.from("email_campaign_recipients").update(patch).eq("id", recipientId),
    admin.from("email_events").insert({
      campaign_recipient_id: recipientId,
      event_type: kind === "opened" ? "email.opened" : "email.clicked",
      event_data: { source: "orqestrai", url: info.url ?? null, user_agent: info.userAgent ?? null },
    }),
  ]);
}

/** Só redireciona para links que estão no corpo da campanha (evita redirecionamento aberto). */
export async function resolveTrackedLink(recipientId: string, url: string): Promise<string | null> {
  if (!UUID_RE.test(recipientId) || !/^https?:\/\//i.test(url)) return null;
  const admin = getAdminClient();
  const { data } = await admin
    .from("email_campaign_recipients")
    .select("email_campaigns(html_body)")
    .eq("id", recipientId)
    .maybeSingle();
  const join = (data as { email_campaigns?: { html_body: string } | { html_body: string }[] | null } | null)
    ?.email_campaigns;
  const html = (Array.isArray(join) ? join[0]?.html_body : join?.html_body) ?? "";
  return html.includes(url) || html.includes(url.replace(/&/g, "&amp;")) ? url : null;
}
