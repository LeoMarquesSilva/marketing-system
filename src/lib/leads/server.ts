import "server-only";

/**
 * Leads dos materiais de produto (server-only).
 * - Pelo e-mail da campanha (?r=<destinatário>) a pessoa já vem identificada e responde as 5 perguntas.
 * - Pelos outros canais (Linktree/Instagram, WhatsApp, direto) preenche nome, WhatsApp, e-mail e "Você é:",
 *   baixa na hora e pode responder as 5 perguntas depois (opcional).
 * O funil (visita, início, lead, download, qualificação) fica em product_material_events, sem IP.
 */

import { getAdminClient } from "@/lib/email-marketing-server";
import {
  classificarLead,
  PRODUTO_6X1,
  validarRespostas,
  type RespostasQualificacao,
  type Temperatura,
} from "@/lib/leads/qualificacao-6x1";
import { ehPerfil, normalizarTelefone, type EventoMaterial, type Origem, type Perfil } from "@/lib/leads/materiais";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Materiais que aceitam eventos da página pública. */
export const PRODUTOS_COM_EVENTOS = new Set([PRODUTO_6X1]);

const uuidOuNulo = (valor: string | null | undefined) => (valor && UUID_RE.test(valor) ? valor : null);
const corta = (valor: string | null | undefined, max: number) => valor?.trim().slice(0, max) || null;

