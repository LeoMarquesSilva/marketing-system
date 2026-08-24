import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const MESSAGE_EVENTS = new Set([
  "MESSAGES_UPSERT",
  "SEND_MESSAGE",
  "MESSAGES_UPDATE",
  "CONNECTION_UPDATE",
]);

interface MetaAttribution {
  sourceId: string | null;
  sourceUrl: string | null;
  title: string | null;
  body: string | null;
  sourceType: string | null;
  ctwaClid: string | null;
  conversionApp: string | null;
  conversionSource: string | null;
}

interface ParsedMessage {
  waMessageId: string;
  remoteJid: string;
  phone: string | null;
  pushName: string | null;
  fromMe: boolean;
  messageType: string;
  body: string;
  messageTimestamp: Date;
  instanceName: string;
  metaAttribution: MetaAttribution | null;
  quotedWaMessageId?: string | null;
  quotedBody?: string | null;
  isReaction?: boolean;
  reactionTargetId?: string | null;
  reactionEmoji?: string | null;
  isGroup: boolean;
  participantPhone: string | null;
}

const CONV_SELECT =
  "id, unread_count, push_name, phone, lead_source, tags, meta_ad_id, meta_ad_title, last_message_at, remote_jid, attendance_status, is_group, group_subject";

function readContextInfo(
  message: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!message) return null;
  const extended = message.extendedTextMessage as
    | { contextInfo?: Record<string, unknown> }
    | undefined;
  if (extended?.contextInfo) return extended.contextInfo;
  const template = message.templateMessage as
    | {
        hydratedTemplate?: { contextInfo?: Record<string, unknown> };
        hydratedFourRowTemplate?: { contextInfo?: Record<string, unknown> };
      }
    | undefined;
  const hydrated =
    template?.hydratedTemplate ?? template?.hydratedFourRowTemplate;
  if (hydrated?.contextInfo) return hydrated.contextInfo;
  for (const key of [
    "imageMessage",
    "videoMessage",
    "documentMessage",
    "audioMessage",
  ] as const) {
    const nested = message[key] as { contextInfo?: Record<string, unknown> } | undefined;
    if (nested?.contextInfo) return nested.contextInfo;
  }
  return null;
}

function quotedTextFromMessage(msg: Record<string, unknown> | undefined): string | null {
  if (!msg) return null;
  if (typeof msg.conversation === "string") return msg.conversation;
  const ext = msg.extendedTextMessage as { text?: string } | undefined;
  if (ext?.text) return ext.text;
  const img = msg.imageMessage as { caption?: string } | undefined;
  if (img?.caption) return `[imagem] ${img.caption}`;
  if (msg.imageMessage) return "[imagem]";
  if (msg.videoMessage) return "[vídeo]";
  if (msg.audioMessage) return "[áudio]";
  if (msg.documentMessage) return "[documento]";
  if (msg.stickerMessage) return "[sticker]";
  return null;
}

function extractQuotedMessage(message: Record<string, unknown> | undefined): {
  quotedWaMessageId: string | null;
  quotedBody: string | null;
} {
  const contextInfo = readContextInfo(message);
  if (!contextInfo) return { quotedWaMessageId: null, quotedBody: null };
  const stanzaId = (contextInfo.stanzaId as string | undefined)?.trim() || null;
  const quoted = contextInfo.quotedMessage as Record<string, unknown> | undefined;
  return {
    quotedWaMessageId: stanzaId,
    quotedBody: quotedTextFromMessage(quoted),
  };
}

function extractReactionUpdate(message: Record<string, unknown> | undefined): {
  targetWaMessageId: string | null;
  emoji: string | null;
} {
  const reaction = message?.reactionMessage as
    | { key?: { id?: string }; text?: string }
    | undefined;
  if (!reaction) return { targetWaMessageId: null, emoji: null };
  return {
    targetWaMessageId: reaction.key?.id?.trim() || null,
    emoji: reaction.text?.trim() || null,
  };
}

