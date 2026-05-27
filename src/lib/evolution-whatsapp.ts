import { createClient } from "@supabase/supabase-js";
import { jidToPhone } from "@/lib/evolution-display";
import {
  extractMetaWhatsappAttribution,
  isMetaAdLeadFromAttribution,
  type MetaWhatsappAttribution,
} from "@/lib/evolution-meta-attribution";
import { isMetaAdLeadMessage, META_AD_LEAD_TAG } from "@/lib/evolution-leads";
import {
  buildEvolutionQuotedPayload,
  extractQuotedMessage,
  extractReactionUpdate,
  extractWhatsappMessageText,
  isPlaceholderWhatsappBody,
  mapEvolutionAckStatus,
  type WaMessageStatus,
} from "@/lib/evolution-message-meta";
import { normalizeWhatsappTags } from "@/lib/evolution-tags";

export { formatConversationLabel, formatPhoneDisplay, jidToPhone } from "@/lib/evolution-display";
export { normalizeWhatsappTags, WHATSAPP_TAG_PRESETS } from "@/lib/evolution-tags";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim().replace(/\r$/, "");
    if (value) return value;
  }
  return "";
}

export function getEvolutionConfig(): EvolutionConfig | null {
  const baseUrl = readEnv("EVOLUTION_API_URL", "NEXT_APP_EVOLUTION_BASE_URL").replace(
    /\/$/,
    ""
  );
  const apiKey = readEnv("EVOLUTION_API_KEY", "NEXT_APP_EVOLUTION_API_KEY");
  const instanceName = readEnv("EVOLUTION_INSTANCE", "NEXT_APP_EVOLUTION_INSTANCE");
  if (!baseUrl || !apiKey || !instanceName) return null;
  return { baseUrl, apiKey, instanceName };
}

export function isEvolutionConfigured(): boolean {
  return getEvolutionConfig() !== null;
}

/** Nomes da instância (celular conectado) — nunca usar como nome do lead. */
function getBlockedInstancePushNames(): Set<string> {
  const fromEnv = readEnv("EVOLUTION_INSTANCE_PUSH_NAME")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const defaults = ["bismarchi pires sociedade de advogados"];
  return new Set([...defaults, ...fromEnv]);
}

export function isBlockedInstancePushName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const normalized = name.trim().toLowerCase();
  const blocked = getBlockedInstancePushNames();
  if (blocked.has(normalized)) return true;
  for (const entry of blocked) {
    if (normalized.includes(entry) || entry.includes(normalized)) return true;
  }
  return false;
}

/** pushName só vale em mensagens recebidas do lead (Evolution envia nome da instância em fromMe). */
export function contactPushNameFromMessage(msg: {
  fromMe: boolean;
  pushName: string | null;
}): string | null {
  if (msg.fromMe) return null;
  const name = msg.pushName?.trim();
  if (!name || isBlockedInstancePushName(name)) return null;
  return name;
}

export interface ParsedEvolutionMessage {
  waMessageId: string;
  remoteJid: string;
  phone: string | null;
  pushName: string | null;
  fromMe: boolean;
  messageType: string;
  body: string;
  messageTimestamp: Date;
  instanceName: string;
  metaAttribution?: MetaWhatsappAttribution | null;
  quotedWaMessageId?: string | null;
  quotedBody?: string | null;
  isReaction?: boolean;
  reactionTargetId?: string | null;
  reactionEmoji?: string | null;
}

function phoneVariants(phone: string | null | undefined): string[] {
  if (!phone) return [];
  const d = phone.replace(/\D/g, "");
  if (!d) return [];
  const set = new Set<string>([d]);
  if (d.startsWith("55") && d.length > 11) set.add(d.slice(2));
  if (!d.startsWith("55") && d.length >= 10) set.add(`55${d}`);
  return [...set];
}

const CONV_SELECT =
  "id, unread_count, push_name, phone, lead_source, tags, meta_ad_id, meta_ad_title, meta_campaign_name, last_message_at, remote_jid";

