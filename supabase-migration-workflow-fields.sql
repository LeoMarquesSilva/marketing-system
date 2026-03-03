-- Migração: Workflow Kanban Planner
-- Adiciona campos para workflow, link, referências, nome do advogado e assignee_id

-- 1. Novos campos em marketing_requests
ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS referencias TEXT;
ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS nome_advogado TEXT;
ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS workflow_stage TEXT DEFAULT 'tarefas';
ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id);

-- 2. Migrar status existente para workflow_stage
UPDATE marketing_requests
SET workflow_stage = CASE
  WHEN status = 'pending' THEN 'tarefas'
  WHEN status = 'in_progress' THEN 'revisao'
  WHEN status = 'completed' THEN 'concluido'
  ELSE 'tarefas'
END
WHERE workflow_stage IS NULL OR workflow_stage = '';

-- 3. Garantir default para novas linhas
ALTER TABLE marketing_requests ALTER COLUMN workflow_stage SET DEFAULT 'tarefas';

-- 4. Índice para workflow_stage (consultas do Kanban)
CREATE INDEX IF NOT EXISTS idx_marketing_requests_workflow_stage ON marketing_requests(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_marketing_requests_assignee_id ON marketing_requests(assignee_id);

-- 5. Campo role em users (para identificar designers)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
