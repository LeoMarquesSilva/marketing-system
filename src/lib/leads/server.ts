import "server-only";

/**
 * Leads dos materiais de produto (server-only): quem chega pelo link do e-mail já vem identificado
 * pelo destinatário da campanha (?r=<id>); quem chega por outro caminho preenche nome e e-mail.
 */

import { getAdminClient } from "@/lib/email-marketing-server";
import {
  classificarLead,
  PRODUTO_6X1,
  validarRespostas,
  type RespostasQualificacao,
  type Temperatura,
} from "@/lib/leads/qualificacao-6x1";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Link do PDF do e-book (bucket público dos e-mails). */
export function ebook6x1Url(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/storage/v1/object/public/MARKETING-SYSTEM-EMAILS/produtos/ebook-fim-da-escala-6x1-bismarchi-pires.pdf`;
}

export interface LeadPrefill {
  recipientId: string;
  name: string | null;
  email: string;
  company: string | null;
}

/** Dados do destinatário do e-mail, para não pedir de novo o que já sabemos. */
export async function prefillFromRecipient(recipientId: string | null | undefined): Promise<LeadPrefill | null> {
  if (!recipientId || !UUID_RE.test(recipientId)) return null;
  const { data } = await getAdminClient()
    .from("email_campaign_recipients")
    .select("id, email_contacts(email, name, company, email_companies(name))")
    .eq("id", recipientId)
    .maybeSingle();
  type Join = { email: string; name: string | null; company: string | null; email_companies: { name: string } | { name: string }[] | null };
  const raw = (data as { email_contacts?: Join | Join[] | null } | null)?.email_contacts;
  const contact = Array.isArray(raw) ? raw[0] : raw;
  if (!contact?.email) return null;
  const company = Array.isArray(contact.email_companies) ? contact.email_companies[0] : contact.email_companies;
  return { recipientId, name: contact.name, email: contact.email, company: company?.name ?? contact.company ?? null };
}

export interface LeadInput {
  recipientId?: string | null;
  source?: string | null;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  phone?: string | null;
  answers: RespostasQualificacao;
  userAgent?: string | null;
}

export async function saveLead6x1(input: LeadInput): Promise<{ temperature: Temperatura; wantsContact: boolean }> {
  const answers = Object.fromEntries(
    Object.entries(input.answers ?? {}).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 40)])
  );
  const invalid = validarRespostas(answers);
  if (invalid) throw new Error(invalid);

  const admin = getAdminClient();
  let campaignId: string | null = null;
  let contactId: string | null = null;
  let recipientId: string | null = null;
  let email = input.email?.trim().toLowerCase() ?? "";
  let name = input.name?.trim() || null;
  let company = input.company?.trim() || null;

  if (input.recipientId && UUID_RE.test(input.recipientId)) {
    const { data } = await admin
      .from("email_campaign_recipients")
      .select("id, campaign_id, contact_id, email_contacts(email, name, company)")
      .eq("id", input.recipientId)
      .maybeSingle();
    if (data) {
      type Join = { email: string; name: string | null; company: string | null };
      const raw = (data as { email_contacts?: Join | Join[] | null }).email_contacts;
      const contact = Array.isArray(raw) ? raw[0] : raw;
      recipientId = data.id as string;
      campaignId = data.campaign_id as string;
      contactId = data.contact_id as string;
      email = email || contact?.email?.toLowerCase() || "";
      name = name || contact?.name || null;
      company = company || contact?.company || null;
    }
  }

  if (!EMAIL_RE.test(email)) throw new Error("Informe um e-mail válido.");
  if (!recipientId && !name) throw new Error("Informe seu nome.");

  const result = classificarLead(answers);
  const source = input.source === "whatsapp" ? "whatsapp" : recipientId ? "email" : "direto";
  const { error } = await admin.from("product_lead_responses").insert({
    product: PRODUTO_6X1,
    campaign_id: campaignId,
    recipient_id: recipientId,
    contact_id: contactId,
    name: name?.slice(0, 160) ?? null,
    email: email.slice(0, 200),
    company: company?.slice(0, 200) ?? null,
    phone: input.phone?.trim().slice(0, 40) || null,
    answers,
    score: result.pontos,
    temperature: result.temperatura,
    reason: result.motivo,
    source,
    user_agent: input.userAgent?.slice(0, 300) ?? null,
  });
  if (error) throw new Error("Não foi possível registrar suas respostas. Tente de novo.");
  return { temperature: result.temperatura, wantsContact: answers.contato === "sim" };
}
