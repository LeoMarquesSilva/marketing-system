import type { LeadFilter, WhatsappConversation } from "./whatsapp-crm-types";
import {
  isColaboradorConversation,
  isGroupConversation,
  isMetaLead,
  isPaidTrafficLead,
  isSiteLead,
  leadDisplayName,
} from "./whatsapp-crm-utils";

/** Quem é o dono da conversa (abas do topo da lista). */
export type InboxOwnerTab = "mine" | "unassigned" | "all";
/** Em que pé está o atendimento (filtro logo abaixo das abas). */
export type InboxStatusTab = "open" | "waiting" | "resolved";

export const INBOX_OWNER_TABS: Array<{ id: InboxOwnerTab; label: string }> = [
  { id: "mine", label: "Minhas" },
  { id: "unassigned", label: "Sem responsável" },
  { id: "all", label: "Todas" },
];

export const INBOX_STATUS_TABS: Array<{ id: InboxStatusTab; label: string }> = [
  { id: "open", label: "Abertas" },
  { id: "waiting", label: "Aguardando cliente" },
  { id: "resolved", label: "Resolvidas" },
];

/** Sem mensagem há mais que isso, a conversa aberta conta como parada. */
export const STALE_CONVERSATION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `attendance_status` é mantido pelo webhook: mensagem do cliente → nao_respondido
 * (reabre até uma resolvida); resposta nossa → aguardando_cliente.
 */
export function statusTabOf(conversation: WhatsappConversation): InboxStatusTab {
  switch (conversation.attendance_status) {
    case "aguardando_cliente":
      return "waiting";
    case "resolvido":
      return "resolved";
    default:
      return "open";
  }
}

export function matchesOwnerTab(
  conversation: WhatsappConversation,
  tab: InboxOwnerTab,
  myUserId: string | null
): boolean {
  if (tab === "mine") return Boolean(myUserId) && conversation.owner_user_id === myUserId;
  if (tab === "unassigned") return !conversation.owner_user_id;
  return true;
}

function matchesLeadFilter(conversation: WhatsappConversation, filter: LeadFilter): boolean {
  switch (filter) {
    case "unread":
      return conversation.unread_count > 0;
    case "meta_ads":
      return isMetaLead(conversation);
    case "trafego_pago":
      return isPaidTrafficLead(conversation);
    case "site":
      return isSiteLead(conversation);
    case "colaborador":
      return isColaboradorConversation(conversation);
    case "grupo":
      return isGroupConversation(conversation);
    default:
      return true;
  }
}

function matchesSearch(conversation: WhatsappConversation, query: string): boolean {
  if (!query) return true;
  const haystack = [
    conversation.push_name,
    conversation.phone,
    conversation.last_message_preview,
    ...(conversation.tags ?? []),
    conversation.meta_campaign_name,
    conversation.meta_adset_name,
    conversation.site_lead_page_title,
    leadDisplayName(conversation),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export interface InboxView {
  conversations: WhatsappConversation[];
  /** Contagem de cada aba de responsável dentro do status escolhido. */
  ownerCounts: Record<InboxOwnerTab, number>;
  /** Contagem de cada status dentro da aba de responsável escolhida. */
  statusCounts: Record<InboxStatusTab, number>;
}

export function buildInboxView(
  conversations: WhatsappConversation[],
  options: {
    ownerTab: InboxOwnerTab;
    statusTab: InboxStatusTab;
    leadFilter: LeadFilter;
    search: string;
    myUserId: string | null;
  }
): InboxView {
  const query = options.search.trim().toLowerCase();
  const ownerCounts: Record<InboxOwnerTab, number> = { mine: 0, unassigned: 0, all: 0 };
  const statusCounts: Record<InboxStatusTab, number> = { open: 0, waiting: 0, resolved: 0 };
  const visible: WhatsappConversation[] = [];

  for (const conversation of conversations) {
    if (!matchesLeadFilter(conversation, options.leadFilter)) continue;
    if (!matchesSearch(conversation, query)) continue;

    const status = statusTabOf(conversation);
    const inOwnerTab = matchesOwnerTab(conversation, options.ownerTab, options.myUserId);
    if (inOwnerTab) statusCounts[status] += 1;
    if (status !== options.statusTab) continue;

    for (const tab of ["mine", "unassigned", "all"] as const) {
      if (matchesOwnerTab(conversation, tab, options.myUserId)) ownerCounts[tab] += 1;
    }
    if (inOwnerTab) visible.push(conversation);
  }

  return { conversations: visible, ownerCounts, statusCounts };
}

/** A última mensagem da conversa foi nossa? (para o "Você:" da prévia) */
export function lastMessageIsOurs(conversation: WhatsappConversation): boolean {
  const outbound = conversation.last_outbound_at
    ? new Date(conversation.last_outbound_at).getTime()
    : 0;
  const inbound = conversation.last_inbound_at
    ? new Date(conversation.last_inbound_at).getTime()
    : 0;
  return outbound > 0 && outbound >= inbound;
}

/** Desde quando o cliente espera resposta nossa; null se a vez não é nossa (ou é grupo). */
export function waitingSince(conversation: WhatsappConversation): string | null {
  if (statusTabOf(conversation) !== "open" || isGroupConversation(conversation)) return null;
  if (!conversation.last_inbound_at || lastMessageIsOurs(conversation)) return null;
  return conversation.last_inbound_at;
}

export function formatWaitingDuration(since: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 dia" : `${days} dias`;
}

/** Espera longa o bastante para pedir atenção (destaque âmbar na lista). */
export function isLongWait(since: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(since).getTime() >= 60 * 60_000;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Horário da lista: "14:32" hoje, "ontem", dia da semana nesta semana, senão "12/10". */
export function formatListTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (dayDiff <= 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (dayDiff === 1) return "ontem";
  if (dayDiff < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(
    "pt-BR",
    sameYear ? { day: "2-digit", month: "2-digit" } : { day: "2-digit", month: "2-digit", year: "2-digit" }
  );
}

/** Separador de data dentro da conversa: "Hoje", "Ontem" ou "12 de outubro". */
export function formatDaySeparator(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (dayDiff <= 0) return "Hoje";
  if (dayDiff === 1) return "Ontem";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(
    "pt-BR",
    sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }
  );
}

/** Conversa aberta sem mensagem nenhuma (de ninguém) há mais de `days` dias. */
export function isStaleOpenConversation(
  conversation: WhatsappConversation,
  now: Date = new Date(),
  days = STALE_CONVERSATION_DAYS
): boolean {
  if (statusTabOf(conversation) === "resolved") return false;
  return now.getTime() - new Date(conversation.last_message_at).getTime() > days * DAY_MS;
}

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  nao_respondido: "Aberta, esperando resposta",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando o cliente",
  resolvido: "Resolvida",
};

export function attendanceStatusLabel(conversation: WhatsappConversation): string {
  return ATTENDANCE_STATUS_LABEL[conversation.attendance_status ?? "nao_respondido"] ??
    ATTENDANCE_STATUS_LABEL.nao_respondido;
}
