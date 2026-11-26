-- E-book pelo link do Linktree (Reels) e outros canais: formulário curto (nome, WhatsApp, e-mail e
-- "Você é:") libera o PDF na hora; as 5 perguntas de qualificação ficam opcionais depois do download.
-- O funil de cada material (visita → começou → lead → baixou → respondeu as perguntas) fica em
-- product_material_events. Nenhum IP é guardado: o visitante é um id anônimo do navegador.

ALTER TABLE product_lead_responses
  ALTER COLUMN answers SET DEFAULT '{}'::jsonb,
  ALTER COLUMN score DROP NOT NULL,
  ALTER COLUMN temperature DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS profile text,
  ADD COLUMN IF NOT EXISTS visitor_id uuid,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_download_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_download_at timestamptz;

ALTER TABLE product_lead_responses DROP CONSTRAINT IF EXISTS product_lead_responses_profile_check;
ALTER TABLE product_lead_responses ADD CONSTRAINT product_lead_responses_profile_check
  CHECK (profile IS NULL OR profile IN ('empresario', 'rh', 'contador_advogado', 'funcionario'));

ALTER TABLE product_lead_responses DROP CONSTRAINT IF EXISTS product_lead_responses_source_check;
ALTER TABLE product_lead_responses ADD CONSTRAINT product_lead_responses_source_check
  CHECK (source IN ('email', 'whatsapp', 'instagram', 'linkedin', 'site', 'direto'));

COMMENT ON COLUMN product_lead_responses.profile IS 'Quem é ("Você é:"): empresario, rh, contador_advogado ou funcionario.';
COMMENT ON COLUMN product_lead_responses.qualified_at IS 'Quando respondeu as perguntas de qualificação (vazio = só baixou).';

CREATE TABLE IF NOT EXISTS product_material_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product text NOT NULL,
  event text NOT NULL CHECK (event IN ('visita', 'inicio', 'lead', 'download', 'qualificacao')),
  source text NOT NULL DEFAULT 'direto',
  visitor_id uuid,
  lead_id uuid REFERENCES product_lead_responses(id) ON DELETE SET NULL,
  utm_source text,
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE product_material_events IS
  'Funil dos materiais de produto (visita, início do formulário, lead, download, qualificação) por origem. Sem IP.';

CREATE INDEX IF NOT EXISTS idx_product_material_events_product_date ON product_material_events(product, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_material_events_lead ON product_material_events(lead_id) WHERE lead_id IS NOT NULL;

ALTER TABLE product_material_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ler product_material_events" ON product_material_events;
CREATE POLICY "Usuários autenticados podem ler product_material_events"
  ON product_material_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role tem acesso total a product_material_events" ON product_material_events;
CREATE POLICY "Service role tem acesso total a product_material_events"
  ON product_material_events FOR ALL TO service_role USING (true) WITH CHECK (true);
