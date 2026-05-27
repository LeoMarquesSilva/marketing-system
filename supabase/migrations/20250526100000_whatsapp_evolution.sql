-- Mensagens WhatsApp recebidas via Evolution API (webhook)

CREATE TABLE whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remote_jid text NOT NULL,
  phone text,
  push_name text,
  instance_name text NOT NULL DEFAULT 'default',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  last_inbound_at timestamptz,
  unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_name, remote_jid)
);

CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id text NOT NULL,
  remote_jid text NOT NULL,
  from_me boolean NOT NULL DEFAULT false,
  message_type text,
  body text,
  message_timestamp timestamptz NOT NULL,
  instance_name text NOT NULL DEFAULT 'default',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_name, wa_message_id)
);

CREATE INDEX idx_whatsapp_conversations_last_message
  ON whatsapp_conversations(last_message_at DESC);

CREATE INDEX idx_whatsapp_conversations_last_inbound
  ON whatsapp_conversations(last_inbound_at DESC NULLS LAST);

CREATE INDEX idx_whatsapp_messages_conversation
  ON whatsapp_messages(conversation_id, message_timestamp DESC);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_conversations_select_authenticated"
  ON whatsapp_conversations FOR SELECT TO authenticated USING (true);

CREATE POLICY "whatsapp_messages_select_authenticated"
  ON whatsapp_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "whatsapp_conversations_all_service"
  ON whatsapp_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "whatsapp_messages_all_service"
  ON whatsapp_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE whatsapp_conversations IS 'Conversas WhatsApp (Evolution API)';
COMMENT ON TABLE whatsapp_messages IS 'Mensagens WhatsApp individuais';
