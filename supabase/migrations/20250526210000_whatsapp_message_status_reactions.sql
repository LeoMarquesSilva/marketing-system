-- Status de entrega/leitura, citações e reações recebidas

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS wa_status text DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS reaction_emoji text,
  ADD COLUMN IF NOT EXISTS quoted_wa_message_id text,
  ADD COLUMN IF NOT EXISTS quoted_body text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
  ON whatsapp_messages(wa_status)
  WHERE from_me = true;

COMMENT ON COLUMN whatsapp_messages.wa_status IS 'pending|sent|delivered|read|played';
COMMENT ON COLUMN whatsapp_messages.reaction_emoji IS 'Última reação recebida nesta mensagem';
COMMENT ON COLUMN whatsapp_messages.quoted_wa_message_id IS 'wa_message_id citado';
COMMENT ON COLUMN whatsapp_messages.quoted_body IS 'Preview da mensagem citada';
