import { formatPhoneDisplay } from "@/lib/evolution-display";
import type { WhatsappMessage } from "./whatsapp-crm-types";

/**
 * Cores do nome de quem escreve no grupo (como no WhatsApp): fixas por pessoa e
 * legíveis sobre a bolha branca. Texto e fundo do círculo de iniciais.
 */
const PARTICIPANT_COLORS = [
  { text: "text-[#285f7a]", circle: "bg-[#347796]/15 text-[#285f7a]" },
  { text: "text-[#48466e]", circle: "bg-[#48466e]/15 text-[#48466e]" },
  { text: "text-[#8a4b08]", circle: "bg-[#8a4b08]/15 text-[#8a4b08]" },
  { text: "text-[#0f6e56]", circle: "bg-[#0f6e56]/15 text-[#0f6e56]" },
  { text: "text-[#993556]", circle: "bg-[#993556]/15 text-[#993556]" },
  { text: "text-[#5f5e5a]", circle: "bg-[#5f5e5a]/15 text-[#5f5e5a]" },
] as const;

/** Quem mandou a mensagem no grupo: nome, senão telefone, senão "Participante". */
export function participantLabel(message: Pick<WhatsappMessage, "participant_name" | "participant_phone">): string {
  const name = message.participant_name?.trim();
  if (name) return name;
  const phone = message.participant_phone?.trim();
  if (phone) return formatPhoneDisplay(phone);
  return "Participante";
}

/** Chave estável da pessoa (o nome pode faltar em mensagens antigas). */
export function participantKey(message: Pick<WhatsappMessage, "participant_name" | "participant_phone">): string {
  return (message.participant_phone?.replace(/\D/g, "") || message.participant_name?.trim().toLowerCase() || "").trim();
}

export function participantColor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PARTICIPANT_COLORS[hash % PARTICIPANT_COLORS.length];
}

export function participantInitials(label: string): string {
  const parts = label.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * Mostra nome e iniciais só na primeira mensagem de uma sequência da mesma
 * pessoa (como no WhatsApp); troca de pessoa, de dia ou mensagem nossa reinicia.
 */
export function startsParticipantRun(
  previous: Pick<WhatsappMessage, "from_me" | "participant_name" | "participant_phone" | "message_timestamp"> | undefined,
  current: Pick<WhatsappMessage, "from_me" | "participant_name" | "participant_phone" | "message_timestamp">
): boolean {
  if (current.from_me) return false;
  if (!previous || previous.from_me) return true;
  if (new Date(previous.message_timestamp).toDateString() !== new Date(current.message_timestamp).toDateString()) {
    return true;
  }
  return participantKey(previous) !== participantKey(current);
}
