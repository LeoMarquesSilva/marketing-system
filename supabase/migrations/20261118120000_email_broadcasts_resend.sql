-- Envio pelo Marketing do Resend (Broadcasts): o plano grátis manda sem limite diário
-- para até 1.000 contatos/mês, enquanto o envio transacional para em 100 por dia.
-- Cada campanha vira um segmento no Resend com os destinatários dela e um broadcast.

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS resend_contact_id text,
  ADD COLUMN IF NOT EXISTS resend_synced_at timestamptz;

COMMENT ON COLUMN email_contacts.resend_contact_id IS
  'ID do contato no Marketing do Resend (criado no primeiro broadcast que o inclui).';

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS send_mode text NOT NULL DEFAULT 'broadcast'
    CHECK (send_mode IN ('broadcast', 'batch')),
  ADD COLUMN IF NOT EXISTS resend_segment_id text,
  ADD COLUMN IF NOT EXISTS resend_broadcast_id text,
  ADD COLUMN IF NOT EXISTS last_error text;

COMMENT ON COLUMN email_campaigns.send_mode IS
  'broadcast = Marketing do Resend (segmento + broadcast); batch = envio transacional em lotes (100/dia no grátis).';

CREATE INDEX IF NOT EXISTS idx_email_campaigns_resend_broadcast
  ON email_campaigns(resend_broadcast_id) WHERE resend_broadcast_id IS NOT NULL;

ALTER TABLE email_campaign_recipients
  ADD COLUMN IF NOT EXISTS segment_added_at timestamptz;

-- 'skipped': contato descadastrado no Resend (o broadcast não chega a ele).
ALTER TABLE email_campaign_recipients DROP CONSTRAINT IF EXISTS email_campaign_recipients_status_check;
ALTER TABLE email_campaign_recipients ADD CONSTRAINT email_campaign_recipients_status_check
  CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'skipped'));

-- PDF de materiais (e-books) linkados nos e-mails dos produtos.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[]
WHERE id = 'MARKETING-SYSTEM-EMAILS';

-- Funil por campanha (cumulativo: quem clicou também abriu e recebeu).
CREATE OR REPLACE VIEW email_campaign_stats WITH (security_invoker = true) AS
SELECT
  campaign_id,
  count(*)::int AS total,
  count(*) FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'))::int AS sent,
  count(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked', 'complained'))::int AS delivered,
  count(*) FILTER (WHERE status IN ('opened', 'clicked') OR open_count > 0)::int AS opened,
  count(*) FILTER (WHERE status = 'clicked' OR click_count > 0)::int AS clicked,
  count(*) FILTER (WHERE status = 'bounced')::int AS bounced,
  count(*) FILTER (WHERE status = 'complained')::int AS complained,
  count(*) FILTER (WHERE status = 'failed')::int AS failed,
  count(*) FILTER (WHERE status = 'skipped')::int AS skipped,
  count(*) FILTER (WHERE status = 'queued')::int AS queued
FROM email_campaign_recipients
GROUP BY campaign_id;

COMMENT ON VIEW email_campaign_stats IS
  'Funil por campanha (cumulativo). security_invoker: respeita o RLS de email_campaign_recipients.';

GRANT SELECT ON email_campaign_stats TO authenticated, service_role;

-- O bucket da migration 20260702230000 não existia no banco (aplicado em 18/11/2026).
-- Público para imagens e PDFs dos e-mails; sem policy de leitura (a URL pública não precisa e ninguém lista os arquivos).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'MARKETING-SYSTEM-EMAILS',
  'MARKETING-SYSTEM-EMAILS',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;
