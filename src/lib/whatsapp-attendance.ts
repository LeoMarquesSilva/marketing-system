import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isAdminRole } from "@/lib/access-control";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const TRAFEGO_PAGO_KEY = "/trafego-pago";

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/** Pessoa que pode ser responsável por uma conversa do WhatsApp. */
export interface WhatsappAgent {
  id: string;
  name: string;
  avatar_url: string | null;
}

/** `users.id` (não o auth_id) de quem está logado. */
export async function appUserIdForAuth(authId: string): Promise<string | null> {
  const { data } = await getAdminClient()
    .from("users")
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Quem atende o WhatsApp: ativos com acesso explícito ao Tráfego pago ou admins.
 * Quem está pedindo a lista entra sempre, para poder assumir a conversa.
 */
export async function fetchWhatsappAgents(requesterUserId: string | null): Promise<WhatsappAgent[]> {
  const { data, error } = await getAdminClient()
    .from("users")
    .select("id, name, avatar_url, role, permissions, is_active")
    .or("is_active.eq.true,is_active.is.null")
    .order("name");
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter(
      (user) =>
        user.id === requesterUserId ||
        isAdminRole(user) ||
        (user.permissions as string[] | null)?.includes(TRAFEGO_PAGO_KEY)
    )
    .map((user) => ({
      id: user.id as string,
      name: (user.name as string | null)?.trim() || "Sem nome",
      avatar_url: (user.avatar_url as string | null) ?? null,
    }));
}

/** Primeiro a responder vira responsável, se a conversa ainda não tem um. */
export async function assignWhatsappConversationIfUnowned(
  conversationId: string,
  userId: string
): Promise<void> {
  await getAdminClient()
    .from("whatsapp_conversations")
    .update({ owner_user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .is("owner_user_id", null);
}

/** Zera as não lidas de uma conversa resolvida (ela sai do badge do menu). */
export async function clearWhatsappConversationUnread(conversationId: string): Promise<void> {
  await getAdminClient()
    .from("whatsapp_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
}

/**
 * Resolve de uma vez as conversas sem mensagem há mais de `days` dias. Se o
 * cliente voltar a escrever, o webhook reabre a conversa sozinho.
 */
export async function resolveStaleWhatsappConversations(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getAdminClient()
    .from("whatsapp_conversations")
    .update({
      attendance_status: "resolvido",
      unread_count: 0,
      updated_at: new Date().toISOString(),
    })
    .neq("attendance_status", "resolvido")
    .lt("last_message_at", cutoff)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
