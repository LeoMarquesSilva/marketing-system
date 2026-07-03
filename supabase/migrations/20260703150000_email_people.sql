-- Pessoas físicas do SIOE (contatos sem e-mail obrigatório, exibidas no grupo/empresa)

CREATE TABLE IF NOT EXISTS email_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sioe_pessoa_id uuid,
  name text NOT NULL,
  email text,
  phone text,
  cpf_cnpj text,
  client_group_id uuid REFERENCES email_client_groups(id) ON DELETE SET NULL,
  company_id uuid REFERENCES email_companies(id) ON DELETE SET NULL,
  source text,
  custom_fields jsonb NOT NULL DEFAULT '{}',
  sioe_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_people_sioe_pessoa_id
  ON email_people(sioe_pessoa_id)
  WHERE sioe_pessoa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_people_client_group_id ON email_people(client_group_id);
CREATE INDEX IF NOT EXISTS idx_email_people_company_id ON email_people(company_id);
CREATE INDEX IF NOT EXISTS idx_email_people_name ON email_people(name);

DROP TRIGGER IF EXISTS trg_email_people_updated_at ON email_people;
CREATE TRIGGER trg_email_people_updated_at
  BEFORE UPDATE ON email_people
  FOR EACH ROW EXECUTE FUNCTION trg_email_marketing_updated_at();

ALTER TABLE email_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler email_people" ON email_people FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir email_people" ON email_people FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar email_people" ON email_people FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar email_people" ON email_people FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_people" ON email_people FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE email_people IS 'Pessoas físicas importadas do SIOE (com ou sem e-mail), exibidas dentro dos grupos de clientes';
