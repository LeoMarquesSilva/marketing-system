import "server-only";

import { createClient } from "@supabase/supabase-js";
import { evolutionFetch, getEvolutionConfig } from "@/lib/evolution-whatsapp";
import {
  brazilPhoneVariants,
  isLeaderPosition,
  leadContactCard,
  normalizeBrazilPhone,
  sortForwardRecipients,
  type LeadForwardRecipient,
  type LeadForwardRecord,
} from "@/lib/whatsapp-lead-forward-format";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Tag que já marca conversas com gente do escritório na inbox. */
const TEAM_TAG = "Colaborador";

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Quem pode receber o lead: pessoas ativas com telefone profissional no perfil
 * (o mesmo do site). Cargo e área vêm do RH; liderança aparece primeiro.
 */
export async function fetchForwardRecipients(): Promise<LeadForwardRecipient[]> {
  const db = getAdminClient();
  const { data: profiles, error } = await db
    .from("professional_profiles")
    .select("user_id, professional_phone, photo_url")
    .not("user_id", "is", null)
    .not("professional_phone", "is", null);
  if (error) throw new Error(error.message);

  const phoneByUser = new Map<string, { phone: string; photo: string | null }>();
  for (const profile of profiles ?? []) {
    const phone = normalizeBrazilPhone(profile.professional_phone as string | null);
    if (phone) {
      phoneByUser.set(profile.user_id as string, {
        phone,
        photo: (profile.photo_url as string | null) ?? null,
      });
    }
  }
  const userIds = [...phoneByUser.keys()];
  if (userIds.length === 0) return [];

  const [{ data: users, error: usersError }, { data: employees }] = await Promise.all([
    db
      .from("users")
      .select("id, name, avatar_url, department, is_active, ferias_view_enabled")
      .in("id", userIds),
    db.from("hr_employees").select("user_id, position, department").in("user_id", userIds),
  ]);
  if (usersError) throw new Error(usersError.message);
  const employeeByUser = new Map(
    (employees ?? []).map((employee) => [employee.user_id as string, employee])
  );

  const recipients = (users ?? [])
    .filter((user) => user.is_active !== false)
    .map((user) => {
      const contact = phoneByUser.get(user.id as string)!;
      const employee = employeeByUser.get(user.id as string);
      const position = (employee?.position as string | null | undefined) ?? null;
      return {
        userId: user.id as string,
        name: (user.name as string | null)?.trim() || "Sem nome",
        avatarUrl: (user.avatar_url as string | null) ?? contact.photo,
        position,
        area:
          (employee?.department as string | null | undefined) ??
          (user.department as string | null) ??
          null,
        phone: contact.phone,
        isLeader: isLeaderPosition(position) || user.ferias_view_enabled === true,
      } satisfies LeadForwardRecipient;
    });
  return sortForwardRecipients(recipients);
}

/** Encaminhamentos anteriores desta conversa, do mais recente para o mais antigo. */
export async function fetchLeadForwards(conversationId: string): Promise<LeadForwardRecord[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("whatsapp_lead_forwards")
    .select("id, recipient_name, recipient_phone, created_at, sender:users!whatsapp_lead_forwards_sent_by_fkey(name)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const sender = row.sender as { name?: string | null } | { name?: string | null }[] | null;
    const senderName = Array.isArray(sender) ? sender[0]?.name : sender?.name;
    return {
      id: row.id as string,
      recipientName: (row.recipient_name as string | null) ?? null,
      recipientPhone: row.recipient_phone as string,
      sentByName: senderName ?? null,
      createdAt: row.created_at as string,
    };
  });
}

/** A Evolution responde 400 com `exists: false` quando o número não tem WhatsApp. */
function friendlyEvolutionError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('"exists":false')) {
    return new Error("Esse número não tem WhatsApp.");
  }
  return err instanceof Error ? err : new Error(message);
}

/**
 * Manda o resumo e, se pedido, o cartão de contato do lead pelo WhatsApp do
 * escritório. Com `recipientUserId`, o telefone sai do perfil da pessoa (não
 * do navegador); sem ele, vale o número digitado.
 */
export async function sendLeadForward(input: {
  conversationId: string;
  recipientUserId: string | null;
  recipientPhone: string | null;
  message: string;
  includeContact: boolean;
  sentBy: string | null;
}): Promise<{ recipientName: string | null; recipientPhone: string; contactSent: boolean }> {
  const config = getEvolutionConfig();
  if (!config) throw new Error("Evolution API não configurada.");
  const message = input.message.trim();
  if (!message) throw new Error("Escreva a mensagem que vai junto com o lead.");

  const db = getAdminClient();
  const { data: conversation, error } = await db
    .from("whatsapp_conversations")
    .select("id, push_name, phone, is_group, group_subject")
    .eq("id", input.conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!conversation) throw new Error("Conversa não encontrada.");

  let recipientName: string | null = null;
  let recipientPhone: string | null = null;
  if (input.recipientUserId) {
    const recipients = await fetchForwardRecipients();
    const recipient = recipients.find((r) => r.userId === input.recipientUserId);
    if (!recipient) throw new Error("Essa pessoa não tem telefone profissional cadastrado.");
    recipientName = recipient.name;
    recipientPhone = recipient.phone;
  } else {
    recipientPhone = normalizeBrazilPhone(input.recipientPhone);
    if (!recipientPhone) throw new Error("Confira o número: use DDD e telefone.");
  }

  try {
    await evolutionFetch(`/message/sendText/${config.instanceName}`, {
      method: "POST",
      body: { number: recipientPhone, text: message },
    });
  } catch (err) {
    throw friendlyEvolutionError(err);
  }

  let contactSent = false;
  const card =
    input.includeContact && !conversation.is_group
      ? leadContactCard((conversation.push_name as string | null) ?? "", conversation.phone as string | null)
      : null;
  if (card) {
    try {
      await evolutionFetch(`/message/sendContact/${config.instanceName}`, {
        method: "POST",
        body: { number: recipientPhone, contact: [card] },
      });
      contactSent = true;
    } catch (err) {
      // O resumo já foi; o telefone do lead está no texto.
      console.error("[lead-forward] cartão de contato:", err);
    }
  }

  const { error: insertError } = await db.from("whatsapp_lead_forwards").insert({
    conversation_id: input.conversationId,
    recipient_user_id: input.recipientUserId,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    message,
    contact_sent: contactSent,
    sent_by: input.sentBy,
  });
  if (insertError) console.error("[lead-forward] histórico:", insertError.message);

  return { recipientName, recipientPhone, contactSent };
}

/**
 * A conversa com quem recebeu o lead aparece na inbox quando o webhook registra
 * o envio; marcada como Colaborador, ela não dispara aviso de lead quando a
 * pessoa responder. Tenta algumas vezes porque o webhook chega logo depois.
 */
export async function tagTeamConversation(phone: string): Promise<void> {
  const db = getAdminClient();
  const variants = brazilPhoneVariants(phone);
  if (variants.length === 0) return;
  for (const waitMs of [1500, 4000, 8000]) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const { data } = await db
      .from("whatsapp_conversations")
      .select("id, tags")
      .in("phone", variants)
      .or("is_group.is.null,is_group.eq.false")
      .limit(1)
      .maybeSingle();
    if (!data) continue;
    const tags = (data.tags as string[] | null) ?? [];
    if (tags.some((tag) => tag.toLowerCase() === TEAM_TAG.toLowerCase())) return;
    await db
      .from("whatsapp_conversations")
      .update({ tags: [...tags, TEAM_TAG] })
      .eq("id", data.id);
    return;
  }
}
