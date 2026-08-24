-- Grupos do WhatsApp deixam de ser descartados na ingestão: passam a ser
-- identificados (is_group) e exibidos com o nome do grupo (group_subject).
-- Nas mensagens, guardamos quem enviou dentro do grupo (participant_*),
-- já que o remetente de uma mensagem de grupo não é o remote_jid da conversa.

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_subject text;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS participant_phone text,
  ADD COLUMN IF NOT EXISTS participant_name text;

-- Backfill: qualquer conversa antiga com JID de grupo que já tenha entrado
-- no banco por algum outro caminho fica corretamente marcada.
UPDATE whatsapp_conversations
SET is_group = true
WHERE remote_jid LIKE '%@g.us' AND is_group = false;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_is_group
  ON whatsapp_conversations(is_group);

COMMENT ON COLUMN whatsapp_conversations.is_group IS 'true quando remote_jid é um grupo (@g.us)';
COMMENT ON COLUMN whatsapp_conversations.group_subject IS 'Nome do grupo, buscado na Evolution API na criação da conversa';
COMMENT ON COLUMN whatsapp_messages.participant_phone IS 'Telefone de quem enviou a mensagem dentro do grupo (null em conversas 1:1)';
COMMENT ON COLUMN whatsapp_messages.participant_name IS 'Nome de quem enviou a mensagem dentro do grupo (null em conversas 1:1)';
