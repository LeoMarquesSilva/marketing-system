-- Permite atribuir uma tarefa a várias pessoas sem quebrar os fluxos que
-- ainda leem assignee_id como responsável principal.
ALTER TABLE public.event_tasks
  ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE public.event_tasks
SET assignee_ids = ARRAY[assignee_id]
WHERE assignee_id IS NOT NULL
  AND cardinality(assignee_ids) = 0;

COMMENT ON COLUMN public.event_tasks.assignee_ids IS
  'Responsáveis da tarefa em ordem de seleção; assignee_id guarda o primeiro para compatibilidade.';
