import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isAdminRole } from "@/lib/access-control";
import {
  isQuickReplyCategory,
  normalizeShortcut,
  quickReplyCategoryLabel,
  type QuickReply,
  type QuickReplyCategory,
} from "@/lib/whatsapp-quick-replies";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const TRAFEGO_PAGO_KEY = "/trafego-pago";
const COLUMNS = "id, shortcut, title, category, body, sort_order, use_count";

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export class QuickReplyError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function listQuickReplies(): Promise<QuickReply[]> {
  const { data, error } = await getAdminClient()
    .from("whatsapp_quick_replies")
    .select(COLUMNS)
    .eq("active", true)
    .order("category")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as QuickReply[];
}

/** Quem está logado e se pode mexer nas respostas: admin ou com acesso ao Tráfego pago. */
export async function quickReplyEditor(authId: string): Promise<{ userId: string | null; canManage: boolean }> {
  const { data } = await getAdminClient()
    .from("users")
    .select("id, role, permissions, is_active")
    .eq("auth_id", authId)
    .maybeSingle();
  if (!data || data.is_active === false) return { userId: null, canManage: false };
  const canManage =
    isAdminRole(data as { role?: string | null }) ||
    Boolean((data.permissions as string[] | null)?.includes(TRAFEGO_PAGO_KEY));
  return { userId: data.id as string, canManage };
}

export interface QuickReplyInput {
  shortcut?: unknown;
  title?: unknown;
  category?: unknown;
  body?: unknown;
}

function cleanInput(input: QuickReplyInput): { shortcut: string; title: string; category: QuickReplyCategory; body: string } {
  const shortcut = normalizeShortcut(typeof input.shortcut === "string" ? input.shortcut : "");
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 80) : "";
  const body = typeof input.body === "string" ? input.body.trim().slice(0, 2000) : "";
  const category = isQuickReplyCategory(input.category) ? input.category : "outros";
  if (!shortcut) throw new QuickReplyError("Defina um atalho, por exemplo: valor.");
  if (!title) throw new QuickReplyError("Dê um título para a resposta.");
  if (!body) throw new QuickReplyError("Escreva o texto da resposta.");
  return { shortcut, title, category, body };
}

async function assertShortcutFree(shortcut: string, exceptId?: string) {
  let query = getAdminClient()
    .from("whatsapp_quick_replies")
    .select("id")
    .eq("active", true)
    .eq("shortcut", shortcut);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query.limit(1);
  if (data && data.length > 0) throw new QuickReplyError(`Já existe uma resposta com o atalho /${shortcut}.`, 409);
}

export async function createQuickReply(input: QuickReplyInput, userId: string): Promise<QuickReply> {
  const clean = cleanInput(input);
  await assertShortcutFree(clean.shortcut);
  const db = getAdminClient();
  const { data: last } = await db
    .from("whatsapp_quick_replies")
    .select("sort_order")
    .eq("active", true)
    .eq("category", clean.category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("whatsapp_quick_replies")
    .insert({ ...clean, sort_order: ((last?.sort_order as number | undefined) ?? 0) + 10, created_by: userId, updated_by: userId })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as QuickReply;
}

export async function updateQuickReply(id: string, input: QuickReplyInput, userId: string): Promise<QuickReply> {
  const clean = cleanInput(input);
  await assertShortcutFree(clean.shortcut, id);
  const { data, error } = await getAdminClient()
    .from("whatsapp_quick_replies")
    .update({ ...clean, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("active", true)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new QuickReplyError("Resposta não encontrada.", 404);
  return data as QuickReply;
}

/** Sai da lista, mas fica no banco (o histórico de uso continua). */
export async function archiveQuickReply(id: string, userId: string): Promise<void> {
  const { error } = await getAdminClient()
    .from("whatsapp_quick_replies")
    .update({ active: false, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markQuickReplyUsed(id: string): Promise<void> {
  const { error } = await getAdminClient().rpc("whatsapp_quick_reply_used", { p_id: id });
  if (error) throw new Error(error.message);
}

/** As respostas prontas no formato que a IA lê, agrupadas por categoria. */
export function formatQuickRepliesForPrompt(replies: QuickReply[]): string {
  const byCategory = new Map<string, QuickReply[]>();
  for (const reply of replies) {
    const list = byCategory.get(reply.category) ?? [];
    list.push(reply);
    byCategory.set(reply.category, list);
  }
  return [...byCategory.entries()]
    .map(
      ([category, list]) =>
        `### ${quickReplyCategoryLabel(category)}\n${list
          .map((reply) => `- ${reply.title}: "${reply.body.replace(/\n+/g, " ")}"`)
          .join("\n")}`
    )
    .join("\n\n");
}
