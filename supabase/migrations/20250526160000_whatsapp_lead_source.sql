-- Origem do lead (Meta Click-to-WhatsApp vs orgânico)

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS lead_source text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_lead_source
  ON whatsapp_conversations(lead_source)
  WHERE lead_source IS NOT NULL;

COMMENT ON COLUMN whatsapp_conversations.lead_source IS 'meta_ads = lead do botão WhatsApp em anúncio Meta';

-- Backfill: mensagem padrão do tráfego pago
UPDATE whatsapp_conversations c
SET lead_source = 'meta_ads',
    tags = CASE
      WHEN tags IS NULL OR tags = '{}' THEN ARRAY['Tráfego pago']::text[]
      WHEN NOT ('Tráfego pago' = ANY(tags)) THEN array_append(tags, 'Tráfego pago')
      ELSE tags
    END
WHERE c.lead_source IS NULL
  AND EXISTS (
    SELECT 1
    FROM whatsapp_messages m
    WHERE m.conversation_id = c.id
      AND m.from_me = false
      AND (
        m.body ILIKE '%tenho interesse e queria mais informações%'
        OR m.body ILIKE '%tenho interesse e queria mais informacoes%'
      )
  );
