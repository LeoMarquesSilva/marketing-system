-- Vínculo com clientes ativos do SIOE (tabela pessoas)

ALTER TABLE email_companies
  ADD COLUMN IF NOT EXISTS sioe_pessoa_id uuid,
  ADD COLUMN IF NOT EXISTS sioe_synced_at timestamptz;

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS sioe_pessoa_id uuid,
  ADD COLUMN IF NOT EXISTS sioe_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_companies_sioe_pessoa_id
  ON email_companies(sioe_pessoa_id)
  WHERE sioe_pessoa_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_contacts_sioe_pessoa_id
  ON email_contacts(sioe_pessoa_id)
  WHERE sioe_pessoa_id IS NOT NULL;

COMMENT ON COLUMN email_companies.sioe_pessoa_id IS 'UUID da pessoa no Supabase SIOE (clientes ativos)';
COMMENT ON COLUMN email_companies.sioe_synced_at IS 'Última sincronização com o SIOE';
COMMENT ON COLUMN email_contacts.sioe_pessoa_id IS 'UUID da pessoa no Supabase SIOE (clientes ativos)';
COMMENT ON COLUMN email_contacts.sioe_synced_at IS 'Última sincronização com o SIOE';
