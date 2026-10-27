import { formatWhatsappMessageDisplay, isAudioMessageType } from "@/lib/evolution-leads";

/** Mensagem como vem de `whatsapp_messages` (só o que entra no texto da conversa). */
export interface TranscriptMessage {
  from_me: boolean;
  body: string | null;
  message_type?: string | null;
  message_timestamp: string;
  audio_transcript?: string | null;
  quoted_body?: string | null;
  participant_name?: string | null;
}

/** Abertura sempre mantida quando a conversa não cabe inteira (quem é, o que pediu). */
const OPENING_MESSAGES = 6;
const QUOTE_PREVIEW_CHARS = 140;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messageText(message: TranscriptMessage): string {
  if (isAudioMessageType(message.message_type, message.body)) {
    const transcript = message.audio_transcript?.trim();
    return transcript ? `[áudio] "${transcript}"` : "[áudio sem transcrição]";
  }
  return formatWhatsappMessageDisplay(message.body, message.message_type) || "[mensagem sem texto]";
}

export function formatTranscriptLine(
  message: TranscriptMessage,
  options: { leadName: string; isGroup?: boolean }
): string {
  const author = message.from_me
    ? "Escritório"
    : options.isGroup && message.participant_name?.trim()
      ? message.participant_name.trim()
      : options.leadName;
  const quote = message.quoted_body?.trim();
  const quoted = quote
    ? ` (respondendo a: "${quote.length > QUOTE_PREVIEW_CHARS ? `${quote.slice(0, QUOTE_PREVIEW_CHARS)}…` : quote}")`
    : "";
  return `[${formatTimestamp(message.message_timestamp)}] ${author}${quoted}: ${messageText(message)}`;
}

/**
 * Conversa inteira em texto corrido, com as transcrições dos áudios. Se passar
 * de `maxChars`, mantém a abertura e as mensagens mais recentes e avisa quantas
 * ficaram de fora no meio.
 */
export function formatConversationTranscript(
  messages: TranscriptMessage[],
  options: { leadName: string; isGroup?: boolean; maxChars?: number }
): string {
  const lines = messages.map((message) => formatTranscriptLine(message, options));
  const maxChars = options.maxChars ?? Number.POSITIVE_INFINITY;
  const full = lines.join("\n");
  if (full.length <= maxChars || lines.length <= OPENING_MESSAGES) return full;

  const opening = lines.slice(0, OPENING_MESSAGES);
  let budget = maxChars - opening.join("\n").length - 80;
  const recent: string[] = [];
  for (let i = lines.length - 1; i >= OPENING_MESSAGES && budget > 0; i -= 1) {
    budget -= lines[i].length + 1;
    if (budget < 0) break;
    recent.unshift(lines[i]);
  }
  const omitted = lines.length - opening.length - recent.length;
  if (omitted <= 0) return [...opening, ...recent].join("\n");
  const gap = omitted === 1 ? "[… 1 mensagem do meio omitida …]" : `[… ${omitted} mensagens do meio omitidas …]`;
  return [...opening, gap, ...recent].join("\n");
}

/** Dados do lead que ajudam a entender a conversa (só o que estiver preenchido). */
export interface TranscriptLead {
  push_name?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  lead_source?: string | null;
  meta_campaign_name?: string | null;
  meta_adset_name?: string | null;
  meta_ad_title?: string | null;
  site_lead_page_title?: string | null;
  tags?: string[] | null;
  attendance_status?: string | null;
  pipeline_stage?: string | null;
  qualification?: Record<string, unknown> | null;
  notes?: string | null;
  created_at?: string | null;
  is_group?: boolean | null;
  group_subject?: string | null;
}

const LEAD_SOURCE_LABEL: Record<string, string> = {
  meta_ads: "Anúncio Meta",
  site_whatsapp: "Botão de WhatsApp do site",
};

const ATTENDANCE_LABEL: Record<string, string> = {
  nao_respondido: "Esperando resposta do escritório",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Esperando o cliente",
  resolvido: "Resolvida",
};

export function formatLeadSummary(lead: TranscriptLead, ownerName?: string | null): string {
  const qualification = Object.entries(lead.qualification ?? {})
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join("; ");
  const rows: Array<[string, string | null | undefined]> = [
    ["Nome", lead.is_group ? lead.group_subject || lead.push_name : lead.push_name],
    ["Tipo", lead.is_group ? "Grupo do WhatsApp" : null],
    ["Telefone", lead.phone],
    ["Cidade", [lead.city?.trim(), lead.state?.trim()].filter(Boolean).join(" - ")],
    ["Origem", lead.lead_source ? (LEAD_SOURCE_LABEL[lead.lead_source] ?? lead.lead_source) : "Contato direto pelo WhatsApp"],
    ["Campanha", lead.meta_campaign_name || lead.meta_adset_name],
    ["Anúncio", lead.meta_ad_title],
    ["Página do site", lead.site_lead_page_title],
    ["Primeiro contato", lead.created_at ? new Date(lead.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null],
    ["Situação", lead.attendance_status ? ATTENDANCE_LABEL[lead.attendance_status] : null],
    ["Responsável", ownerName],
    ["Etapa comercial", lead.pipeline_stage],
    ["Tags", (lead.tags ?? []).join(", ")],
    ["Qualificação", qualification],
    ["Observações", lead.notes?.trim()],
  ];
  return rows
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/** Áudios ainda sem transcrição, do mais recente para o mais antigo. */
export function audiosWithoutTranscript<T extends TranscriptMessage & { id: string }>(messages: T[]): T[] {
  return messages
    .filter((message) => isAudioMessageType(message.message_type, message.body) && !message.audio_transcript?.trim())
    .reverse();
}
