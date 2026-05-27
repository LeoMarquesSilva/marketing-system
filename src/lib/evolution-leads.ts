/** Detecção de leads Click-to-WhatsApp (Meta Ads) — seguro para Client Components. */

export const META_AD_LEAD_TAG = "Tráfego pago";

/** Texto padrão enviado pelo botão "Enviar mensagem" dos anúncios Meta. */
export const META_AD_LEAD_MESSAGE_EXACT =
  "Olá! Tenho interesse e queria mais informações, por favor.";

function normalizeLeadText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function isMetaAdLeadMessage(body: string | null | undefined): boolean {
  if (!body?.trim()) return false;
  const normalized = normalizeLeadText(body);
  if (normalized === normalizeLeadText(META_AD_LEAD_MESSAGE_EXACT)) return true;
  return (
    normalized.includes("tenho interesse") &&
    normalized.includes("mais informacoes")
  );
}

export function isAudioMessageType(
  messageType: string | null | undefined,
  body: string | null | undefined
): boolean {
  if (messageType) {
    const t = messageType.toLowerCase();
    if (t.includes("audio") || t === "ptt") return true;
  }
  return body?.trim() === "[áudio]";
}

export type WhatsappMediaKind = "image" | "video" | "document";

export function getWhatsappMediaKind(
  messageType: string | null | undefined,
  body: string | null | undefined
): WhatsappMediaKind | null {
  const t = (messageType ?? "").toLowerCase();
  if (t.includes("image")) return "image";
  if (t.includes("video")) return "video";
  if (t.includes("document")) return "document";

  const b = (body ?? "").trim().toLowerCase();
  if (b.startsWith("[imagem]")) return "image";
  if (b.startsWith("[vídeo]") || b.startsWith("[video]")) return "video";
  if (b.startsWith("[documento]")) return "document";
  return null;
}

export function isMediaMessageType(
  messageType: string | null | undefined,
  body: string | null | undefined
): boolean {
  return getWhatsappMediaKind(messageType, body) !== null;
}

export function whatsappMediaCaption(
  body: string | null | undefined,
  kind: WhatsappMediaKind
): string | null {
  if (!body?.trim()) return null;
  const prefixes: Record<WhatsappMediaKind, RegExp> = {
    image: /^\[imagem\]\s*/i,
    video: /^\[(?:vídeo|video)\]\s*/i,
    document: /^\[documento\]\s*/i,
  };
  const caption = body.replace(prefixes[kind], "").trim();
  return caption || null;
}

/** Texto amigável para exibir no bubble do chat. */
export function formatWhatsappMessageDisplay(
  body: string | null | undefined,
  messageType: string | null | undefined
): string {
  const raw = body?.trim() ?? "";
  const type = (messageType ?? "").toLowerCase();

  if (raw.startsWith("[lista]")) {
    return raw.replace(/^\[lista\]\s*/, "").trim() || "Lista interativa";
  }
  if (raw.startsWith("[botões]")) {
    return raw.replace(/^\[botões\]\s*/, "").trim() || "Botões de resposta";
  }

  if (raw && raw !== "[mensagem]") return raw;

  if (type.includes("list")) return "Lista interativa";
  if (type.includes("viewonce") || type.includes("button")) {
    return "Botões de resposta (não chegam ao celular via Baileys)";
  }
  if (type.includes("image")) return "Imagem";
  if (type.includes("video")) return "Vídeo";
  if (type.includes("document")) return "Documento";
  if (type.includes("audio")) return "Áudio";
  if (type.includes("sticker")) return "Sticker";

  return raw || "Mensagem";
}
