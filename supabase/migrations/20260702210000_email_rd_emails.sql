-- E-mails enviados importados do RD Station Marketing

CREATE TABLE IF NOT EXISTS email_rd_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rd_email_id bigint NOT NULL UNIQUE,
  rd_campaign_id bigint,
  name text NOT NULL,
  status text,
  send_at timestamptz,
  leads_count int NOT NULL DEFAULT 0,
  analytics jsonb NOT NULL DEFAULT '{}',
  raw_data jsonb NOT NULL DEFAULT '{}',
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_rd_emails_send_at ON email_rd_emails(send_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_email_rd_emails_status ON email_rd_emails(status);

DROP TRIGGER IF EXISTS trg_email_rd_emails_updated_at ON email_rd_emails;
CREATE TRIGGER trg_email_rd_emails_updated_at
  BEFORE UPDATE ON email_rd_emails
  FOR EACH ROW EXECUTE FUNCTION trg_email_marketing_updated_at();

ALTER TABLE email_rd_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler email_rd_emails" ON email_rd_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_rd_emails" ON email_rd_emails FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE email_rd_emails IS 'Histórico de e-mails enviados no RD Station Marketing (importação read-only)';