function mapEvolutionAckStatus(status: unknown): string | null {
  if (status === null || status === undefined) return null;
  if (typeof status === "string") {
    const s = status.toUpperCase();
    if (s.includes("READ") || s === "READ") return "read";
    if (s.includes("PLAYED") || s === "PLAYED") return "played";
    if (s.includes("DELIVER") || s === "DELIVERY_ACK") return "delivered";
    if (s.includes("SERVER") || s === "SERVER_ACK") return "sent";
    if (s.includes("PENDING")) return "pending";
    if (s.includes("ERROR")) return "error";
  }
  const n = typeof status === "number" ? status : parseInt(String(status), 10);
  if (!Number.isFinite(n)) return null;
  switch (n) {
    case 0:
      return "error";
    case 1:
      return "pending";
    case 2:
      return "sent";
    case 3:
      return "delivered";
    case 4:
      return "read";
    case 5:
      return "played";
    default:
      return null;
  }
}

function extractMetaWhatsappAttribution(
  message: Record<string, unknown> | undefined
): MetaAttribution | null {
  const contextInfo = readContextInfo(message);
  if (!contextInfo) return null;

  const externalAdReply = contextInfo.externalAdReply as
    | Record<string, unknown>
    | undefined;

  const attribution: MetaAttribution = {
    sourceId:
      (externalAdReply?.sourceId as string | undefined)?.trim() ||
      (externalAdReply?.sourceID as string | undefined)?.trim() ||
      null,
    sourceUrl: (externalAdReply?.sourceUrl as string | undefined)?.trim() || null,
    title: (externalAdReply?.title as string | undefined)?.trim() || null,
    body: (externalAdReply?.body as string | undefined)?.trim() || null,
    sourceType:
      (externalAdReply?.sourceType as string | undefined)?.trim() || null,
    ctwaClid:
      (externalAdReply?.ctwaClid as string | undefined)?.trim() ||
      (contextInfo.ctwaClid as string | undefined)?.trim() ||
      null,
    conversionApp:
      (contextInfo.entryPointConversionApp as string | undefined)?.trim() ||
      (externalAdReply?.sourceApp as string | undefined)?.trim() ||
      null,
    conversionSource:
      (contextInfo.conversionSource as string | undefined)?.trim() ||
      (contextInfo.entryPointConversionSource as string | undefined)?.trim() ||
      null,
  };

  return Object.values(attribution).some(Boolean) ? attribution : null;
}

function isMetaAdLeadFromAttribution(attribution: MetaAttribution | null): boolean {
  if (!attribution) return false;
  if (attribution.sourceId || attribution.ctwaClid) return true;
  const src = (attribution.conversionSource ?? "").toLowerCase();
  if (src.includes("fb_ads") || src.includes("ctwa")) return true;
  const app = (attribution.conversionApp ?? "").toLowerCase();
  return app === "instagram" || app === "facebook";
}

function isMetaLeadMessage(msg: ParsedMessage): boolean {
  if (msg.fromMe || msg.isGroup) return false;
  return isMetaAdLeadMessage(msg.body) || isMetaAdLeadFromAttribution(msg.metaAttribution);
}

