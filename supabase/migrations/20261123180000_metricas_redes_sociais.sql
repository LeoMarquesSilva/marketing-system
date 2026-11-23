-- Métricas de redes sociais (23/11/2026): coleta diária correta da conta do
-- Instagram, registro das execuções (selo "Atualizado há X h"), capas no Storage,
-- foto semanal dos concorrentes e leitura do período (IA + comentário do marketing).

-- 1) Insights diários da conta: colunas que a coleta nova passa a preencher.
alter table public.instagram_account_insights
  add column if not exists reposts integer not null default 0,
  add column if not exists new_followers integer not null default 0,
  add column if not exists views_reels integer not null default 0,
  add column if not exists views_stories integer not null default 0,
  add column if not exists views_carousel integer not null default 0,
  add column if not exists views_posts integer not null default 0,
  add column if not exists collected_at timestamptz;

comment on column public.instagram_account_insights.new_followers is
  'Novos seguidores do dia (follower_count da Graph API). follows/unfollows vêm de follows_and_unfollows por follow_type.';
comment on column public.instagram_account_insights.views_reels is
  'Visualizações do dia vindas de Reels (views com breakdown media_product_type).';

-- 2) Capas copiadas para o Storage (o link do CDN do Instagram vence em poucos dias).
alter table public.instagram_posts add column if not exists cover_path text;
alter table public.instagram_stories add column if not exists cover_path text;

insert into storage.buckets (id, name, public)
values ('instagram-covers', 'instagram-covers', true)
on conflict (id) do nothing;

-- 3) Execuções da coleta (cron e botão).
create table if not exists public.instagram_sync_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily', 'full', 'stories', 'competitors')),
  trigger text not null default 'cron' check (trigger in ('cron', 'button', 'script')),
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  posts_synced integer not null default 0,
  stories_synced integer not null default 0,
  days_synced integer not null default 0,
  covers_saved integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  error text
);

create index if not exists instagram_sync_runs_kind_started_idx
  on public.instagram_sync_runs (kind, started_at desc);

alter table public.instagram_sync_runs enable row level security;
drop policy if exists instagram_sync_runs_all_service on public.instagram_sync_runs;
create policy instagram_sync_runs_all_service on public.instagram_sync_runs
  for all to service_role using (true) with check (true);
drop policy if exists instagram_sync_runs_select_authenticated on public.instagram_sync_runs;
create policy instagram_sync_runs_select_authenticated on public.instagram_sync_runs
  for select to authenticated using (true);

-- 4) Foto semanal dos concorrentes (perfis cadastrados no Gerador de conteúdo).
create table if not exists public.instagram_competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.content_reference_accounts (id) on delete cascade,
  snapshot_date date not null,
  followers_count integer,
  media_count integer,
  created_at timestamptz not null default now(),
  unique (account_id, snapshot_date)
);

alter table public.instagram_competitor_snapshots enable row level security;
drop policy if exists instagram_competitor_snapshots_all_service on public.instagram_competitor_snapshots;
create policy instagram_competitor_snapshots_all_service on public.instagram_competitor_snapshots
  for all to service_role using (true) with check (true);
drop policy if exists instagram_competitor_snapshots_select_authenticated on public.instagram_competitor_snapshots;
create policy instagram_competitor_snapshots_select_authenticated on public.instagram_competitor_snapshots
  for select to authenticated using (true);

-- 5) Leitura do período: texto da IA + comentário do marketing, por intervalo de datas.
create table if not exists public.social_metrics_notes (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  ai_summary text,
  ai_generated_at timestamptz,
  note text,
  note_updated_by uuid references public.users (id) on delete set null,
  note_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (period_start, period_end)
);

alter table public.social_metrics_notes enable row level security;
drop policy if exists social_metrics_notes_all_service on public.social_metrics_notes;
create policy social_metrics_notes_all_service on public.social_metrics_notes
  for all to service_role using (true) with check (true);
drop policy if exists social_metrics_notes_select_authenticated on public.social_metrics_notes;
create policy social_metrics_notes_select_authenticated on public.social_metrics_notes
  for select to authenticated using (true);
