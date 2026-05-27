import { formatConversationLabel, formatPhoneDisplay } from "@/lib/evolution-display";
import type { WhatsappConversation, WhatsappMessage } from "./whatsapp-crm-types";

export function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMessageDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

export function formatRelativeLeadTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60_000));
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function leadDisplayName(conversation: WhatsappConversation) {
  return formatConversationLabel(conversation);
}

export function leadPhone(conversation: WhatsappConversation) {
  return conversation.phone ? formatPhoneDisplay(conversation.phone) : "Telefone não informado";
}

export function leadLocation(conversation: WhatsappConversation) {
  const city = conversation.city?.trim();
  const state = conversation.state?.trim();
  if (city && state) return `${city} - ${state}`;
  if (city) return city;
  if (state) return state;
  return "Não informado";
}

export function leadResponsible(conversation: WhatsappConversation) {
  return conversation.owner_user_id
    ? `Atribuído (${conversation.owner_user_id.slice(0, 8)})`
    : "Sem responsável";
}

export function isMetaLead(conversation: WhatsappConversation) {
  return conversation.lead_source === "meta_ads";
}

export function isPaidTrafficLead(conversation: WhatsappConversation) {
  const haystack = [
    conversation.lead_source,
    conversation.meta_campaign_name,
    conversation.meta_adset_name,
    ...(conversation.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes("tráfego") ||
    haystack.includes("trafego") ||
    haystack.includes("paid") ||
    haystack.includes("meta_ads")
  );
}

export function isHotLead(conversation: WhatsappConversation) {
  const haystack = [
    conversation.last_message_preview,
    ...(conversation.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes("quente") || haystack.includes("urgente") || haystack.includes("🔥");
}

export function leadCampaign(conversation: WhatsappConversation) {
  return conversation.meta_campaign_name || conversation.meta_adset_name || "Campanha não identificada";
}

const PIPELINE_STEPS = [
  "lead_recebido",
  "qualificacao",
  "reuniao",
  "proposta",
  "fechado",
] as const;

type PipelineStep = (typeof PIPELINE_STEPS)[number];

export function pipelineStepIndex(stage?: string | null): number {
  const normalized = (stage ?? "").toLowerCase();
  const idx = PIPELINE_STEPS.indexOf(normalized as PipelineStep);
  return idx >= 0 ? idx : 0;
}

export function messageTextPreview(message: WhatsappMessage | null | undefined) {
  if (!message) return "";
  return message.body?.trim() || "[mensagem sem texto]";
}

export function sameMessageDay(a?: WhatsappMessage, b?: WhatsappMessage) {
  if (!a || !b) return false;
  return (
    new Date(a.message_timestamp).toDateString() ===
    new Date(b.message_timestamp).toDateString()
  );
}
