-- Módulo de E-mail Marketing (substitui o RD Station Marketing)

CREATE TABLE IF NOT EXISTS email_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  phone text,
  company text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'subscribed'
    CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  source text,
  custom_fields jsonb NOT NULL DEFAULT '{}',
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_contacts_status ON email_contacts(status);
CREATE INDEX IF NOT EXISTS idx_email_contacts_tags ON email_contacts USING gin(tags);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_contacts_unsub_token ON email_contacts(unsubscribe_token);

CREATE TABLE IF NOT EXISTS email_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_list_contacts (
  list_id uuid NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_email_list_contacts_contact ON email_list_contacts(contact_id);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  from_name text NOT NULL,
  from_email text NOT NULL,
  reply_to text,
  html_body text NOT NULL DEFAULT '',
  list_id uuid REFERENCES email_lists(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_recipients int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  resend_email_id text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  open_count int NOT NULL DEFAULT 0,
  click_count int NOT NULL DEFAULT 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  first_clicked_at timestamptz,
  bounced_at timestamptz,
  bounce_type text,
  complained_at timestamptz,
  sent_at timestamptz,
  failed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_contact ON email_campaign_recipients(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_resend_id ON email_campaign_recipients(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_status ON email_campaign_recipients(status);

CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON email_events(campaign_recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);

CREATE OR REPLACE FUNCTION trg_email_marketing_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_contacts_updated_at ON email_contacts;
CREATE TRIGGER trg_email_contacts_updated_at
  BEFORE UPDATE ON email_contacts
  FOR EACH ROW EXECUTE FUNCTION trg_email_marketing_updated_at();

DROP TRIGGER IF EXISTS trg_email_lists_updated_at ON email_lists;
CREATE TRIGGER trg_email_lists_updated_at
  BEFORE UPDATE ON email_lists
  FOR EACH ROW EXECUTE FUNCTION trg_email_marketing_updated_at();

DROP TRIGGER IF EXISTS trg_email_campaigns_updated_at ON email_campaigns;
CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION trg_email_marketing_updated_at();

ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_list_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler email_contacts" ON email_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir email_contacts" ON email_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar email_contacts" ON email_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar email_contacts" ON email_contacts FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_contacts" ON email_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ler email_lists" ON email_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir email_lists" ON email_lists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar email_lists" ON email_lists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar email_lists" ON email_lists FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_lists" ON email_lists FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ler email_list_contacts" ON email_list_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir email_list_contacts" ON email_list_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar email_list_contacts" ON email_list_contacts FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_list_contacts" ON email_list_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ler email_campaigns" ON email_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir email_campaigns" ON email_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar email_campaigns" ON email_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar email_campaigns" ON email_campaigns FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_campaigns" ON email_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ler email_campaign_recipients" ON email_campaign_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_campaign_recipients" ON email_campaign_recipients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ler email_events" ON email_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_events" ON email_events FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE email_contacts IS 'Base de contatos para e-mail marketing/newsletter (substitui RD Station Marketing)';
COMMENT ON TABLE email_lists IS 'Listas/segmentos de contatos';
COMMENT ON TABLE email_campaigns IS 'Campanhas/newsletters de e-mail marketing';
COMMENT ON TABLE email_campaign_recipients IS 'Status de envio/engajamento por destinatário e campanha (aberturas/cliques via Resend)';
COMMENT ON TABLE email_events IS 'Log bruto de eventos recebidos via webhook do Resend';
