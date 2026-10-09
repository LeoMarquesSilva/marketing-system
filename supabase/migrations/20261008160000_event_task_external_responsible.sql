-- Event suppliers can own part of a task without being internal users.
ALTER TABLE public.event_tasks
  ADD COLUMN external_responsible_name text,
  ADD CONSTRAINT event_tasks_external_responsible_name_length
    CHECK (external_responsible_name IS NULL OR char_length(external_responsible_name) <= 120);

COMMENT ON COLUMN public.event_tasks.external_responsible_name IS
  'Nome de fornecedor ou parceiro responsável, além dos responsáveis internos';
