/** Metadados extras de mensagens WhatsApp (citação, reação, status). */

export type WaMessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "played"
  | "error";

export function mapEvolutionAckStatus(status: unknown): WaMessageStatus | null {
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

function readContextInfo(
  message: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!message) return null;
  const extended = message.extendedTextMessage as
    | { contextInfo?: Record<string, unknown> }
    | undefined;
  if (extended?.contextInfo) return extended.contextInfo;
  const image = message.imageMessage as { contextInfo?: Record<string, unknown> } | undefined;
  if (image?.contextInfo) return image.contextInfo;
  const video = message.videoMessage as { contextInfo?: Record<string, unknown> } | undefined;
  if (video?.contextInfo) return video.contextInfo;
  const doc = message.documentMessage as { contextInfo?: Record<string, unknown> } | undefined;
  if (doc?.contextInfo) return doc.contextInfo;
  const audio = message.audioMessage as { contextInfo?: Record<string, unknown> } | undefined;
  if (audio?.contextInfo) return audio.contextInfo;
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

export function extractQuotedMessage(message: Record<string, unknown> | undefined): {
  quotedWaMessageId: string | null;
  quotedBody: string | null;
} {
  const contextInfo = readContextInfo(message);
  if (!contextInfo) return { quotedWaMessageId: null, quotedBody: null };

  const stanzaId = (contextInfo.stanzaId as string | undefined)?.trim() || null;
  const quoted = contextInfo.quotedMessage as Record<string, unknown> | undefined;
  const body = quotedTextFromMessage(quoted);

  return {
    quotedWaMessageId: stanzaId,
    quotedBody: body,
  };
}

export function extractReactionUpdate(message: Record<string, unknown> | undefined): {
  targetWaMessageId: string | null;
  emoji: string | null;
} {
  const reaction = message?.reactionMessage as
    | {
        key?: { id?: string };
        text?: string;
      }
    | undefined;
  if (!reaction) return { targetWaMessageId: null, emoji: null };
  return {
    targetWaMessageId: reaction.key?.id?.trim() || null,
    emoji: reaction.text?.trim() || null,
  };
}

export function buildEvolutionQuotedPayload(
  remoteJid: string,
  waMessageId: string,
  body: string | null
): Record<string, unknown> {
  return {
    key: { remoteJid, fromMe: false, id: waMessageId },
    message: { conversation: body ?? "…" },
  };
}

function unwrapInnerMessage(
  message: Record<string, unknown>
): Record<string, unknown> {
  const viewOnce = message.viewOnceMessage as
    | { message?: Record<string, unknown> }
    | undefined;
  if (viewOnce?.message) return viewOnce.message;
  const ephemeral = message.ephemeralMessage as
    | { message?: Record<string, unknown> }
    | undefined;
  if (ephemeral?.message) return ephemeral.message;
  return message;
}

function parseInteractiveButtonsText(
  interactive: Record<string, unknown> | undefined
): string | null {
  if (!interactive) return null;
  const body = interactive.body as { text?: string } | undefined;
  const text = (body?.text ?? "")
    .replace(/\*/g, "")
    .replace(/\n+/g, " ")
    .trim();
  const native = interactive.nativeFlowMessage as
    | {
        buttons?: Array<{ buttonParamsJson?: string }>;
      }
    | undefined;
  const labels =
    native?.buttons
      ?.map((btn) => {
        try {
          const parsed = JSON.parse(btn.buttonParamsJson ?? "{}") as {
            display_text?: string;
          };
          return parsed.display_text?.trim() || null;
        } catch {
          return null;
        }
      })
      .filter((label): label is string => Boolean(label)) ?? [];

  if (labels.length > 0) {
    const header = text || "Opções";
    return `[botões] ${header}\n${labels.map((l) => `• ${l}`).join("\n")}`;
  }
  if (text) return `[botões] ${text}`;
  return null;
}

function parseListMessageText(
  list: Record<string, unknown> | undefined
): string | null {
  if (!list) return null;
  const title = (list.title as string | undefined)?.trim();
  const description = (list.description as string | undefined)?.trim();
  const buttonText = (list.buttonText as string | undefined)?.trim();
  const sections = list.sections as
    | Array<{ rows?: Array<{ title?: string }> }>
    | undefined;
  const rows =
    sections
      ?.flatMap((section) => section.rows ?? [])
      .map((row) => row.title?.trim())
      .filter((rowTitle): rowTitle is string => Boolean(rowTitle)) ?? [];

  const parts = [title, description].filter(Boolean);
  if (rows.length > 0) parts.push(rows.join(" · "));
  if (buttonText) parts.push(`(${buttonText})`);
  if (parts.length === 0) return null;
  return `[lista] ${parts.join("\n")}`;
}

/** Texto legível a partir do payload `message` da Evolution. */
export function extractWhatsappMessageText(
  message: Record<string, unknown> | undefined
): string {
  if (!message) return "";

  const listText = parseListMessageText(
    message.listMessage as Record<string, unknown> | undefined
  );
  if (listText) return listText;

  const inner = unwrapInnerMessage(message);

  const innerList = parseListMessageText(
    inner.listMessage as Record<string, unknown> | undefined
  );
  if (innerList) return innerList;

  const interactiveText = parseInteractiveButtonsText(
    inner.interactiveMessage as Record<string, unknown> | undefined
  );
  if (interactiveText) return interactiveText;

  const buttonsMsg = message.buttonsMessage as
    | { contentText?: string; footerText?: string }
    | undefined;
  if (buttonsMsg?.contentText) {
    return `[botões] ${buttonsMsg.contentText}`;
  }

  if (typeof message.conversation === "string") return message.conversation;
  if (typeof inner.conversation === "string") return inner.conversation;

  const extended = (message.extendedTextMessage ?? inner.extendedTextMessage) as
    | { text?: string }
    | undefined;
  if (extended?.text) return extended.text;

  const template = (message.templateMessage ?? inner.templateMessage) as
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
      (part): part is string => typeof part === "string" && part.trim().length > 0
    );
    if (parts.length > 0) return parts.join("\n");
  }

  const image = (message.imageMessage ?? inner.imageMessage) as
    | { caption?: string }
    | undefined;
  if (image?.caption) return `[imagem] ${image.caption}`;
  if (message.imageMessage || inner.imageMessage) return "[imagem]";

  const video = (message.videoMessage ?? inner.videoMessage) as
    | { caption?: string }
    | undefined;
  if (video?.caption) return `[vídeo] ${video.caption}`;
  if (message.videoMessage || inner.videoMessage) return "[vídeo]";

  const doc = (message.documentMessage ?? inner.documentMessage) as
    | { caption?: string; fileName?: string }
    | undefined;
  if (doc?.caption) return `[documento] ${doc.caption}`;
  if (doc?.fileName) return `[documento] ${doc.fileName}`;
  if (message.documentMessage || inner.documentMessage) return "[documento]";

  if (message.audioMessage || inner.audioMessage) return "[áudio]";
  if (message.stickerMessage || inner.stickerMessage) return "[sticker]";
  if (message.contactMessage || inner.contactMessage) return "[contato]";
  if (message.locationMessage || inner.locationMessage) return "[localização]";

  if (message.viewOnceMessage || inner.interactiveMessage) {
    return parseInteractiveButtonsText(
      inner.interactiveMessage as Record<string, unknown> | undefined
    ) ?? "[botões]";
  }

  return "[mensagem]";
}

export function isPlaceholderWhatsappBody(body: string | null | undefined): boolean {
  const trimmed = body?.trim() ?? "";
  return !trimmed || trimmed === "[mensagem]";
}
