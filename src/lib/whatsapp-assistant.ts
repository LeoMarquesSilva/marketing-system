import "server-only";

import { createClient } from "@supabase/supabase-js";
import { fetchWhatsappMessages, transcribeWhatsappAudioMessage } from "@/lib/evolution-whatsapp";
import {
  audiosWithoutTranscript,
  formatConversationTranscript,
  formatLeadSummary,
  formatTranscriptLine,
  type TranscriptLead,
  type TranscriptMessage,
} from "@/lib/whatsapp-conversation-transcript";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Conversas longas: até onde a IA lê (a abertura é sempre mantida). */
const MAX_MESSAGES = 500;
const MAX_TRANSCRIPT_CHARS = 60_000;
/** Áudios transcritos na hora, por pedido (os mais recentes primeiro). */
const MAX_AUDIOS_TO_TRANSCRIBE = 8;
const TRANSCRIBE_CONCURRENCY = 3;

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

const LEAD_COLUMNS =
  "id, push_name, phone, city, state, lead_source, meta_campaign_name, meta_adset_name, meta_ad_title, site_lead_page_title, tags, attendance_status, owner_user_id, pipeline_stage, qualification, notes, created_at, is_group, group_subject";

/** suggest = próxima mensagem; reply = só a mensagem escolhida; improve = melhorar o rascunho. */
export type AssistantMode = "suggest" | "reply" | "improve";

export interface AssistantContext {
  leadSummary: string;
  transcript: string;
  messageCount: number;
  /** Áudios transcritos agora para esta sugestão (ficam salvos na mensagem). */
  transcribedNow: number;
  /** A mensagem escolhida para responder, já com o áudio transcrito. */
  replyToLine: string | null;
}

type ContextMessage = TranscriptMessage & { id: string; wa_message_id?: string | null };

async function transcribePending(messages: Array<TranscriptMessage & { id: string }>): Promise<number> {
  const pending = audiosWithoutTranscript(messages).slice(0, MAX_AUDIOS_TO_TRANSCRIBE);
  let done = 0;
  for (let i = 0; i < pending.length; i += TRANSCRIBE_CONCURRENCY) {
    const batch = pending.slice(i, i + TRANSCRIBE_CONCURRENCY);
    await Promise.all(
      batch.map(async (message) => {
        try {
          message.audio_transcript = await transcribeWhatsappAudioMessage(message.id);
          done += 1;
        } catch {
          // Áudio expirado ou sem arquivo: segue como "[áudio sem transcrição]".
        }
      })
    );
  }
  return done;
}

/**
 * Tudo o que a IA precisa saber da conversa, com os áudios transcritos.
 * `transcribeAudios: false` + `maxTranscriptChars` curto = só o tom recente,
 * para melhorar um rascunho rápido.
 */
export async function loadAssistantContext(
  conversationId: string,
  options: { transcribeAudios?: boolean; maxTranscriptChars?: number; replyToWaMessageId?: string } = {}
): Promise<AssistantContext | null> {
  const db = getAdminClient();
  const { data: lead, error } = await db
    .from("whatsapp_conversations")
    .select(LEAD_COLUMNS)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) return null;

  let ownerName: string | null = null;
  if (lead.owner_user_id) {
    const { data: owner } = await db.from("users").select("name").eq("id", lead.owner_user_id).maybeSingle();
    ownerName = (owner?.name as string | undefined) ?? null;
  }

  const messages = (await fetchWhatsappMessages(conversationId, MAX_MESSAGES)) as ContextMessage[];
  const replyTarget = options.replyToWaMessageId
    ? messages.find((message) => message.wa_message_id === options.replyToWaMessageId) ?? null
    : null;

  let transcribedNow = 0;
  if (options.transcribeAudios !== false) {
    // A mensagem escolhida vem antes dos outros áudios, mesmo sendo antiga.
    if (replyTarget && audiosWithoutTranscript([replyTarget]).length > 0) {
      transcribedNow += await transcribePending([replyTarget]);
    }
    transcribedNow += await transcribePending(messages);
  }

  const leadName = lead.is_group
    ? (lead.group_subject as string | null) || "Grupo"
    : (lead.push_name as string | null)?.trim() || "Cliente";

  return {
    replyToLine: replyTarget
      ? formatTranscriptLine(replyTarget, { leadName, isGroup: Boolean(lead.is_group) })
      : null,
    leadSummary: formatLeadSummary(lead as TranscriptLead, ownerName),
    transcript: formatConversationTranscript(messages, {
      leadName,
      isGroup: Boolean(lead.is_group),
      maxChars: options.maxTranscriptChars ?? MAX_TRANSCRIPT_CHARS,
    }),
    messageCount: messages.length,
    transcribedNow,
  };
}

/** Nome de quem está atendendo, para a IA se apresentar como ele. */
export async function attendantNameForAuth(authId: string): Promise<string | null> {
  const { data } = await getAdminClient().from("users").select("name").eq("auth_id", authId).maybeSingle();
  return (data?.name as string | undefined)?.trim() || null;
}

/** Guarda a sugestão para comparar depois com o que foi enviado. */
export async function saveAssistantSuggestion(input: {
  conversationId: string;
  authId: string;
  draft: string;
  suggestion: string;
  model: string;
  messagesInContext: number;
  mode: AssistantMode;
}): Promise<void> {
  const db = getAdminClient();
  const { data: user } = await db.from("users").select("id").eq("auth_id", input.authId).maybeSingle();
  const { error } = await db.from("whatsapp_ai_suggestions").insert({
    conversation_id: input.conversationId,
    requested_by: (user?.id as string | undefined) ?? null,
    draft: input.draft.trim() || null,
    suggestion: input.suggestion,
    model: input.model,
    messages_in_context: input.messagesInContext,
    mode: input.mode,
  });
  if (error) throw new Error(error.message);
}
