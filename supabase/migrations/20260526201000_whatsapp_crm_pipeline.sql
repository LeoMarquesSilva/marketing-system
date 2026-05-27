ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'lead_recebido',
  ADD COLUMN IF NOT EXISTS stage_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS qualification jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  event_name text NOT NULL,
  received_count integer NOT NULL DEFAULT 0,
  stored_count integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  error_message text,
  latency_ms integer,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_pipeline_stage
  ON whatsapp_conversations(pipeline_stage);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_owner_user
  ON whatsapp_conversations(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_processed_at
  ON whatsapp_webhook_events(processed_at DESC);

ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_webhook_events'
      AND policyname = 'whatsapp_webhook_events_select_authenticated'
  ) THEN
    CREATE POLICY whatsapp_webhook_events_select_authenticated
      ON whatsapp_webhook_events
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_webhook_events'
      AND policyname = 'whatsapp_webhook_events_all_service'
  ) THEN
    CREATE POLICY whatsapp_webhook_events_all_service
      ON whatsapp_webhook_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON COLUMN whatsapp_conversations.pipeline_stage IS 'Etapa do funil CRM: lead_recebido, qualificacao, reuniao, proposta, fechado';
COMMENT ON COLUMN whatsapp_conversations.qualification IS 'JSON com respostas de qualificação do lead';
COMMENT ON TABLE whatsapp_webhook_events IS 'Auditoria de processamento de webhooks Evolution';
