-- Avatar, atribuição Meta (CTWA) e transcrição de áudio

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS meta_ad_id text,
  ADD COLUMN IF NOT EXISTS meta_ad_title text,
  ADD COLUMN IF NOT EXISTS meta_ad_body text,
  ADD COLUMN IF NOT EXISTS meta_ad_source_url text,
  ADD COLUMN IF NOT EXISTS meta_campaign_name text,
  ADD COLUMN IF NOT EXISTS meta_adset_name text,
  ADD COLUMN IF NOT EXISTS meta_ctwa_clid text,
  ADD COLUMN IF NOT EXISTS meta_conversion_app text;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS audio_transcript text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_meta_ad_id
  ON whatsapp_conversations(meta_ad_id)
  WHERE meta_ad_id IS NOT NULL;

COMMENT ON COLUMN whatsapp_conversations.avatar_url IS 'Foto de perfil WhatsApp (Evolution fetchProfilePictureUrl)';
COMMENT ON COLUMN whatsapp_conversations.meta_ad_id IS 'sourceId do externalAdReply (anúncio Meta) quando disponível';
COMMENT ON COLUMN whatsapp_messages.audio_transcript IS 'Transcrição Whisper do áudio';
