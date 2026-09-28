-- Registra a conclusão do guia do cronograma para não reapresentá-lo
-- automaticamente em todos os acessos ou dispositivos.
alter table public.users
  add column if not exists content_schedule_tutorial_completed_at timestamptz;
