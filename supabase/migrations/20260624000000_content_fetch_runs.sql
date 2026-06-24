-- Log de execuções do pipeline de busca de notícias (observabilidade).
-- Permite ver no admin: quando rodou, origem (cron/manual), itens criados,
-- pulados e erros — para detectar quando a busca automática para de funcionar.
create table if not exists public.content_fetch_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'manual',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  topics_processed integer not null default 0,
  created integer not null default 0,
  skipped integer not null default 0,
  error_count integer not null default 0,
  errors jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_fetch_runs_started_idx
  on public.content_fetch_runs (started_at desc);

alter table public.content_fetch_runs enable row level security;

-- Leitura para usuários autenticados; escrita só via service role (pipeline).
create policy "content_fetch_runs_select_authenticated"
  on public.content_fetch_runs
  for select
  to authenticated
  using (true);
