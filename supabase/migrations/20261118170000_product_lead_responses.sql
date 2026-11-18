-- Respostas dos formulários de qualificação dos produtos (ex.: e-book "Fim da escala 6x1").
-- Gravadas só pela API pública (service role); a equipe lê no ORQESTRAI.
CREATE TABLE IF NOT EXISTS product_lead_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES email_contacts(id) ON DELETE SET NULL,
  name text,
  email text NOT NULL,
  company text,
  phone text,
  answers jsonb NOT NULL,
  score integer NOT NULL,
  temperature text NOT NULL CHECK (temperature IN ('frio', 'morno', 'quente')),
  reason text,
  source text NOT NULL DEFAULT 'direto' CHECK (source IN ('email', 'whatsapp', 'direto')),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE product_lead_responses IS
  'Leads dos materiais de produto: respostas do formulário, pontuação e temperatura (frio/morno/quente).';

CREATE INDEX IF NOT EXISTS idx_product_lead_responses_product ON product_lead_responses(product, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_lead_responses_campaign ON product_lead_responses(campaign_id) WHERE campaign_id IS NOT NULL;

ALTER TABLE product_lead_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler product_lead_responses"
  ON product_lead_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a product_lead_responses"
  ON product_lead_responses FOR ALL TO service_role USING (true) WITH CHECK (true);
