alter table public.vios_tasks
  add column if not exists is_cancelled boolean not null default false,
  add column if not exists source_status text,
  add column if not exists source_synced_at timestamptz;

comment on column public.vios_tasks.is_cancelled is
  'Tarefa cancelada na fonte VIOS/SIOE; permanece armazenada para preservar vínculos, mas não entra no fluxo operacional.';

comment on column public.vios_tasks.source_status is
  'Status textual recebido da fonte mais recente (atualmente SIOE Pro).';

comment on column public.vios_tasks.source_synced_at is
  'Instante em que a tarefa foi reconciliada pela última vez com a fonte.';

create index if not exists vios_tasks_active_deadline_idx
  on public.vios_tasks (data_limite, status)
  where is_cancelled = false;
