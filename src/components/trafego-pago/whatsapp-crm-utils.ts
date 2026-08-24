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

/** Lead que veio do botão de WhatsApp do site institucional (não de anúncio pago). */
export function isSiteLead(conversation: WhatsappConversation) {
  return conversation.lead_source === "site_whatsapp";
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

/**
 * Funcionário do escritório usando o número comercial pra assunto interno —
 * não tem como detectar automaticamente sem cadastro de telefone, então é
 * uma tag manual (igual "Meta Ads"/"Site", mas aplicada por quem atende).
 */
export function isColaboradorConversation(conversation: WhatsappConversation) {
  return (conversation.tags ?? []).some((t) => t.toLowerCase() === "colaborador");
}

/** Conversa de grupo do WhatsApp (JID @g.us) — identificado direto no payload da Evolution. */
export function isGroupConversation(conversation: WhatsappConversation) {
  return Boolean(conversation.is_group);
}

export type LeadOrigin = "meta_ads" | "site" | "colaborador" | "trafego_pago" | "grupo" | "outros";

export interface LeadOriginInfo {
  origin: LeadOrigin;
  label: string;
  colorClass: string;
}

/** Uma única etiqueta de origem por conversa, pra mostrar no card do Kanban. */
export function leadOrigin(conversation: WhatsappConversation): LeadOriginInfo {
  if (isGroupConversation(conversation)) {
    return { origin: "grupo", label: "Grupo", colorClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400" };
  }
  if (isColaboradorConversation(conversation)) {
    return { origin: "colaborador", label: "Colaborador", colorClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };
  }
  if (isMetaLead(conversation)) {
    return { origin: "meta_ads", label: "Meta Ads", colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" };
  }
  if (isSiteLead(conversation)) {
    return { origin: "site", label: "Site", colorClass: "bg-[#47cdd0]/15 text-[#04202f] dark:text-[#47cdd0]" };
  }
  if (isPaidTrafficLead(conversation)) {
    return { origin: "trafego_pago", label: "Tráfego Pago", colorClass: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" };
  }
  return { origin: "outros", label: "Lead", colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" };
}

export const ATTENDANCE_STATUS_COLUMNS = [
  { id: "nao_respondido", label: "Não respondido" },
  { id: "em_atendimento", label: "Em atendimento" },
  { id: "aguardando_cliente", label: "Aguardando cliente" },
  { id: "resolvido", label: "Resolvido" },
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS_COLUMNS)[number]["id"];

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
