-- Vínculo do post com uma tarefa do VIOS (escolhida pelo colaborador antes do envio).
alter table public.content_roteiros
  add column if not exists vios_task_id uuid references public.vios_tasks(id) on delete set null;

comment on column public.content_roteiros.vios_task_id is
  'Tarefa do VIOS vinculada pelo colaborador a este post antes do envio ao marketing.';
