-- Migração: Tabela vios_tasks para integração com relatório VIOS (MATERIAL MARKETING - REELS/POST/ARTIGO)
-- Uso: importação diária do CSV/Excel; tarefas concluídas podem ser promovidas ao marketing_requests (Planner)

CREATE TABLE IF NOT EXISTS vios_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vios_id TEXT NOT NULL UNIQUE,
  ci_processo TEXT,
  area_processo TEXT,
  tarefa TEXT NOT NULL,
  etiquetas_tarefa TEXT,
  descricao TEXT,
  historico TEXT,
  data_limite DATE,
  data_conclusao TIMESTAMPTZ,
  hora_conclusao TEXT,
  responsaveis TEXT,
  assignee_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  usuario_concluiu TEXT,
  marketing_request_id UUID REFERENCES marketing_requests(id),
  raw_data JSONB,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vios_tasks_vios_id ON vios_tasks(vios_id);
CREATE INDEX IF NOT EXISTS idx_vios_tasks_status ON vios_tasks(status);
CREATE INDEX IF NOT EXISTS idx_vios_tasks_data_limite ON vios_tasks(data_limite);
CREATE INDEX IF NOT EXISTS idx_vios_tasks_assignee_id ON vios_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_vios_tasks_marketing_request_id ON vios_tasks(marketing_request_id);
CREATE INDEX IF NOT EXISTS idx_vios_tasks_imported_at ON vios_tasks(imported_at);

ALTER TABLE vios_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for vios_tasks" ON vios_tasks FOR ALL USING (true) WITH CHECK (true);
