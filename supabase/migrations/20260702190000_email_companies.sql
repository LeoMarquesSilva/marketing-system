-- Empresas vinculadas aos contatos de e-mail marketing

CREATE TABLE IF NOT EXISTS email_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_normalized text NOT NULL,
  city text,
  state text,
  country text,
  website text,
  linkedin text,
  cnpj text,
  source text,
  custom_fields jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_companies_name_normalized_unique UNIQUE (name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_email_companies_name ON email_companies(name);
CREATE INDEX IF NOT EXISTS idx_email_companies_name_normalized ON email_companies(name_normalized);

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES email_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_contacts_company_id ON email_contacts(company_id);

DROP TRIGGER IF EXISTS trg_email_companies_updated_at ON email_companies;
CREATE TRIGGER trg_email_companies_updated_at
  BEFORE UPDATE ON email_companies
  FOR EACH ROW EXECUTE FUNCTION trg_email_marketing_updated_at();

ALTER TABLE email_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler email_companies" ON email_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir email_companies" ON email_companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar email_companies" ON email_companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar email_companies" ON email_companies FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_companies" ON email_companies FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE email_companies IS 'Empresas/organizações vinculadas aos contatos de e-mail marketing';
COMMENT ON COLUMN email_contacts.company_id IS 'Empresa vinculada (email_companies). O campo company (texto) permanece como cache legível.';
