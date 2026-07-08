-- Status comercial confirmado pelo gestor (Meus Clientes)

ALTER TABLE email_client_groups
  ADD COLUMN IF NOT EXISTS gestor_atividade text
    CHECK (gestor_atividade IS NULL OR gestor_atividade IN ('ativo', 'inativo')),
  ADD COLUMN IF NOT EXISTS contrato_vigencia_termino date,
  ADD COLUMN IF NOT EXISTS rescisao_contratual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gestor_atividade_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gestor_atividade_confirmed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN email_client_groups.gestor_atividade IS
  'Status comercial confirmado pelo gestor: ativo ou inativo.';
COMMENT ON COLUMN email_client_groups.contrato_vigencia_termino IS
  'Término da vigência contratual (obrigatório quando inativo).';
COMMENT ON COLUMN email_client_groups.rescisao_contratual IS
  'Indica rescisão contratual (informado quando inativo).';
COMMENT ON COLUMN email_client_groups.gestor_atividade_confirmed_at IS
  'Quando o gestor confirmou o status comercial do grupo.';
COMMENT ON COLUMN email_client_groups.gestor_atividade_confirmed_by_user_id IS
  'Usuário que confirmou o status comercial do grupo.';
