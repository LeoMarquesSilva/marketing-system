-- Tabela de to-dos do módulo Clima Organizacional
CREATE TABLE IF NOT EXISTS clima_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  responsible text,
  due_date date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('alta', 'normal', 'baixa')),
  action_plan_id text,
  indicator_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clima_todos_status ON clima_todos(status);
CREATE INDEX IF NOT EXISTS idx_clima_todos_created_at ON clima_todos(created_at DESC);

-- RLS: permitir leitura e escrita para usuários autenticados
ALTER TABLE clima_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler clima_todos"
  ON clima_todos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir clima_todos"
  ON clima_todos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar clima_todos"
  ON clima_todos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar clima_todos"
  ON clima_todos FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE clima_todos IS 'To-dos e tarefas do módulo Clima Organizacional';
