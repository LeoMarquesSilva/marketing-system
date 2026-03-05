-- Permite excluir solicitações do Planner mesmo quando há tarefas VIOS vinculadas.
-- Ao excluir marketing_request, vios_tasks.marketing_request_id passa a NULL (tarefa volta para Tarefas VIOS).

ALTER TABLE vios_tasks DROP CONSTRAINT IF EXISTS vios_tasks_marketing_request_id_fkey;
ALTER TABLE vios_tasks ADD CONSTRAINT vios_tasks_marketing_request_id_fkey
  FOREIGN KEY (marketing_request_id) REFERENCES marketing_requests(id) ON DELETE SET NULL;