/** Link do PDF do e-book (bucket público dos e-mails). */
export function ebook6x1Url(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/storage/v1/object/public/MARKETING-SYSTEM-EMAILS/produtos/ebook-fim-da-escala-6x1-bismarchi-pires.pdf`;
}

/** Link do botão de download: passa pelo ORQESTRAI, que conta e abre o PDF. */
export function downloadLink6x1(leadId: string | null, visitorId?: string | null): string {
  const params = new URLSearchParams();
  if (leadId) params.set("l", leadId);
  if (visitorId) params.set("v", visitorId);
  const query = params.toString();
  return `/api/materiais/fim-da-escala-6x1/baixar${query ? `?${query}` : ""}`;
}

export interface MaterialEventInput {
  product: string;
  event: EventoMaterial;
  source: Origem;
  visitorId?: string | null;
  leadId?: string | null;
  utmSource?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
}

/** Registra um passo do funil; falha em silêncio (contar não pode atrapalhar quem baixa). */
export async function recordMaterialEvent(input: MaterialEventInput): Promise<void> {
  await getAdminClient()
    .from("product_material_events")
    .insert({
      product: input.product,
      event: input.event,
      source: input.source,
      visitor_id: uuidOuNulo(input.visitorId),
      lead_id: uuidOuNulo(input.leadId),
      utm_source: corta(input.utmSource, 80),
      referrer: corta(input.referrer, 300),
      user_agent: corta(input.userAgent, 300),
    })
    .then(
      () => undefined,
      () => undefined
    );
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

function limparRespostas(answers: RespostasQualificacao | undefined): RespostasQualificacao {
  return Object.fromEntries(Object.entries(answers ?? {}).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 40)]));
}

export interface LeadInput {
  recipientId?: string | null;
  source?: Origem | null;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  phone?: string | null;
  answers: RespostasQualificacao;
  visitorId?: string | null;
  utmSource?: string | null;
  userAgent?: string | null;
}

/** Fluxo do e-mail (e quem prefere responder tudo de uma vez): 5 perguntas + dados, já qualificado. */
export async function saveLead6x1(input: LeadInput): Promise<{ id: string; temperature: Temperatura; wantsContact: boolean }> {
  const answers = limparRespostas(input.answers);
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
  const source: Origem = recipientId ? "email" : input.source ?? "direto";
  const { data: row, error } = await admin
    .from("product_lead_responses")
    .insert({
      product: PRODUTO_6X1,
      campaign_id: campaignId,
      recipient_id: recipientId,
      contact_id: contactId,
      name: name?.slice(0, 160) ?? null,
      email: email.slice(0, 200),
      company: company?.slice(0, 200) ?? null,
      phone: normalizarTelefone(input.phone) ?? (input.phone?.trim().slice(0, 40) || null),
      answers,
      score: result.pontos,
      temperature: result.temperatura,
      reason: result.motivo,
      source,
      visitor_id: uuidOuNulo(input.visitorId),
      utm_source: corta(input.utmSource, 80),
      qualified_at: new Date().toISOString(),
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error("Não foi possível registrar suas respostas. Tente de novo.");

  const id = row.id as string;
  const base = { product: PRODUTO_6X1, source, visitorId: input.visitorId, leadId: id, utmSource: input.utmSource, userAgent: input.userAgent };
  await recordMaterialEvent({ ...base, event: "lead" });
  await recordMaterialEvent({ ...base, event: "qualificacao" });
  return { id, temperature: result.temperatura, wantsContact: answers.contato === "sim" };
}

export interface QuickLeadInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  profile?: string | null;
  source?: Origem | null;
  visitorId?: string | null;
  utmSource?: string | null;
  userAgent?: string | null;
}

/** Fluxo curto (Linktree/Instagram e outros canais): nome, WhatsApp, e-mail e "Você é:" liberam o PDF. */
export async function saveQuickLead6x1(input: QuickLeadInput): Promise<{ id: string; profile: Perfil }> {
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = normalizarTelefone(input.phone);
  if (name.length < 2) throw new Error("Informe seu nome.");
  if (!phone) throw new Error("Informe um WhatsApp com DDD.");
  if (!EMAIL_RE.test(email)) throw new Error("Informe um e-mail válido.");
  if (!ehPerfil(input.profile)) throw new Error("Escolha uma opção em \"Você é\".");

  const source: Origem = input.source ?? "direto";
  const { data: row, error } = await getAdminClient()
    .from("product_lead_responses")
    .insert({
      product: PRODUTO_6X1,
      name: name.slice(0, 160),
      email: email.slice(0, 200),
      phone,
      profile: input.profile,
      answers: {},
      source,
      visitor_id: uuidOuNulo(input.visitorId),
      utm_source: corta(input.utmSource, 80),
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error("Não foi possível registrar seus dados. Tente de novo.");

  const id = row.id as string;
  await recordMaterialEvent({
    product: PRODUTO_6X1,
    event: "lead",
    source,
    visitorId: input.visitorId,
    leadId: id,
    utmSource: input.utmSource,
    userAgent: input.userAgent,
  });
  return { id, profile: input.profile };
}

/** As 5 perguntas respondidas depois do download (opcional): classifica o lead que já existe. */
export async function qualifyLead6x1(input: {
  leadId?: string | null;
  visitorId?: string | null;
  answers: RespostasQualificacao;
}): Promise<{ temperature: Temperatura; wantsContact: boolean }> {
  const leadId = uuidOuNulo(input.leadId);
  if (!leadId) throw new Error("Não encontramos seu cadastro. Recarregue a página e tente de novo.");
  const answers = limparRespostas(input.answers);
  const invalid = validarRespostas(answers);
  if (invalid) throw new Error(invalid);

  const admin = getAdminClient();
  const { data: lead } = await admin.from("product_lead_responses").select("id, source, visitor_id, utm_source").eq("id", leadId).maybeSingle();
  // Só quem criou o cadastro (mesmo navegador) pode completar as respostas.
  if (!lead || (lead.visitor_id && lead.visitor_id !== uuidOuNulo(input.visitorId))) {
    throw new Error("Não encontramos seu cadastro. Recarregue a página e tente de novo.");
  }

  const result = classificarLead(answers);
  const { error } = await admin
    .from("product_lead_responses")
    .update({
      answers,
      score: result.pontos,
      temperature: result.temperatura,
      reason: result.motivo,
      qualified_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw new Error("Não foi possível registrar suas respostas. Tente de novo.");

  await recordMaterialEvent({
    product: PRODUTO_6X1,
    event: "qualificacao",
    source: lead.source as Origem,
    visitorId: input.visitorId,
    leadId,
    utmSource: lead.utm_source as string | null,
  });
  return { temperature: result.temperatura, wantsContact: answers.contato === "sim" };
}

/** Conta o download (no lead e no funil) antes de abrir o PDF. */
export async function registerDownload6x1(input: { leadId?: string | null; visitorId?: string | null; userAgent?: string | null }) {
  const admin = getAdminClient();
  const leadId = uuidOuNulo(input.leadId);
  let source: Origem = "direto";
  let utmSource: string | null = null;
  if (leadId) {
    const { data: lead } = await admin
      .from("product_lead_responses")
      .select("source, utm_source, download_count, first_download_at")
      .eq("id", leadId)
      .maybeSingle();
    if (lead) {
      source = lead.source as Origem;
      utmSource = (lead.utm_source as string | null) ?? null;
      const now = new Date().toISOString();
      await admin
        .from("product_lead_responses")
        .update({
          download_count: ((lead.download_count as number) ?? 0) + 1,
          first_download_at: (lead.first_download_at as string | null) ?? now,
          last_download_at: now,
        })
        .eq("id", leadId);
    }
  }
  await recordMaterialEvent({
    product: PRODUTO_6X1,
    event: "download",
    source,
    visitorId: input.visitorId,
    leadId,
    utmSource,
    userAgent: input.userAgent,
  });
}
