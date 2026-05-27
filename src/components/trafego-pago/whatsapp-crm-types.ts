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
  avatar_url?: string | null;
  meta_ad_id?: string | null;
  meta_ad_title?: string | null;
  meta_ad_body?: string | null;
  meta_ad_source_url?: string | null;
  meta_campaign_name?: string | null;
  meta_adset_name?: string | null;
  meta_ctwa_clid?: string | null;
  meta_conversion_app?: string | null;
  city?: string | null;
  state?: string | null;
  owner_user_id?: string | null;
  pipeline_stage?: string | null;
  qualification?: {
    cipa?: string | null;
    canal_denuncia?: string | null;
    colaboradores?: string | null;
    interesse?: string | null;
  } | null;
  notes?: string | null;
  stage_updated_at?: string | null;
}

export interface WhatsappMessage {
  id: string;
  wa_message_id?: string | null;
  from_me: boolean;
  body: string | null;
  message_type?: string | null;
  message_timestamp: string;
  audio_transcript?: string | null;
  wa_status?: string | null;
  reaction_emoji?: string | null;
  quoted_wa_message_id?: string | null;
  quoted_body?: string | null;
}

export interface WhatsappReplyTarget {
  waMessageId: string;
  body: string | null;
  fromName?: string;
}

export type LeadFilter = "all" | "unread" | "meta_ads" | "trafego_pago";

export type PipelineStage =
  | "lead_recebido"
  | "qualificacao"
  | "reuniao"
  | "proposta"
  | "fechado";