function metaFieldsFromAttribution(attr: MetaAttribution | null): Record<string, string> {
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

function normalizeEvent(raw: string): string {
  return raw.trim().toUpperCase().replace(/\./g, "_").replace(/-/g, "_");
}

function extractMessageText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";
  if (typeof message.conversation === "string") return message.conversation;
  const extended = message.extendedTextMessage as { text?: string } | undefined;
  if (extended?.text) return extended.text;

  const list = message.listMessage as
    | {
        title?: string;
        description?: string;
        buttonText?: string;
        sections?: Array<{ rows?: Array<{ title?: string }> }>;
      }
    | undefined;
  if (list) {
    const parts = [list.title, list.description].filter(Boolean) as string[];
    const rows =
      list.sections
        ?.flatMap((s) => s.rows ?? [])
        .map((r) => r.title)
        .filter(Boolean) ?? [];
    if (rows.length) parts.push(rows.join(" · "));
    if (list.buttonText) parts.push(`(${list.buttonText})`);
    if (parts.length) return `[lista] ${parts.join("\n")}`;
  }

  const vom = message.viewOnceMessage as
    | { message?: Record<string, unknown> }
    | undefined;
  const inner = vom?.message ?? message;
  const im = inner.interactiveMessage as
    | {
        body?: { text?: string };
        nativeFlowMessage?: {
          buttons?: Array<{ buttonParamsJson?: string }>;
        };
      }
    | undefined;
  if (im) {
    const text = (im.body?.text ?? "").replace(/\*/g, "").replace(/\n+/g, " ").trim();
    const labels =
      im.nativeFlowMessage?.buttons
        ?.map((b) => {
          try {
            return (
              JSON.parse(b.buttonParamsJson ?? "{}") as { display_text?: string }
            ).display_text;
          } catch {
            return null;
          }
        })
        .filter(Boolean) ?? [];
    if (labels.length) {
      return `[botões] ${text || "Opções"}\n${labels.map((l) => `• ${l}`).join("\n")}`;
    }
    if (text) return `[botões] ${text}`;
  }

  const template = message.templateMessage as
    | {
        hydratedTemplate?: {
          hydratedContentText?: string;
          hydratedTitleText?: string;
        };
        hydratedFourRowTemplate?: {
          hydratedContentText?: string;
          hydratedTitleText?: string;
        };
      }
    | undefined;
  if (template) {
    const hydrated =
      template.hydratedTemplate ?? template.hydratedFourRowTemplate;
    const parts = [hydrated?.hydratedTitleText, hydrated?.hydratedContentText].filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0
    );
    if (parts.length > 0) return parts.join("\n");
  }
  const image = message.imageMessage as { caption?: string } | undefined;
  if (image?.caption) return `[imagem] ${image.caption}`;
  const video = message.videoMessage as { caption?: string } | undefined;
  if (video?.caption) return `[vídeo] ${video.caption}`;
  const doc = message.documentMessage as { caption?: string; fileName?: string } | undefined;
  if (doc?.caption) return `[documento] ${doc.caption}`;
  if (doc?.fileName) return `[documento] ${doc.fileName}`;
  if (message.audioMessage) return "[áudio]";
  if (message.imageMessage) return "[imagem]";
  if (message.stickerMessage) return "[sticker]";
  if (message.contactMessage) return "[contato]";
  if (message.locationMessage) return "[localização]";
  return "[mensagem]";
}