async function findConversationForMessage(
  supabase: ReturnType<typeof getAdminClient>,
  instanceName: string,
  remoteJid: string,
  phone: string | null
): Promise<Record<string, unknown> | null> {
  const { data: byJid } = await supabase
    .from("whatsapp_conversations")
    .select(CONV_SELECT)
    .eq("instance_name", instanceName)
    .eq("remote_jid", remoteJid)
    .maybeSingle();
  if (byJid) return byJid as Record<string, unknown>;

  const variants = phone
    ? phoneVariants(phone)
    : phoneVariants(jidToPhone(remoteJid));
  for (const p of variants) {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select(CONV_SELECT)
      .eq("instance_name", instanceName)
      .eq("phone", p)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  return null;
}

function extractMessageText(message: Record<string, unknown> | undefined): string {
  return extractWhatsappMessageText(message);
}

function parseMessageTimestamp(tsRaw: unknown): Date {
  const tsNum =
    typeof tsRaw === "number"
      ? tsRaw
      : typeof tsRaw === "string"
        ? parseInt(tsRaw, 10)
        : Date.now() / 1000;
  const ms = Number.isFinite(tsNum)
    ? tsNum > 1_000_000_000_000
      ? tsNum
      : tsNum * 1000
    : Date.now();
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseSingleMessage(
  item: Record<string, unknown>,
  instanceName: string
): ParsedEvolutionMessage | null {
  const key = item.key as
    | { remoteJid?: string; fromMe?: boolean; id?: string }
    | undefined;
  if (!key?.remoteJid || !key.id) return null;

  const remoteJid = key.remoteJid;
  if (remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") {
    return null;
  }

  const message = item.message as Record<string, unknown> | undefined;
  const messageTimestamp = parseMessageTimestamp(
    item.messageTimestamp ?? item.timestamp
  );

  const fromMe = Boolean(key.fromMe);
  const reaction = extractReactionUpdate(message);
  if (reaction.targetWaMessageId) {
    return {
      waMessageId: key.id,
      remoteJid,
      phone: jidToPhone(remoteJid),
      pushName: fromMe ? null : ((item.pushName as string | undefined) ?? null),
      fromMe,
      messageType: "reactionMessage",
      body: reaction.emoji ?? "👍",
      messageTimestamp,
      instanceName,
      metaAttribution: null,
      isReaction: true,
      reactionTargetId: reaction.targetWaMessageId,
      reactionEmoji: reaction.emoji,
    };
  }

  const { quotedWaMessageId, quotedBody } = extractQuotedMessage(message);

  return {
    waMessageId: key.id,
    remoteJid,
    phone: jidToPhone(remoteJid),
    pushName: fromMe ? null : ((item.pushName as string | undefined) ?? null),
    fromMe,
    messageType: (item.messageType as string | undefined) ?? "unknown",
    body: extractMessageText(message),
    messageTimestamp,
    instanceName,
    metaAttribution: extractMetaWhatsappAttribution(message),
    quotedWaMessageId,
    quotedBody,
  };
}

/** Eventos de mensagem suportados pela Evolution (doc v2). */
export const EVOLUTION_MESSAGE_EVENTS = [
  "MESSAGES_UPSERT",
  "SEND_MESSAGE",
  "MESSAGES_UPDATE",
] as const;

export function normalizeEvolutionEvent(raw: string): string {
  return raw.trim().toUpperCase().replace(/\./g, "_").replace(/-/g, "_");
}

export function resolveEvolutionWebhookEvent(
  payload: Record<string, unknown>,
  pathEvent?: string
): string {
  const fromPayload = payload.event;
  if (typeof fromPayload === "string" && fromPayload.trim()) {
    return normalizeEvolutionEvent(fromPayload);
  }
  if (pathEvent?.trim()) {
    return normalizeEvolutionEvent(pathEvent);
  }
  return "";
}

export function isEvolutionMessageEvent(event: string): boolean {
  const normalized = normalizeEvolutionEvent(event);
  return (EVOLUTION_MESSAGE_EVENTS as readonly string[]).includes(normalized);
}

/** Normaliza payload do webhook Evolution (messages.upsert, send.message, etc.). */
export function parseEvolutionWebhookPayload(
  payload: Record<string, unknown>
): ParsedEvolutionMessage[] {
  const instanceName =
    (payload.instance as string | undefined) ??
    getEvolutionConfig()?.instanceName ??
    "BP";

  const data = payload.data;
  const items: Record<string, unknown>[] = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : data && typeof data === "object"
      ? [data as Record<string, unknown>]
      : [];

  const parsed: ParsedEvolutionMessage[] = [];
  for (const item of items) {
    const msg = parseSingleMessage(item, instanceName);
    if (msg) parsed.push(msg);
  }
  return parsed;
}

export function getSupabaseEvolutionWebhookUrl(): string | null {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  if (!supabaseUrl || supabaseUrl.includes("placeholder")) return null;
  return `${supabaseUrl}/functions/v1/evolution-webhook`;
}

/** URL que a Evolution deve chamar — preferência: Edge Function Supabase. */
export function getEvolutionWebhookReceiveUrl(): string | null {
  const supabaseUrl = getSupabaseEvolutionWebhookUrl();
  if (supabaseUrl) return supabaseUrl;
  const marketingBase = getMarketingPublicUrl()?.replace(/\/$/, "");
  if (marketingBase) return `${marketingBase}/api/evolution/webhook`;
  return null;
}

export function getMarketingPublicUrl(): string | null {
  const url = readEnv("MARKETING_PUBLIC_URL", "NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  return url || null;
}

export async function configureEvolutionMarketingWebhook(
  webhookUrlOverride?: string
): Promise<{ webhookUrl: string; events: string[]; target: "supabase" | "nextjs" }> {
  const config = getEvolutionConfig();
  if (!config) throw new Error("Evolution API não configurada.");

  const supabaseUrl = getSupabaseEvolutionWebhookUrl();
  const marketingBase = getMarketingPublicUrl()?.replace(/\/$/, "");
  const webhookUrl =
    webhookUrlOverride ??
    supabaseUrl ??
    (marketingBase ? `${marketingBase}/api/evolution/webhook` : null);

  if (!webhookUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL não configurada (Edge Function) e MARKETING_PUBLIC_URL ausente."
    );
  }

  const target: "supabase" | "nextjs" = webhookUrl.includes("/functions/v1/")
    ? "supabase"
    : "nextjs";
  const events = [...EVOLUTION_MESSAGE_EVENTS];

  await evolutionFetch(`/webhook/set/${config.instanceName}`, {
    method: "POST",
    body: {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events,
      },
    },
  });

  return { webhookUrl, events, target };
}

export async function fetchEvolutionWebhookConfig(): Promise<{
  enabled: boolean;
  url: string;
  webhookByEvents: boolean;
  events: string[];
} | null> {
  const config = getEvolutionConfig();
  if (!config) return null;

  const data = await evolutionFetch<{
    enabled?: boolean;
    url?: string;
    webhookByEvents?: boolean;
    events?: string[];
  }>(`/webhook/find/${config.instanceName}`);

  return {
    enabled: Boolean(data.enabled),
    url: data.url ?? "",
    webhookByEvents: Boolean(data.webhookByEvents),
    events: data.events ?? [],
  };
}

export async function processEvolutionWebhookPayload(
  payload: Record<string, unknown>,
  options?: { pathEvent?: string }
): Promise<
  | { ok: true; event: string; received: number; stored: number }
  | { ok: true; skipped: string }
> {
  const event = resolveEvolutionWebhookEvent(payload, options?.pathEvent);

  if (event && !isEvolutionMessageEvent(event)) {
    return { ok: true, skipped: event };
  }

  const messages = parseEvolutionWebhookPayload(payload);
  if (messages.length === 0) {
    return { ok: true, event: event || "UNKNOWN", received: 0, stored: 0 };
  }

  const result = await upsertEvolutionMessages(messages, payload);
  return {
    ok: true,
    event: event || "MESSAGES_UPSERT",
    received: messages.length,
    stored: result.inserted,
  };
}

export async function processEvolutionWebhookRequest(
  request: Request,
  pathEvent?: string
): Promise<Response> {
  const { NextResponse } = await import("next/server");
  const startedAt = Date.now();
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  async function auditWebhook(data: {
    event: string;
    received: number;
    stored: number;
    status: "ok" | "error";
    errorMessage?: string;
  }) {
    try {
      const supabase = getAdminClient();
      await supabase.from("whatsapp_webhook_events").insert({
        source: "nextjs",
        event_name: data.event,
        received_count: data.received,
        stored_count: data.stored,
        status: data.status,
        error_message: data.errorMessage ?? null,
        latency_ms: Date.now() - startedAt,
        processed_at: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }
  }

  try {
    if (!verifyEvolutionWebhook(request)) {
      await auditWebhook({
        event: pathEvent ? normalizeEvolutionEvent(pathEvent) : "UNKNOWN",
        received: 0,
        stored: 0,
        status: "error",
        errorMessage: "Não autorizado",
      });
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const result = await processEvolutionWebhookPayload(payload, { pathEvent });

    if ("skipped" in result) {
      await auditWebhook({
        event: result.skipped,
        received: 0,
        stored: 0,
        status: "ok",
      });
      return NextResponse.json({ ok: true, skipped: result.skipped });
    }

    await auditWebhook({
      event: result.event,
      received: result.received,
      stored: result.stored,
      status: "ok",
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro no webhook.";
    console.error("[evolution/webhook]", msg);
    await auditWebhook({
      event: pathEvent ? normalizeEvolutionEvent(pathEvent) : "UNKNOWN",
      received: 0,
      stored: 0,
      status: "error",
      errorMessage: msg,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export function verifyEvolutionWebhook(request: Request): boolean {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Em produção, nunca aceitar webhook sem segredo compartilhado.
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  const headerKey =
    request.headers.get("apikey") ??
    request.headers.get("x-evolution-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return headerKey === secret;
}

export async function evolutionFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const config = getEvolutionConfig();
  if (!config) throw new Error("Evolution API não configurada.");

  const attemptLimit = 3;
  let lastError: Error | null = null;
  let res: Response | null = null;
  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      res = await fetch(`${config.baseUrl}${path}`, {
        method: options?.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.status >= 500 || res.status === 429) {
        if (attempt < attemptLimit) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          continue;
        }
      }
      break;
    } catch (error) {
      clearTimeout(timeout);
      lastError =
        error instanceof Error ? error : new Error("Erro de conexão com Evolution API.");
      if (attempt < attemptLimit) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        continue;
      }
    }
  }

  if (!res) {
    throw lastError ?? new Error("Evolution API indisponível.");
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const responseMsg = (json as { response?: { message?: unknown } }).response?.message;
    const detail =
      responseMsg != null
        ? typeof responseMsg === "string"
          ? responseMsg
          : JSON.stringify(responseMsg)
        : null;
    const msg =
      detail ??
      (json as { message?: string }).message ??
      (json as { error?: string }).error ??
      `Evolution API erro ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

/** Busca mensagens recentes na Evolution (sync sem depender de webhook). */
export async function fetchEvolutionRecentMessages(options?: {
  limit?: number;
  maxPages?: number;
  inboundOnly?: boolean;
}): Promise<ParsedEvolutionMessage[]> {
  const config = getEvolutionConfig();
  if (!config) return [];

  const target = options?.limit ?? 50;
  const maxPages = options?.maxPages ?? 5;
  const inboundOnly = options?.inboundOnly ?? true;

  const parsed: ParsedEvolutionMessage[] = [];

  for (let page = 1; page <= maxPages && parsed.length < target; page += 1) {
    const data = await evolutionFetch<{
      messages?: { records?: Record<string, unknown>[] };
    }>(`/chat/findMessages/${config.instanceName}`, {
      method: "POST",
      body: { limit: 50, page },
    });

    const records = data.messages?.records ?? [];
    if (records.length === 0) break;

    for (const item of records) {
      const msg = parseSingleMessage(item, config.instanceName);
      if (!msg) continue;
      if (inboundOnly && msg.fromMe) continue;
      parsed.push(msg);
      if (parsed.length >= target) break;
    }
  }

  return parsed;
}

/** Histórico de um chat específico (inclui mensagens enviadas pelo celular). */
export async function fetchEvolutionChatMessages(
  remoteJid: string,
  options?: { limit?: number; maxPages?: number }
): Promise<ParsedEvolutionMessage[]> {
  const config = getEvolutionConfig();
  if (!config) return [];

  const target = options?.limit ?? 120;
  const maxPages = options?.maxPages ?? 12;
  const parsed: ParsedEvolutionMessage[] = [];

  for (let page = 1; page <= maxPages && parsed.length < target; page += 1) {
    const data = await evolutionFetch<{
      messages?: { records?: Record<string, unknown>[] };
    }>(`/chat/findMessages/${config.instanceName}`, {
      method: "POST",
      body: {
        where: { key: { remoteJid } },
        page,
        limit: 50,
      },
    });

    const records = data.messages?.records ?? [];
    if (records.length === 0) break;

    for (const item of records) {
      const msg = parseSingleMessage(item, config.instanceName);
      if (!msg) continue;
      parsed.push(msg);
      if (parsed.length >= target) break;
    }
  }

  return parsed;
}

export async function fetchEvolutionContactPushName(
  remoteJid: string,
  phone: string | null
): Promise<string | null> {
  const config = getEvolutionConfig();
  if (!config) return null;

  const number =
    phone?.replace(/\D/g, "") ||
    remoteJid.split("@")[0]?.replace(/\D/g, "") ||
    remoteJid;

  try {
    const data = await evolutionFetch<
      | Array<{ pushName?: string; name?: string }>
      | { contacts?: Array<{ pushName?: string; name?: string }> }
    >(`/chat/findContacts/${config.instanceName}`, {
      method: "POST",
      body: { where: { remoteJid } },
    });
    const list = Array.isArray(data) ? data : (data.contacts ?? []);
    for (const contact of list) {
      const name = (contact.pushName ?? contact.name)?.trim();
      if (name && !isBlockedInstancePushName(name)) return name;
    }
  } catch {
    /* tenta fetchProfile */
  }

  try {
    const profile = await evolutionFetch<{
      name?: string;
      pushname?: string;
      wuid?: string;
    }>(`/chat/fetchProfile/${config.instanceName}`, {
      method: "POST",
      body: { number },
    });
    const name = (profile.name ?? profile.pushname)?.trim();
    if (name && !isBlockedInstancePushName(name)) return name;
  } catch {
    /* ignore */
  }

  return null;
}

export async function refreshConversationPushName(
  conversationId: string
): Promise<string | null> {
  const supabase = getAdminClient();
  const { data: conv, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, remote_jid, phone, push_name")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !conv) return null;

  const current = conv.push_name as string | null;
  if (current?.trim() && !isBlockedInstancePushName(current)) {
    return current;
  }

  const name = await fetchEvolutionContactPushName(
    conv.remote_jid as string,
    conv.phone as string | null
  );
  if (!name) return current;

  await supabase
    .from("whatsapp_conversations")
    .update({
      push_name: name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return name;
}

/** Sincroniza histórico de uma conversa (entrada + saída) da Evolution. */
export async function syncConversationMessages(
  conversationId: string,
  options?: { limit?: number }
): Promise<{ fetched: number; stored: number }> {
  const supabase = getAdminClient();
  const { data: conv, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, remote_jid, push_name")
    .eq("id", conversationId)
    .single();

  if (error || !conv) throw new Error("Conversa não encontrada.");

  const messages = await fetchEvolutionChatMessages(conv.remote_jid as string, {
    limit: options?.limit ?? 120,
  });
  const result = await upsertEvolutionMessages(messages, { skipUnreadIncrement: true });

  if (!conv.push_name || isBlockedInstancePushName(conv.push_name as string)) {
    void refreshConversationPushName(conversationId);
  }

  return { fetched: messages.length, stored: result.inserted };
}

/** Sincroniza mensagens recentes da Evolution para o Supabase. */
export async function syncEvolutionMessages(options?: {
  limit?: number;
}): Promise<{ fetched: number; stored: number }> {
  const messages = await fetchEvolutionRecentMessages({
    limit: options?.limit ?? 200,
    inboundOnly: false,
  });
  const result = await upsertEvolutionMessages(messages);
  return { fetched: messages.length, stored: result.inserted };
}

function metaLeadTags(existingTags: unknown): string[] {
  const tags = normalizeWhatsappTags(existingTags);
  const hasTag = tags.some((t) => t.toLowerCase() === META_AD_LEAD_TAG.toLowerCase());
  return hasTag ? tags : [...tags, META_AD_LEAD_TAG];
}

function isMetaLeadMessage(msg: ParsedEvolutionMessage): boolean {
  if (msg.fromMe) return false;
  return (
    isMetaAdLeadMessage(msg.body) ||
    isMetaAdLeadFromAttribution(msg.metaAttribution ?? null)
  );
}

function metaFieldsFromAttribution(
  attr: MetaWhatsappAttribution | null | undefined
): Record<string, string> {
  if (!attr) return {};
  const fields: Record<string, string> = {};
  if (attr.sourceId) fields.meta_ad_id = attr.sourceId;
  if (attr.title) fields.meta_ad_title = attr.title;
  if (attr.body) fields.meta_ad_body = attr.body;
  if (attr.sourceUrl) fields.meta_ad_source_url = attr.sourceUrl;
  if (attr.ctwaClid) fields.meta_ctwa_clid = attr.ctwaClid;
  if (attr.conversionApp) fields.meta_conversion_app = attr.conversionApp;
  return fields;
}

function buildMetaConversationPatch(
  msg: ParsedEvolutionMessage,
  existing?: {
    lead_source?: string | null;
    tags?: unknown;
    meta_ad_id?: string | null;
    meta_ad_title?: string | null;
    meta_campaign_name?: string | null;
  }
): Record<string, unknown> | null {
  const isLead = isMetaLeadMessage(msg);
  const attr = msg.metaAttribution;
  if (!isLead && !attr) return null;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (isLead && existing?.lead_source !== "meta_ads") {
    patch.lead_source = "meta_ads";
    patch.tags = metaLeadTags(existing?.tags);
  }

  if (attr) {
    if (attr.sourceId && !existing?.meta_ad_id) patch.meta_ad_id = attr.sourceId;
    if (attr.title && !existing?.meta_ad_title) patch.meta_ad_title = attr.title;
    if (attr.body) patch.meta_ad_body = attr.body;
    if (attr.sourceUrl) patch.meta_ad_source_url = attr.sourceUrl;
    if (attr.ctwaClid) patch.meta_ctwa_clid = attr.ctwaClid;
    if (attr.conversionApp) patch.meta_conversion_app = attr.conversionApp;
  }

  return Object.keys(patch).length > 1 ? patch : null;
}

async function enrichConversationMetaAdNames(
  conversationId: string,
  adId: string
): Promise<void> {
  try {
    const { fetchMetaAdSummary } = await import("@/lib/meta-ads");
    const summary = await fetchMetaAdSummary(adId);
    if (!summary) return;
    const supabase = getAdminClient();
    await supabase
      .from("whatsapp_conversations")
      .update({
        meta_campaign_name: summary.campaign_name || undefined,
        meta_adset_name: summary.adset_name || undefined,
        meta_ad_title: summary.ad_name || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  } catch (error) {
    console.error("[evolution/meta] falha ao enriquecer anúncio:", error);
  }
}

async function applyMetaLeadFromMessage(
  supabase: ReturnType<typeof getAdminClient>,
  conversationId: string,
  msg: ParsedEvolutionMessage,
  existing?: {
    lead_source?: string | null;
    tags?: unknown;
    meta_ad_id?: string | null;
    meta_ad_title?: string | null;
    meta_campaign_name?: string | null;
  }
): Promise<void> {
  const patch = buildMetaConversationPatch(msg, existing);
  if (!patch) return;

  await supabase
    .from("whatsapp_conversations")
    .update(patch)
    .eq("id", conversationId);

  const adId = patch.meta_ad_id as string | undefined;
  if (adId && !existing?.meta_campaign_name) {
    void enrichConversationMetaAdNames(conversationId, adId);
  }
}

export async function processEvolutionMessagesUpdate(
  payload: Record<string, unknown>
): Promise<number> {
  const config = getEvolutionConfig();
  const instanceName =
    (payload.instance as string | undefined) ?? config?.instanceName ?? "BP";
  const raw = payload.data;
  const items: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : raw && typeof raw === "object"
      ? [raw as Record<string, unknown>]
      : [];

  if (items.length === 0) return 0;
  const supabase = getAdminClient();
  let updated = 0;

  for (const item of items) {
    const key = item.key as { id?: string } | undefined;
    const patch = item.update as { status?: unknown } | undefined;
    const status = mapEvolutionAckStatus(
      patch?.status ?? item.status ?? (item as { ack?: unknown }).ack
    );
    if (!key?.id || !status) continue;

    const { error } = await supabase
      .from("whatsapp_messages")
      .update({ wa_status: status })
      .eq("instance_name", instanceName)
      .eq("wa_message_id", key.id);

    if (!error) updated += 1;
  }

  return updated;
}

export async function upsertEvolutionMessages(
  messages: ParsedEvolutionMessage[],
  options?: { skipUnreadIncrement?: boolean }
): Promise<{ inserted: number }> {
  if (messages.length === 0) return { inserted: 0 };
  const supabase = getAdminClient();
  const skipUnread = options?.skipUnreadIncrement ?? false;
  let inserted = 0;

  for (const msg of messages) {
    if (msg.isReaction && msg.reactionTargetId) {
      await supabase
        .from("whatsapp_messages")
        .update({
          reaction_emoji: msg.reactionEmoji || msg.body || "👍",
        })
        .eq("instance_name", msg.instanceName)
        .eq("wa_message_id", msg.reactionTargetId);
      continue;
    }

    const inboundName = contactPushNameFromMessage(msg);
    const { data: existingMsg } = await supabase
      .from("whatsapp_messages")
      .select("id, body")
      .eq("instance_name", msg.instanceName)
      .eq("wa_message_id", msg.waMessageId)
      .maybeSingle();

    if (existingMsg) {
      const existingBody = existingMsg.body as string | null | undefined;
      if (isPlaceholderWhatsappBody(existingBody) && !isPlaceholderWhatsappBody(msg.body)) {
        await supabase
          .from("whatsapp_messages")
          .update({
            body: msg.body,
            message_type: msg.messageType,
            quoted_wa_message_id: msg.quotedWaMessageId ?? null,
            quoted_body: msg.quotedBody ?? null,
          })
          .eq("id", existingMsg.id);
      }
      continue;
    }

    const preview = msg.body.slice(0, 280);
    const msgPhone = msg.phone ?? jidToPhone(msg.remoteJid);

    let existingConv = await findConversationForMessage(
      supabase,
      msg.instanceName,
      msg.remoteJid,
      msgPhone
    );

    let conversationId = existingConv?.id as string | undefined;
    const canonicalJid =
      (existingConv?.remote_jid as string | undefined) ?? msg.remoteJid;
    const isMetaLead = isMetaLeadMessage(msg);
    const metaFields = metaFieldsFromAttribution(msg.metaAttribution);

    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("whatsapp_conversations")
        .insert({
          remote_jid: msg.remoteJid,
          instance_name: msg.instanceName,
          phone: msgPhone,
          push_name: inboundName,
          last_message_at: msg.messageTimestamp.toISOString(),
          last_message_preview: null,
          last_inbound_at: msg.fromMe ? null : msg.messageTimestamp.toISOString(),
          unread_count: 0,
          lead_source: isMetaLead ? "meta_ads" : null,
          tags: isMetaLead ? [META_AD_LEAD_TAG] : [],
          ...metaFields,
        })
        .select("id")
        .single();
      if (error || !created) continue;
      conversationId = created.id;
      existingConv = { id: created.id, unread_count: 0, last_message_at: null };
      if (metaFields.meta_ad_id && conversationId) {
        void enrichConversationMetaAdNames(conversationId, metaFields.meta_ad_id);
      }
    } else if (msgPhone && !existingConv?.phone) {
      await supabase
        .from("whatsapp_conversations")
        .update({ phone: msgPhone, updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    const { error: msgError } = await supabase.from("whatsapp_messages").upsert(
      {
        conversation_id: conversationId,
        wa_message_id: msg.waMessageId,
        remote_jid: canonicalJid,
        from_me: msg.fromMe,
        message_type: msg.messageType,
        body: msg.body,
        message_timestamp: msg.messageTimestamp.toISOString(),
        instance_name: msg.instanceName,
        wa_status: msg.fromMe ? "sent" : null,
        quoted_wa_message_id: msg.quotedWaMessageId ?? null,
        quoted_body: msg.quotedBody ?? null,
        raw_payload: {
          key: {
            id: msg.waMessageId,
            remoteJid: canonicalJid,
            fromMe: msg.fromMe,
          },
        },
      },
      { onConflict: "instance_name,wa_message_id", ignoreDuplicates: true }
    );

    if (msgError) continue;

    inserted += 1;
    if (!conversationId) continue;

    const existingLastAt = existingConv?.last_message_at
      ? new Date(existingConv.last_message_at as string).getTime()
      : 0;
    const isNewer = msg.messageTimestamp.getTime() >= existingLastAt;

    const convUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (inboundName) {
      const existingName = existingConv?.push_name as string | null | undefined;
      if (!existingName?.trim() || isBlockedInstancePushName(existingName)) {
        convUpdate.push_name = inboundName;
      }
    }

    if (isNewer) {
      convUpdate.last_message_at = msg.messageTimestamp.toISOString();
      convUpdate.last_message_preview = preview;
      if (!msg.fromMe) {
        convUpdate.last_inbound_at = msg.messageTimestamp.toISOString();
      }
      if (!skipUnread && !msg.fromMe) {
        await supabase.rpc("increment_whatsapp_unread", {
          p_conversation_id: conversationId,
        });
      }
    }

    if (Object.keys(convUpdate).length > 1) {
      await supabase
        .from("whatsapp_conversations")
        .update(convUpdate)
        .eq("id", conversationId);
    }

    await applyMetaLeadFromMessage(
      supabase,
      conversationId,
      msg,
      existingConv as {
        lead_source?: string | null;
        tags?: unknown;
        meta_ad_id?: string | null;
        meta_ad_title?: string | null;
        meta_campaign_name?: string | null;
      }
    );
  }

  return { inserted };
}

export interface WhatsappConversation {
  id: string;
  remote_jid: string;
  phone: string | null;
  push_name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_inbound_at: string | null;
  unread_count: number;
  tags: string[];
  lead_source: string | null;
  avatar_url: string | null;
  meta_ad_id: string | null;
  meta_ad_title: string | null;
  meta_ad_body: string | null;
  meta_ad_source_url: string | null;
  meta_campaign_name: string | null;
  meta_adset_name: string | null;
  meta_ctwa_clid: string | null;
  meta_conversion_app: string | null;
  city: string | null;
  state: string | null;
  owner_user_id: string | null;
  pipeline_stage: string | null;
  qualification: Record<string, unknown> | null;
  notes: string | null;
  stage_updated_at: string | null;
}

/** Número/JID aceito pela Evolution para envio. */
export function resolveEvolutionRecipient(
  remoteJid: string,
  phone: string | null
): string {
  if (remoteJid && !remoteJid.endsWith("@g.us")) return remoteJid;
  if (phone) return phone.replace(/\D/g, "");
  throw new Error("Conversa sem destinatário válido para envio.");
}

export async function sendEvolutionPresence(
  conversationId: string,
  presence: "composing" | "recording" | "paused" | "available"
): Promise<void> {
  const config = getEvolutionConfig();
  if (!config) return;

  const supabase = getAdminClient();
  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("remote_jid, phone")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return;

  const recipient = resolveEvolutionRecipient(
    conversation.remote_jid as string,
    conversation.phone as string | null
  );

  try {
    await evolutionFetch(`/chat/sendPresence/${config.instanceName}`, {
      method: "POST",
      body: { number: recipient, presence, delay: 1200 },
    });
  } catch {
    /* best-effort */
  }
}

export async function sendEvolutionTextMessage(
  conversationId: string,
  text: string,
  options?: { quotedWaMessageId?: string; quotedBody?: string | null }
): Promise<WhatsappMessage> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Mensagem vazia.");

  const config = getEvolutionConfig();
  if (!config) throw new Error("Evolution API não configurada.");

  const supabase = getAdminClient();
  const { data: conversation, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, remote_jid, phone, instance_name")
    .eq("id", conversationId)
    .single();

  if (error || !conversation) {
    throw new Error("Conversa não encontrada.");
  }

  const recipient = resolveEvolutionRecipient(
    conversation.remote_jid,
    conversation.phone
  );

  const requestBody: Record<string, unknown> = {
    number: recipient,
    text: trimmed,
  };

  if (options?.quotedWaMessageId) {
    requestBody.quoted = buildEvolutionQuotedPayload(
      conversation.remote_jid,
      options.quotedWaMessageId,
      options.quotedBody ?? null
    );
  }

  const response = await evolutionFetch<Record<string, unknown>>(
    `/message/sendText/${config.instanceName}`,
    { method: "POST", body: requestBody }
  );

  const key = response.key as
    | { remoteJid?: string; fromMe?: boolean; id?: string }
    | undefined;
  const waMessageId = key?.id;
  const remoteJid = key?.remoteJid ?? conversation.remote_jid;
  const messageTimestamp = parseMessageTimestamp(response.messageTimestamp).toISOString();
  const preview = trimmed.slice(0, 280);

  if (!waMessageId) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: messageTimestamp,
        last_message_preview: preview,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
    return {
      id: `pending-${Date.now()}`,
      wa_message_id: null,
      from_me: true,
      message_type: "conversation",
      body: trimmed,
      message_timestamp: messageTimestamp,
      wa_status: "pending",
      quoted_wa_message_id: options?.quotedWaMessageId ?? null,
      quoted_body: options?.quotedBody ?? null,
    } as WhatsappMessage;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("whatsapp_messages")
    .upsert(
      {
        conversation_id: conversationId,
        wa_message_id: waMessageId,
        remote_jid: remoteJid,
        from_me: true,
        message_type: "conversation",
        body: trimmed,
        message_timestamp: messageTimestamp,
        instance_name: config.instanceName,
        wa_status: "sent",
        quoted_wa_message_id: options?.quotedWaMessageId ?? null,
        quoted_body: options?.quotedBody ?? null,
        raw_payload: response,
      },
      { onConflict: "instance_name,wa_message_id", ignoreDuplicates: false }
    )
    .select(
      "id, wa_message_id, from_me, message_type, body, message_timestamp, wa_status, quoted_wa_message_id, quoted_body"
    )
    .single();

  if (insertError || !inserted) {
    const { data: existing } = await supabase
      .from("whatsapp_messages")
      .select(
        "id, wa_message_id, from_me, message_type, body, message_timestamp, wa_status, quoted_wa_message_id, quoted_body"
      )
      .eq("instance_name", config.instanceName)
      .eq("wa_message_id", waMessageId)
      .maybeSingle();
    if (existing) return existing as WhatsappMessage;
    throw new Error(insertError?.message ?? "Erro ao salvar mensagem enviada.");
  }

  await supabase
    .from("whatsapp_conversations")
    .update({
      last_message_at: messageTimestamp,
      last_message_preview: preview,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return inserted as WhatsappMessage;
}

export async function sendEvolutionMediaMessage(
  conversationId: string,
  params: {
    mediatype: "image" | "video" | "document";
    mediaBase64: string;
    fileName?: string;
    caption?: string;
    quotedWaMessageId?: string;
    quotedBody?: string | null;
  }
): Promise<WhatsappMessage> {
  const config = getEvolutionConfig();
  if (!config) throw new Error("Evolution API não configurada.");

  const raw = params.mediaBase64.replace(/^data:[^;]+;base64,/, "").trim();
  if (!raw) throw new Error("Arquivo vazio.");

  const supabase = getAdminClient();
  const { data: conversation, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, remote_jid, phone")
    .eq("id", conversationId)
    .single();
  if (error || !conversation) throw new Error("Conversa não encontrada.");

  const recipient = resolveEvolutionRecipient(
    conversation.remote_jid,
    conversation.phone
  );

  const body: Record<string, unknown> = {
    number: recipient,
    mediatype: params.mediatype,
    media: raw,
    fileName: params.fileName,
    caption: params.caption,
  };
  if (params.quotedWaMessageId) {
    body.quoted = buildEvolutionQuotedPayload(
      conversation.remote_jid,
      params.quotedWaMessageId,
      params.quotedBody ?? null
    );
  }

  const response = await evolutionFetch<Record<string, unknown>>(
    `/message/sendMedia/${config.instanceName}`,
    { method: "POST", body }
  );

  const messageType =
    params.mediatype === "image"
      ? "imageMessage"
      : params.mediatype === "video"
        ? "videoMessage"
        : "documentMessage";

  return saveOutboundEvolutionMessage(
    supabase,
    conversationId,
    conversation.remote_jid,
    config.instanceName,
    { ...response, messageType },
    params.mediatype === "image"
      ? `[imagem] ${params.caption ?? ""}`.trim()
      : params.mediatype === "video"
        ? `[vídeo] ${params.caption ?? ""}`.trim()
        : `[documento] ${params.fileName ?? params.caption ?? ""}`.trim()
  );
}

async function saveOutboundEvolutionMessage(
  supabase: ReturnType<typeof getAdminClient>,
  conversationId: string,
  fallbackRemoteJid: string,
  instanceName: string,
  response: Record<string, unknown>,
  preview: string
): Promise<WhatsappMessage> {
  const key = response.key as { remoteJid?: string; id?: string } | undefined;
  const waMessageId = key?.id;
  const remoteJid = key?.remoteJid ?? fallbackRemoteJid;
  const messageTimestamp = parseMessageTimestamp(response.messageTimestamp).toISOString();

  if (!waMessageId) {
    return {
      id: `pending-${Date.now()}`,
      wa_message_id: null,
      from_me: true,
      message_type: "media",
      body: preview,
      message_timestamp: messageTimestamp,
      wa_status: "pending",
    } as WhatsappMessage;
  }

  const { data: inserted, error } = await supabase
    .from("whatsapp_messages")
    .upsert(
      {
        conversation_id: conversationId,
        wa_message_id: waMessageId,
        remote_jid: remoteJid,
        from_me: true,
        message_type: (response.messageType as string) ?? "media",
        body: preview,
        message_timestamp: messageTimestamp,
        instance_name: instanceName,
        wa_status: "sent",
        raw_payload: response,
      },
      { onConflict: "instance_name,wa_message_id", ignoreDuplicates: false }
    )
    .select(
      "id, wa_message_id, from_me, message_type, body, message_timestamp, wa_status"
    )
    .single();

  if (error || !inserted) throw new Error(error?.message ?? "Erro ao salvar mídia.");

  await supabase
    .from("whatsapp_conversations")
    .update({
      last_message_at: messageTimestamp,
      last_message_preview: preview.slice(0, 280),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return inserted as WhatsappMessage;
}

export async function updateWhatsappConversationTags(
  conversationId: string,
  tags: string[]
): Promise<WhatsappConversation> {
  const supabase = getAdminClient();
  const normalized = normalizeWhatsappTags(tags);

  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .update({
      tags: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Erro ao atualizar tags.");
  return {
    ...(data as WhatsappConversation),
    tags: normalizeWhatsappTags((data as WhatsappConversation).tags),
  };
}

export async function updateWhatsappConversationCrm(
  conversationId: string,
  patch: {
    city?: string | null;
    state?: string | null;
    owner_user_id?: string | null;
    pipeline_stage?: string | null;
    qualification?: Record<string, unknown> | null;
    notes?: string | null;
  }
): Promise<WhatsappConversation> {
  const supabase = getAdminClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) payload[key] = value;
  }
  if (patch.pipeline_stage !== undefined) {
    payload.stage_updated_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .update(payload)
    .eq("id", conversationId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Erro ao atualizar CRM da conversa.");
  }
  return {
    ...(data as WhatsappConversation),
    tags: normalizeWhatsappTags((data as WhatsappConversation).tags),
    lead_source: (data as WhatsappConversation).lead_source ?? null,
    avatar_url: (data as WhatsappConversation).avatar_url ?? null,
  };
}

export async function fetchWhatsappTagSuggestions(limit = 30): Promise<string[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("tags")
    .not("tags", "eq", "{}")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const row of data ?? []) {
    for (const tag of normalizeWhatsappTags(row.tags)) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(tag);
      if (suggestions.length >= limit) return suggestions.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
  }
  return suggestions.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export interface WhatsappMessage {
  id: string;
  wa_message_id: string | null;
  from_me: boolean;
  message_type: string | null;
  body: string | null;
  message_timestamp: string;
  audio_transcript?: string | null;
  wa_status?: string | null;
  reaction_emoji?: string | null;
  quoted_wa_message_id?: string | null;
  quoted_body?: string | null;
}

export async function fetchWhatsappUnreadSummary(): Promise<{
  totalUnread: number;
  conversationCount: number;
}> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("unread_count")
    .gt("unread_count", 0);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const totalUnread = rows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.unread_count) || 0),
    0
  );

  return { totalUnread, conversationCount: rows.length };
}

export async function fetchWhatsappConversations(
  limit = 50
): Promise<WhatsappConversation[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...(row as WhatsappConversation),
    tags: normalizeWhatsappTags((row as WhatsappConversation).tags),
    lead_source: (row as WhatsappConversation).lead_source ?? null,
    avatar_url: (row as WhatsappConversation).avatar_url ?? null,
  }));
}

export async function fetchEvolutionProfilePicture(
  remoteJid: string,
  phone: string | null
): Promise<string | null> {
  const config = getEvolutionConfig();
  if (!config) return null;

  const number =
    phone?.replace(/\D/g, "") ||
    remoteJid.split("@")[0]?.replace(/\D/g, "") ||
    remoteJid;

  try {
    const data = await evolutionFetch<{
      profilePictureUrl?: string;
      url?: string;
      picture?: string;
    }>(`/chat/fetchProfilePictureUrl/${config.instanceName}`, {
      method: "POST",
      body: { number },
    });
    return data.profilePictureUrl ?? data.url ?? data.picture ?? null;
  } catch {
    return null;
  }
}

export async function refreshConversationAvatar(
  conversationId: string,
  force = false
): Promise<string | null> {
  const supabase = getAdminClient();
  const { data: conv, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, remote_jid, phone, avatar_url")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !conv) return null;
  if (conv.avatar_url && !force) return conv.avatar_url as string;

  const url = await fetchEvolutionProfilePicture(
    conv.remote_jid as string,
    conv.phone as string | null
  );
  if (!url) return conv.avatar_url as string | null;

  await supabase
    .from("whatsapp_conversations")
    .update({
      avatar_url: url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return url;
}

/** Busca foto de perfil para conversas recentes sem avatar (best-effort). */
export async function refreshMissingConversationAvatars(limit = 5): Promise<void> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .is("avatar_url", null)
    .order("last_message_at", { ascending: false })
    .limit(limit);

  for (const row of data ?? []) {
    try {
      await refreshConversationAvatar(row.id as string);
    } catch {
      /* ignore */
    }
  }
}

function defaultMimetypeForMessage(
  messageType: string,
  body: string | null
): string {
  const t = messageType.toLowerCase();
  if (t.includes("image") || body?.toLowerCase().startsWith("[imagem]")) {
    return "image/jpeg";
  }
  if (t.includes("video") || body?.toLowerCase().startsWith("[vídeo]")) {
    return "video/mp4";
  }
  if (t.includes("document") || body?.toLowerCase().startsWith("[documento]")) {
    return "application/pdf";
  }
  return "audio/ogg; codecs=opus";
}

export async function fetchEvolutionMessageMedia(dbMessageId: string): Promise<{
  base64: string;
  mimetype: string;
  mediaType?: string;
}> {
  const config = getEvolutionConfig();
  if (!config) throw new Error("Evolution API não configurada.");

  const supabase = getAdminClient();
  const { data: msg, error } = await supabase
    .from("whatsapp_messages")
    .select("wa_message_id, remote_jid, from_me, message_type, body, raw_payload, instance_name")
    .eq("id", dbMessageId)
    .maybeSingle();

  if (error || !msg) throw new Error("Mensagem não encontrada.");

  const type = (msg.message_type as string | null)?.toLowerCase() ?? "";
  const body = (msg.body as string | null) ?? "";
  const isAudio = type.includes("audio") || type === "ptt" || body.trim() === "[áudio]";
  const isImage = type.includes("image") || body.toLowerCase().startsWith("[imagem]");
  const isVideo = type.includes("video") || body.toLowerCase().startsWith("[vídeo]");
  const isDocument =
    type.includes("document") || body.toLowerCase().startsWith("[documento]");

  if (!isAudio && !isImage && !isVideo && !isDocument) {
    throw new Error("Esta mensagem não contém mídia.");
  }

  const raw = msg.raw_payload as Record<string, unknown> | null;
  const rawKey = (raw?.key as Record<string, unknown> | undefined) ?? {};
  const key = {
    id: (rawKey.id as string | undefined) ?? msg.wa_message_id,
    remoteJid: (rawKey.remoteJid as string | undefined) ?? msg.remote_jid,
    fromMe: (rawKey.fromMe as boolean | undefined) ?? msg.from_me,
  };

  const data = await evolutionFetch<{
    base64?: string;
    mimetype?: string;
    mediaType?: string;
  }>(`/chat/getBase64FromMediaMessage/${config.instanceName}`, {
    method: "POST",
    body: {
      message: { key },
      convertToMp4: isVideo,
    },
  });

  if (!data.base64) {
    throw new Error(
      "Evolution não retornou a mídia. Verifique se DATABASE_SAVE_DATA_NEW_MESSAGE está ativo na instância BP."
    );
  }

  return {
    base64: data.base64,
    mimetype: data.mimetype ?? defaultMimetypeForMessage(type, body),
    mediaType: data.mediaType,
  };
}

export async function fetchWhatsappMessages(
  conversationId: string,
  limit = 200
): Promise<WhatsappMessage[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select(
      "id, wa_message_id, from_me, message_type, body, message_timestamp, audio_transcript, wa_status, reaction_emoji, quoted_wa_message_id, quoted_body"
    )
    .eq("conversation_id", conversationId)
    .order("message_timestamp", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as WhatsappMessage[]).reverse();
}

function getOpenAiKey(): string | null {
  return (
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.NEXT_OPENAI_API_KEY?.trim() ||
    null
  );
}

export async function transcribeWhatsappAudioMessage(
  messageId: string
): Promise<string> {
  const openaiKey = getOpenAiKey();
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY ou NEXT_OPENAI_API_KEY não configurada.");
  }

  const supabase = getAdminClient();
  const { data: existing, error: fetchError } = await supabase
    .from("whatsapp_messages")
    .select("audio_transcript, message_type, body")
    .eq("id", messageId)
    .maybeSingle();

  if (fetchError || !existing) throw new Error("Mensagem não encontrada.");
  if (existing.audio_transcript) return existing.audio_transcript as string;

  const media = await fetchEvolutionMessageMedia(messageId);
  const buffer = Buffer.from(media.base64, "base64");

  const formData = new FormData();
  const blob = new Blob([buffer], { type: media.mimetype });
  formData.append("file", blob, "audio.ogg");
  formData.append("model", "whisper-1");
  formData.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  });

  const json = (await res.json()) as { text?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? "Erro na transcrição Whisper.");
  }

  const transcript = (json.text ?? "").trim();
  if (!transcript) throw new Error("Transcrição vazia.");

  await supabase
    .from("whatsapp_messages")
    .update({ audio_transcript: transcript })
    .eq("id", messageId);

  return transcript;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = getAdminClient();
  const config = getEvolutionConfig();

  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("remote_jid")
    .eq("id", conversationId)
    .maybeSingle();

  if (config && conv?.remote_jid) {
    const { data: unreadMsgs } = await supabase
      .from("whatsapp_messages")
      .select("wa_message_id, remote_jid")
      .eq("conversation_id", conversationId)
      .eq("from_me", false)
      .not("wa_message_id", "is", null)
      .order("message_timestamp", { ascending: false })
      .limit(40);

    const readMessages = (unreadMsgs ?? [])
      .filter((m) => m.wa_message_id)
      .map((m) => ({
        remoteJid: (m.remote_jid as string) || (conv.remote_jid as string),
        fromMe: false,
        id: m.wa_message_id as string,
      }));

    if (readMessages.length > 0) {
      try {
        await evolutionFetch(`/chat/markMessageAsRead/${config.instanceName}`, {
          method: "POST",
          body: { readMessages },
        });
      } catch (err) {
        console.error("[evolution] markMessageAsRead:", err);
      }
    }
  }

  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw new Error(error.message);
}

export async function markEvolutionMessageAsPlayed(dbMessageId: string): Promise<void> {
  const config = getEvolutionConfig();
  if (!config) return;

  const supabase = getAdminClient();
  const { data: msg } = await supabase
    .from("whatsapp_messages")
    .select("wa_message_id, remote_jid, from_me")
    .eq("id", dbMessageId)
    .maybeSingle();

  if (!msg?.wa_message_id) return;

  try {
    await evolutionFetch(`/chat/markMessageAsPlayed/${config.instanceName}`, {
      method: "POST",
      body: {
        readMessages: [
          {
            remoteJid: msg.remote_jid,
            fromMe: msg.from_me,
            id: msg.wa_message_id,
          },
        ],
      },
    });
  } catch (err) {
    console.error("[evolution] markMessageAsPlayed:", err);
  }
}

export async function sendEvolutionReaction(
  conversationId: string,
  waMessageId: string,
  emoji: string,
  fromMeTarget = false
): Promise<void> {
  const trimmed = emoji.trim();
  if (!trimmed) throw new Error("Reação inválida.");

  const config = getEvolutionConfig();
  if (!config) throw new Error("Evolution API não configurada.");

  const supabase = getAdminClient();
  const { data: conversation, error } = await supabase
    .from("whatsapp_conversations")
    .select("remote_jid, phone")
    .eq("id", conversationId)
    .single();

  if (error || !conversation) throw new Error("Conversa não encontrada.");

  const remoteJid = conversation.remote_jid as string;

  await evolutionFetch(`/message/sendReaction/${config.instanceName}`, {
    method: "POST",
    body: {
      key: {
        remoteJid,
        fromMe: fromMeTarget,
        id: waMessageId,
      },
      reaction: trimmed,
    },
  });
}

export async function sendEvolutionAudioMessage(
  conversationId: string,
  audioBase64: string
): Promise<WhatsappMessage> {
  const config = getEvolutionConfig();
  if (!config) throw new Error("Evolution API não configurada.");

  const raw = audioBase64.replace(/^data:audio\/[^;]+;base64,/, "").trim();
  if (!raw) throw new Error("Áudio vazio.");

  const supabase = getAdminClient();
  const { data: conversation, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, remote_jid, phone, instance_name")
    .eq("id", conversationId)
    .single();

  if (error || !conversation) throw new Error("Conversa não encontrada.");

  const recipient = resolveEvolutionRecipient(
    conversation.remote_jid,
    conversation.phone
  );

  const response = await evolutionFetch<Record<string, unknown>>(
    `/message/sendWhatsAppAudio/${config.instanceName}`,
    {
      method: "POST",
      body: {
        number: recipient,
        audio: raw,
        encoding: true,
        options: {
          presence: "recording",
          encoding: true,
        },
      },
    }
  );

  return saveOutboundEvolutionMessage(
    supabase,
    conversationId,
    conversation.remote_jid,
    config.instanceName,
    response,
    "[áudio]"
  );
}

/** Exige role admin para operações sensíveis (ex.: reconfigurar webhook Evolution). */
export async function requireEvolutionAdmin(userId: string): Promise<void> {
  const supabase = getAdminClient();
  const { data: profile, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const role = (profile?.role as string | undefined)?.toLowerCase();
  if (role !== "admin") {
    throw new Error("Apenas administradores podem executar esta ação.");
  }
}
