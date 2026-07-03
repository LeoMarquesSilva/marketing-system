-- Gestores por área jurídica: define quem (sócio/gerente da área) deve
-- enxergar TODOS os clientes daquela área em "Meus Clientes", independente
-- de qual advogado específico aparece como responsável em cada processo.
CREATE TABLE IF NOT EXISTS email_area_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (area, user_id)
);

CREATE INDEX IF NOT EXISTS idx_email_area_managers_area ON email_area_managers(area);
CREATE INDEX IF NOT EXISTS idx_email_area_managers_user ON email_area_managers(user_id);

ALTER TABLE email_area_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler email_area_managers" ON email_area_managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir email_area_managers" ON email_area_managers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar email_area_managers" ON email_area_managers FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role tem acesso total a email_area_managers" ON email_area_managers FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE email_area_managers IS 'Sócio/gerente responsável por cada área jurídica — vê todos os clientes da área em "Meus Clientes", além dos vínculos individuais por processo.';

-- Seed inicial definido pelo escritório (2026-07-03).
INSERT INTO email_area_managers (area, user_id)
SELECT area, u.id
FROM (VALUES
  ('Trabalhista', 'daniel@bismarchipires.com.br'),
  ('Trabalhista', 'renato@bismarchipires.com.br'),
  ('Cível', 'giancarlo@bismarchipires.com.br'),
  ('Cível', 'gabriela.consul@bismarchipires.com.br'),
  ('Recuperação de Crédito', 'giancarlo@bismarchipires.com.br'),
  ('Recuperação de Crédito', 'gabriela.consul@bismarchipires.com.br'),
  ('Insolvência', 'jorge@bismarchipires.com.br'),
  ('Insolvência', 'leonardo@bismarchipires.com.br'),
  ('Insolvência', 'ligia@bismarchipires.com.br'),
  ('Insolvência', 'ana.tavares@bismarchipires.com.br'),
  ('Cível | Insolvência', 'jorge@bismarchipires.com.br'),
  ('Cível | Insolvência', 'leonardo@bismarchipires.com.br'),
  ('Cível | Insolvência', 'ligia@bismarchipires.com.br'),
  ('Cível | Insolvência', 'ana.tavares@bismarchipires.com.br'),
  ('Contratos', 'wagner.armani@bismarchipires.com.br'),
  ('Contratos', 'henrique.nascimento@bismarchipires.com.br'),
  ('Tributário', 'francisco.zanin@bismarchipires.com.br')
) AS seed(area, email)
JOIN users u ON u.email = seed.email
ON CONFLICT (area, user_id) DO NOTHING;