function jidToPhone(remoteJid: string): string | null {
  if (!remoteJid || remoteJid.endsWith("@g.us")) return null;
  if (remoteJid === "status@broadcast") return null;
  // @lid é o JID de privacidade do WhatsApp (Linked ID) — a parte numérica
  // não é um telefone discável, é um ID interno opaco.
  if (remoteJid.endsWith("@lid")) return null;
  const userPart = remoteJid.split("@")[0] ?? "";
  const digits = userPart.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
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

/**
 * Nome do grupo, buscado sob demanda na Evolution API — o payload de
 * MESSAGES_UPSERT não traz o "subject" do grupo, só o pushName de quem
 * mandou a mensagem. Best-effort: se falhar, a conversa fica sem nome e
 * cai no fallback de exibição ("Grupo"), sem travar a ingestão.
 */
async function fetchGroupSubject(
  instanceName: string,
  groupJid: string
): Promise<string | null> {
  const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.trim().replace(/\/$/, "");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY")?.trim();
  if (!baseUrl || !apiKey) return null;
  try {
    const res = await fetch(
      `${baseUrl}/group/findGroupInfos/${encodeURIComponent(instanceName)}?groupJid=${encodeURIComponent(groupJid)}`,
      { headers: { apikey: apiKey }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const subject = (json as { subject?: string })?.subject;
    return subject?.trim() || null;
  } catch (err) {
    console.error("[evolution-webhook] falha ao buscar nome do grupo:", err);
    return null;
  }
}

async function findConversationForMessage(
  supabase: SupabaseClient,
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

  const variants = phone ? phoneVariants(phone) : phoneVariants(jidToPhone(remoteJid));
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

function isMetaAdLeadMessage(body: string): boolean {
  const normalized = body
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
  return (
    normalized.includes("tenho interesse") &&
    normalized.includes("mais informacoes")
  );
}

/** Texto padrão enviado pelo botão flutuante de WhatsApp do site institucional. */
const SITE_LEAD_MESSAGE_PREFIX =
  "Olá! Vim pelo site e gostaria de falar com um especialista.";

function isSiteLeadMessage(body: string): boolean {
  if (!body?.trim()) return false;
  const normalize = (t: string) =>
    t.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ");
  return normalize(body).startsWith(normalize(SITE_LEAD_MESSAGE_PREFIX));
}

function isSiteLead(msg: ParsedMessage): boolean {
  return !msg.fromMe && !msg.isGroup && isSiteLeadMessage(msg.body);
}

/** O widget do site anexa "Página: <título>" e a URL na própria mensagem. */
function parseSiteLeadPage(body: string): { pageTitle: string | null; pageUrl: string | null } {
  const titleMatch = body.match(/P[aá]gina:\s*(.+)/);
  const urlMatch = body.match(/(https?:\/\/\S+)/);
  return {
    pageTitle: titleMatch ? titleMatch[1].trim() : null,
    pageUrl: urlMatch ? urlMatch[1].trim() : null,
  };
}

const BLOCKED_INSTANCE_PUSH_NAMES = new Set([
  "bismarchi pires sociedade de advogados",
]);

function isBlockedInstancePushName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const normalized = name.trim().toLowerCase();
  if (BLOCKED_INSTANCE_PUSH_NAMES.has(normalized)) return true;
  for (const entry of BLOCKED_INSTANCE_PUSH_NAMES) {
    if (normalized.includes(entry) || entry.includes(normalized)) return true;
  }
  return false;
}

function contactPushNameFromMessage(msg: ParsedMessage): string | null {
  if (msg.fromMe) return null;
  const name = msg.pushName?.trim();
  if (!name || isBlockedInstancePushName(name)) return null;
  return name;
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
): ParsedMessage | null {
  const key = item.key as
    | { remoteJid?: string; fromMe?: boolean; id?: string; participant?: string }
    | undefined;
  if (!key?.remoteJid || !key.id) return null;

  const remoteJid = key.remoteJid;
  if (remoteJid === "status@broadcast") return null;
  const isGroup = remoteJid.endsWith("@g.us");
  // Em mensagens de grupo o remetente real vem em key.participant — o
  // remoteJid é o JID do grupo, não de uma pessoa.
  const participantPhone = isGroup ? jidToPhone(key.participant ?? "") : null;

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
      phone: isGroup ? null : jidToPhone(remoteJid),
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
      isGroup,
      participantPhone,
    };
  }

  const { quotedWaMessageId, quotedBody } = extractQuotedMessage(message);

  return {
    waMessageId: key.id,
    remoteJid,
    phone: isGroup ? null : jidToPhone(remoteJid),
    pushName: fromMe ? null : ((item.pushName as string | undefined) ?? null),
    fromMe,
    messageType: (item.messageType as string | undefined) ?? "unknown",
    body: extractMessageText(message),
    messageTimestamp,
    instanceName,
    metaAttribution: extractMetaWhatsappAttribution(message),
    quotedWaMessageId,
    quotedBody,
    isGroup,
    participantPhone,
  };
}

function parseWebhookPayload(payload: Record<string, unknown>): ParsedMessage[] {
  const instanceName =
    (payload.instance as string | undefined) ??
    Deno.env.get("EVOLUTION_INSTANCE") ??
    "BP";

  const data = payload.data;
  const items: Record<string, unknown>[] = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : data && typeof data === "object"
      ? [data as Record<string, unknown>]
      : [];

  const parsed: ParsedMessage[] = [];
  for (const item of items) {
    const msg = parseSingleMessage(item, instanceName);
    if (msg) parsed.push(msg);
  }
  return parsed;
}

function verifyRequest(req: Request): boolean {
  const secret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET")?.trim();
  if (!secret) {
    // Em produção, bloquear requisições sem segredo configurado.
    if (Deno.env.get("ENVIRONMENT") === "production") return false;
    return true;
  }
  const headerKey =
    req.headers.get("apikey") ??
    req.headers.get("x-evolution-api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return headerKey === secret;
}

async function applyMetaLeadPatch(
  supabase: SupabaseClient,
  conversationId: string,
  msg: ParsedMessage,
  existingConv: Record<string, unknown> | null
): Promise<void> {
  if (!isMetaLeadMessage(msg)) return;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (existingConv?.lead_source !== "meta_ads") {
    patch.lead_source = "meta_ads";
    const tags = (existingConv?.tags as string[] | undefined) ?? [];
    patch.tags = tags.some((t) => t.toLowerCase() === "tráfego pago")
      ? tags
      : [...tags, "Tráfego pago"];
  }
  const attr = msg.metaAttribution;
  if (attr) {
    if (attr.sourceId && !existingConv?.meta_ad_id) patch.meta_ad_id = attr.sourceId;
    if (attr.title && !existingConv?.meta_ad_title) patch.meta_ad_title = attr.title;
    if (attr.body) patch.meta_ad_body = attr.body;
    if (attr.sourceUrl) patch.meta_ad_source_url = attr.sourceUrl;
    if (attr.ctwaClid) patch.meta_ctwa_clid = attr.ctwaClid;
    if (attr.conversionApp) patch.meta_conversion_app = attr.conversionApp;
  }
  if (Object.keys(patch).length > 1) {
    await supabase.from("whatsapp_conversations").update(patch).eq("id", conversationId);
  }
}

async function applySiteLeadPatch(
  supabase: SupabaseClient,
  conversationId: string,
  msg: ParsedMessage,
  existingConv: Record<string, unknown> | null
): Promise<void> {
  if (!isSiteLead(msg)) return;
  // Não sobrescreve uma origem já identificada (ex.: já é lead do Meta Ads).
  if (existingConv?.lead_source) return;

  const { pageTitle, pageUrl } = parseSiteLeadPage(msg.body);
  const tags = (existingConv?.tags as string[] | undefined) ?? [];
  const patch = {
    updated_at: new Date().toISOString(),
    lead_source: "site_whatsapp",
    tags: tags.some((t) => t.toLowerCase() === "site") ? tags : [...tags, "Site"],
    site_lead_page_title: pageTitle,
    site_lead_page_url: pageUrl,
  };
  await supabase.from("whatsapp_conversations").update(patch).eq("id", conversationId);
}

async function upsertMessages(messages: ParsedMessage[]): Promise<number> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let inserted = 0;

  for (const msg of messages) {
    if (msg.isReaction && msg.reactionTargetId) {
      const { error: reactionError } = await supabase
        .from("whatsapp_messages")
        .update({
          reaction_emoji: msg.reactionEmoji || msg.body || "👍",
        })
        .eq("instance_name", msg.instanceName)
        .eq("wa_message_id", msg.reactionTargetId);
      if (reactionError) {
        console.error("[evolution-webhook] falha ao salvar reação:", reactionError.message);
      }
      continue;
    }

    const { data: existingMsg } = await supabase
      .from("whatsapp_messages")
      .select("id, body")
      .eq("instance_name", msg.instanceName)
      .eq("wa_message_id", msg.waMessageId)
      .maybeSingle();

    if (existingMsg) {
      const existingBody = existingMsg.body as string | null | undefined;
      const isPlaceholder = !existingBody?.trim() || existingBody === "[mensagem]";
      if (isPlaceholder && msg.body && msg.body !== "[mensagem]") {
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
    const inboundName = contactPushNameFromMessage(msg);
    const isMetaLead = isMetaLeadMessage(msg);
    const metaFields = metaFieldsFromAttribution(msg.metaAttribution);
    const isNewSiteLead = !isMetaLead && isSiteLead(msg);
    const sitePageInfo = isNewSiteLead ? parseSiteLeadPage(msg.body) : null;

    let existingConv = await findConversationForMessage(
      supabase,
      msg.instanceName,
      msg.remoteJid,
      msgPhone
    );

    let conversationId = existingConv?.id as string | undefined;
    const canonicalJid =
      (existingConv?.remote_jid as string | undefined) ?? msg.remoteJid;

    if (!conversationId) {
      const groupSubject = msg.isGroup
        ? await fetchGroupSubject(msg.instanceName, msg.remoteJid)
        : null;
      const { data: created, error } = await supabase
        .from("whatsapp_conversations")
        .insert({
          remote_jid: msg.remoteJid,
          instance_name: msg.instanceName,
          phone: msgPhone,
          push_name: msg.isGroup ? null : inboundName,
          is_group: msg.isGroup,
          group_subject: groupSubject,
          last_message_at: msg.messageTimestamp.toISOString(),
          last_message_preview: null,
          last_inbound_at: msg.fromMe ? null : msg.messageTimestamp.toISOString(),
          unread_count: 0,
          lead_source: isMetaLead ? "meta_ads" : isNewSiteLead ? "site_whatsapp" : null,
          tags: isMetaLead ? ["Tráfego pago"] : isNewSiteLead ? ["Site"] : [],
          site_lead_page_title: sitePageInfo?.pageTitle ?? null,
          site_lead_page_url: sitePageInfo?.pageUrl ?? null,
          ...metaFields,
        })
        .select("id, unread_count, last_message_at, is_group")
        .single();
      if (error || !created) {
        console.error(
          "[evolution-webhook] falha ao criar conversa:",
          error?.message ?? "sem dados retornados",
          { remoteJid: msg.remoteJid, waMessageId: msg.waMessageId }
        );
        continue;
      }
      conversationId = created.id;
      existingConv = created as Record<string, unknown>;
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
        participant_phone: msg.isGroup ? msg.participantPhone : null,
        participant_name: msg.isGroup ? inboundName : null,
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

    if (msgError) {
      console.error(
        "[evolution-webhook] falha ao salvar mensagem:",
        msgError.message,
        { conversationId, waMessageId: msg.waMessageId }
      );
      continue;
    }
    inserted += 1;

    const existingLastAt = existingConv?.last_message_at
      ? new Date(existingConv.last_message_at as string).getTime()
      : 0;
    const isNewer = msg.messageTimestamp.getTime() >= existingLastAt;

    const convUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (inboundName && !msg.isGroup) {
      const existingName = existingConv?.push_name as string | null | undefined;
      if (!existingName?.trim() || isBlockedInstancePushName(existingName)) {
        convUpdate.push_name = inboundName;
      }
    }

    if (isNewer) {
      convUpdate.last_message_at = msg.messageTimestamp.toISOString();
      convUpdate.last_message_preview = preview;
      const currentStatus = existingConv?.attendance_status as string | undefined;
      if (!msg.fromMe) {
        convUpdate.last_inbound_at = msg.messageTimestamp.toISOString();
        // Cliente escreveu de novo: volta pra fila, a menos que alguém já
        // esteja atendendo essa conversa agora (não tira do atendente).
        if (currentStatus !== "em_atendimento") {
          convUpdate.attendance_status = "nao_respondido";
        }
        await supabase.rpc("increment_whatsapp_unread", {
          p_conversation_id: conversationId,
        });
      } else {
        // Respondemos: a bola passa pro cliente.
        convUpdate.last_outbound_at = msg.messageTimestamp.toISOString();
        convUpdate.attendance_status = "aguardando_cliente";
      }
    }

    if (Object.keys(convUpdate).length > 1) {
      await supabase
        .from("whatsapp_conversations")
        .update(convUpdate)
        .eq("id", conversationId);
    }

    await applyMetaLeadPatch(supabase, conversationId!, msg, existingConv);
    await applySiteLeadPatch(supabase, conversationId!, msg, existingConv);
  }

  return inserted;
}

async function insertWebhookAuditLog(
  supabase: SupabaseClient,
  payload: {
    event: string;
    received: number;
    stored: number;
    status: "ok" | "error";
    latencyMs: number;
    errorMessage?: string | null;
  }
) {
  await supabase.from("whatsapp_webhook_events").insert({
    source: "evolution",
    event_name: payload.event,
    received_count: payload.received,
    stored_count: payload.stored,
    status: payload.status,
    latency_ms: payload.latencyMs,
    error_message: payload.errorMessage ?? null,
    processed_at: new Date().toISOString(),
  });
}

async function processMessagesUpdate(payload: Record<string, unknown>): Promise<number> {
  const instanceName =
    (payload.instance as string | undefined) ??
    Deno.env.get("EVOLUTION_INSTANCE") ??
    "BP";
  const raw = payload.data;
  const items: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : raw && typeof raw === "object"
      ? [raw as Record<string, unknown>]
      : [];

  if (items.length === 0) return 0;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  let updated = 0;

  for (const item of items) {
    // A Evolution manda o payload de MESSAGES_UPDATE achatado (keyId), não
    // aninhado como MESSAGES_UPSERT (key.id) — checamos os dois formatos.
    const key = item.key as { id?: string } | undefined;
    const waMessageId = (item.keyId as string | undefined) ?? key?.id;
    const patch = item.update as { status?: unknown } | undefined;
    const status = mapEvolutionAckStatus(
      patch?.status ?? item.status ?? (item as { ack?: unknown }).ack
    );
    if (!waMessageId || !status) continue;

    const { error } = await supabase
      .from("whatsapp_messages")
      .update({ wa_status: status })
      .eq("instance_name", instanceName)
      .eq("wa_message_id", waMessageId);

    if (!error) updated += 1;
  }

  return updated;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-evolution-api-key",
};

/** Estado de conexão da instância Evolution (evento CONNECTION_UPDATE). */
async function processConnectionUpdate(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<void> {
  const instanceName = (payload.instance as string | undefined) ?? "BP";
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const state = String(data.state ?? data.status ?? "unknown").toLowerCase();
  const statusReason = data.statusReason != null ? String(data.statusReason) : null;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("whatsapp_instance_status")
    .select("state")
    .eq("instance_name", instanceName)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    instance_name: instanceName,
    state,
    status_reason: statusReason,
    updated_at: now,
  };
  if (state === "open") patch.last_connected_at = now;
  if (state === "close") patch.last_disconnected_at = now;

  await supabase.from("whatsapp_instance_status").upsert(patch, { onConflict: "instance_name" });

  if (state === "close" && existing?.state !== "close") {
    console.error(
      `[evolution-webhook] instância "${instanceName}" desconectou (statusReason=${statusReason ?? "?"}). Mensagens do WhatsApp deixaram de chegar até reconectar.`
    );
  }
}

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        endpoint: "evolution-webhook",
        target: "supabase",
        version: 12,
        events: [...MESSAGE_EVENTS],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!verifyRequest(req)) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const eventRaw =
      typeof payload.event === "string" ? normalizeEvent(payload.event) : "";

    if (eventRaw && !MESSAGE_EVENTS.has(eventRaw)) {
      return new Response(JSON.stringify({ ok: true, skipped: eventRaw }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (eventRaw === "CONNECTION_UPDATE") {
      await processConnectionUpdate(supabase, payload);
      await insertWebhookAuditLog(supabase, {
        event: eventRaw,
        received: 1,
        stored: 1,
        status: "ok",
        latencyMs: Date.now() - startedAt,
      });
      return new Response(JSON.stringify({ ok: true, event: eventRaw }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventRaw === "MESSAGES_UPDATE") {
      const updated = await processMessagesUpdate(payload);
      await insertWebhookAuditLog(supabase, {
        event: eventRaw,
        received: updated,
        stored: updated,
        status: "ok",
        latencyMs: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({ ok: true, event: eventRaw, updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages = parseWebhookPayload(payload);
    const stored = await upsertMessages(messages);
    await insertWebhookAuditLog(supabase, {
      event: eventRaw || "MESSAGES_UPSERT",
      received: messages.length,
      stored,
      status: "ok",
      latencyMs: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        event: eventRaw || "MESSAGES_UPSERT",
        received: messages.length,
        stored,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro no webhook.";
    console.error("[evolution-webhook]", msg);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        await insertWebhookAuditLog(supabase, {
          event: "UNKNOWN",
          received: 0,
          stored: 0,
          status: "error",
          latencyMs: Date.now() - startedAt,
          errorMessage: msg,
        });
      } catch {
        /* ignore */
      }
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
