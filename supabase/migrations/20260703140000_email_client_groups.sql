-- Grupos de clientes (SIOE: grupo_cliente) encabeçam empresas e pessoas

CREATE TABLE IF NOT EXISTS email_client_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_normalized text NOT NULL,
  source text,
  sioe_synced_at timestamptz,
  custom_fields jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_client_groups_name_normalized_unique UNIQUE (name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_email_client_groups_name ON email_client_groups(name);

ALTER TABLE email_companies
  ADD COLUMN IF NOT EXISTS client_group_id uuid REFERENCES email_client_groups(id) ON DELETE SET NULL;

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS client_group_id uuid REFERENCES email_client_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_companies_client_group_id ON email_companies(client_group_id);
CREATE INDEX IF NOT EXISTS idx_email_contacts_client_group_id ON email_contacts(client_group_id);

DROP TRIGGER IF EXISTS trg_email_client_groups_updated_at ON email_client_groups;
CREATE TRIGGER trg_email_client_groups_updated_at
  BEFORE UPDATE ON email_client_groups
  FOR EACH ROW EXECUTE FUNCTION trg_email_marketing_updated_at();

ALTER TABLE email_client_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler email_client_groups" ON email_client_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir email_client_groups" ON email_client_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar email_client_groups" ON email_client_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar email_client_groups" ON email_client_groups FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_client_groups" ON email_client_groups FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE email_client_groups IS 'Grupos de clientes (SIOE grupo_cliente) — nível superior de empresas e contatos';
COMMENT ON COLUMN email_companies.client_group_id IS 'Grupo de clientes ao qual a empresa pertence';
COMMENT ON COLUMN email_contacts.client_group_id IS 'Grupo de clientes ao qual o contato pertence';
