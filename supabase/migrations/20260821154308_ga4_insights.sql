-- GA4 Insights: métricas diárias do site institucional, canais de tráfego e páginas mais vistas.

create table if not exists public.ga4_imports (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  daily_rows integer not null default 0,
  channel_rows integer not null default 0,
  page_rows integer not null default 0,
  date_from date,
  date_to date,
  error text,
  imported_at timestamptz not null default now()
);

create table if not exists public.ga4_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null unique,
  sessions integer not null default 0,
  active_users integer not null default 0,
  new_users integer not null default 0,
  screen_page_views integer not null default 0,
  engaged_sessions integer not null default 0,
  user_engagement_duration_seconds double precision not null default 0,
  event_count integer not null default 0,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ga4_channel_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  channel_group text not null,
  sessions integer not null default 0,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (metric_date, channel_group)
);

create table if not exists public.ga4_top_pages (
  id uuid primary key default gen_random_uuid(),
  page_path text not null unique,
  page_title text,
  sessions integer not null default 0,
  screen_page_views integer not null default 0,
  period_days integer not null default 28,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists ga4_daily_metrics_date_idx
  on public.ga4_daily_metrics (metric_date desc);
create index if not exists ga4_channel_daily_metrics_date_idx
  on public.ga4_channel_daily_metrics (metric_date desc);
create index if not exists ga4_top_pages_views_idx
  on public.ga4_top_pages (screen_page_views desc);
create index if not exists ga4_imports_imported_at_idx
  on public.ga4_imports (imported_at desc);

alter table public.ga4_imports enable row level security;
alter table public.ga4_daily_metrics enable row level security;
alter table public.ga4_channel_daily_metrics enable row level security;
alter table public.ga4_top_pages enable row level security;

grant select on public.ga4_imports to authenticated;
grant select on public.ga4_daily_metrics to authenticated;
grant select on public.ga4_channel_daily_metrics to authenticated;
grant select on public.ga4_top_pages to authenticated;
grant all on public.ga4_imports to service_role;
grant all on public.ga4_daily_metrics to service_role;
grant all on public.ga4_channel_daily_metrics to service_role;
grant all on public.ga4_top_pages to service_role;
revoke all on public.ga4_imports from anon;
revoke all on public.ga4_daily_metrics from anon;
revoke all on public.ga4_channel_daily_metrics from anon;
revoke all on public.ga4_top_pages from anon;

create policy ga4_imports_select_authenticated
  on public.ga4_imports for select to authenticated using (true);
create policy ga4_daily_metrics_select_authenticated
  on public.ga4_daily_metrics for select to authenticated using (true);
create policy ga4_channel_daily_metrics_select_authenticated
  on public.ga4_channel_daily_metrics for select to authenticated using (true);
create policy ga4_top_pages_select_authenticated
  on public.ga4_top_pages for select to authenticated using (true);

create policy ga4_imports_all_service
  on public.ga4_imports for all to service_role using (true) with check (true);
create policy ga4_daily_metrics_all_service
  on public.ga4_daily_metrics for all to service_role using (true) with check (true);
create policy ga4_channel_daily_metrics_all_service
  on public.ga4_channel_daily_metrics for all to service_role using (true) with check (true);
create policy ga4_top_pages_all_service
  on public.ga4_top_pages for all to service_role using (true) with check (true);

comment on table public.ga4_imports is 'Histórico das sincronizações com a Google Analytics Data API (GA4)';
comment on table public.ga4_daily_metrics is 'Métricas diárias agregadas do site institucional (GA4)';
comment on table public.ga4_channel_daily_metrics is 'Sessões diárias por canal de aquisição (GA4)';
comment on table public.ga4_top_pages is 'Páginas mais visitadas na janela móvel mais recente (GA4)';
