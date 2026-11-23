import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { getAdminClient, getEmailSenderConfig, isEmailMarketingConfigured } from "@/lib/email-marketing-server";
import {
  listResendDomainsDetailed,
  listResendWebhooks,
  verifyResendDomain,
} from "@/lib/email-marketing-resend-api";

export const dynamic = "force-dynamic";

/** Plano grátis do Marketing do Resend (contatos guardados lá por mês). */
const FREE_MARKETING_CONTACTS = 1000;

/** Saúde do envio: domínio + registros DNS, rastreio, webhook e uso do plano grátis. */
export async function GET() {
  try {
    await requireAuthenticatedUser();
    if (!isEmailMarketingConfigured()) {
      return NextResponse.json({ configured: false, domains: [] });
    }
    const admin = getAdminClient();
    const [domains, webhooks, inResend, subscribed] = await Promise.all([
      listResendDomainsDetailed(),
      listResendWebhooks().catch(() => []),
      admin.from("email_contacts").select("id", { count: "exact", head: true }).not("resend_contact_id", "is", null),
      admin.from("email_contacts").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
    ]);
    const sender = getEmailSenderConfig();
    const webhook = webhooks.find((w) => w.endpoint.endsWith("/api/email-marketing/webhook")) ?? null;

    return NextResponse.json({
      configured: true,
      sender,
      domains: domains.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        region: d.region,
        openTracking: d.open_tracking,
        clickTracking: d.click_tracking,
        trackingSubdomain: d.tracking_subdomain ?? null,
        isSender: Boolean(sender.fromEmail && sender.fromEmail.endsWith(`@${d.name}`)),
        records: d.records.map((r) => ({
          kind: r.record,
          type: r.type,
          name: r.name,
          value: r.value,
          priority: r.priority ?? null,
          status: r.status,
        })),
      })),
      webhook: webhook
        ? { status: webhook.status, events: webhook.events, secretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()) }
        : null,
      plan: {
        marketingContactsLimit: FREE_MARKETING_CONTACTS,
        contactsInResend: inResend.count ?? 0,
        subscribedContacts: subscribed.count ?? 0,
        transactionalDailyLimit: 100,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar domínios.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Pede ao Resend para conferir de novo os registros DNS do domínio. */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = (await request.json().catch(() => ({}))) as { domainId?: string };
    if (!body.domainId) return NextResponse.json({ error: "Informe o domínio." }, { status: 400 });
    await verifyResendDomain(body.domainId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao verificar o domínio.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
