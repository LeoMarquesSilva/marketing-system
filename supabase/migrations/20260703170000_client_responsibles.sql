-- Responsáveis por cliente (área + advogado responsável, via processos do SIOE)
-- e campos de enriquecimento (cargo/área/sócio) preenchidos pelos gestores.

-- 1) Tabela de "responsabilidades" derivadas dos processos do SIOE.
--    Recriada a cada sync (delete + insert dos grupos processados), sem
--    constraint de unicidade complexa.
CREATE TABLE IF NOT EXISTS email_group_responsibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_group_id uuid NOT NULL REFERENCES email_client_groups(id) ON DELETE CASCADE,
  company_id uuid REFERENCES email_companies(id) ON DELETE CASCADE,
  person_id uuid REFERENCES email_people(id) ON DELETE CASCADE,
  area text,
  advogado_responsavel_name text,
  advogado_responsavel_name_normalized text,
  responsible_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  open_processes_count int NOT NULL DEFAULT 0,
  sioe_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_group_responsibles_group ON email_group_responsibles(client_group_id);
CREATE INDEX IF NOT EXISTS idx_email_group_responsibles_company ON email_group_responsibles(company_id);
CREATE INDEX IF NOT EXISTS idx_email_group_responsibles_person ON email_group_responsibles(person_id);
CREATE INDEX IF NOT EXISTS idx_email_group_responsibles_user ON email_group_responsibles(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_email_group_responsibles_name_norm ON email_group_responsibles(advogado_responsavel_name_normalized);

ALTER TABLE email_group_responsibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler email_group_responsibles" ON email_group_responsibles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_group_responsibles" ON email_group_responsibles FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE email_group_responsibles IS 'Área + advogado responsável por cliente, derivado de processos_completo (SIOE). Recriada a cada sync.';

-- 2) Correções manuais de vínculo advogado -> usuário (sobrevivem a novos syncs).
CREATE TABLE IF NOT EXISTS email_advogado_user_overrides (
  advogado_name_normalized text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE email_advogado_user_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler email_advogado_user_overrides" ON email_advogado_user_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir email_advogado_user_overrides" ON email_advogado_user_overrides FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar email_advogado_user_overrides" ON email_advogado_user_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar email_advogado_user_overrides" ON email_advogado_user_overrides FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_advogado_user_overrides" ON email_advogado_user_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE email_advogado_user_overrides IS 'Vínculo manual (admin) entre nome do advogado_responsavel (SIOE) e usuário do sistema, para casos que o auto-match por nome não resolveu.';

-- 3) Colunas denormalizadas para filtrar rápido "meus clientes".
ALTER TABLE email_client_groups
  ADD COLUMN IF NOT EXISTS legal_areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsible_user_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE email_companies
  ADD COLUMN IF NOT EXISTS legal_areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsible_user_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_email_client_groups_responsible_user_ids ON email_client_groups USING gin(responsible_user_ids);
CREATE INDEX IF NOT EXISTS idx_email_companies_responsible_user_ids ON email_companies USING gin(responsible_user_ids);

COMMENT ON COLUMN email_client_groups.legal_areas IS 'Áreas jurídicas (SIOE processos_completo) detectadas para o grupo.';
COMMENT ON COLUMN email_client_groups.responsible_user_ids IS 'Usuários (advogados) responsáveis por algum processo/empresa do grupo.';
COMMENT ON COLUMN email_companies.legal_areas IS 'Áreas jurídicas (SIOE processos_completo) detectadas para a empresa.';
COMMENT ON COLUMN email_companies.responsible_user_ids IS 'Usuários (advogados) responsáveis por algum processo da empresa.';

-- 4) Campos de enriquecimento preenchidos pelos gestores (finalmente como colunas reais).
ALTER TABLE email_people
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS is_socio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN email_people.cargo IS 'Cargo/função preenchido pelo gestor da área';
COMMENT ON COLUMN email_people.area IS 'Área de atuação preenchida pelo gestor';
COMMENT ON COLUMN email_people.is_socio IS 'Marcado pelo gestor: é sócio/decisor da empresa (convites, NPS, etc.)';

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS is_socio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN email_contacts.cargo IS 'Cargo/função preenchido pelo gestor da área';
COMMENT ON COLUMN email_contacts.is_socio IS 'Marcado pelo gestor: é sócio/decisor da empresa (convites, NPS, etc.)';
