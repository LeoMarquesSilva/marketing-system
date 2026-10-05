-- O VIOS manda na data: quando a tarefa ligada é remarcada, a vaga acompanha.
-- A data planejada original fica guardada aqui (preenchida uma única vez).
alter table public.content_schedule_slots
  add column if not exists planned_due_date date;

comment on column public.content_schedule_slots.planned_due_date is
  'Data planejada antes de a vaga acompanhar uma remarcação da tarefa VIOS.';
