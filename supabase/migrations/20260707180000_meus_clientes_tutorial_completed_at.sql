ALTER TABLE users
  ADD COLUMN IF NOT EXISTS meus_clientes_tutorial_completed_at timestamptz;

COMMENT ON COLUMN users.meus_clientes_tutorial_completed_at IS
  'Quando o gestor concluiu o tour guiado de Meus Clientes.';
