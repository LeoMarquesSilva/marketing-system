ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_tags
  ON whatsapp_conversations USING GIN (tags);

COMMENT ON COLUMN whatsapp_conversations.tags IS 'Tags de classificação do lead (ex: CONFIARA, quente, follow-up)';
