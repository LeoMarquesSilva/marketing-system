-- GA4 Insights: converte páginas/localização/dispositivo em séries diárias
-- (janela fixa de 28 dias não permitia aplicar filtro de período no painel).

drop table if exists public.ga4_top_pages;
drop table if exists public.ga4_top_locations;
drop table if exists public.ga4_device_snapshot;

create table public.ga4_page_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  page_path text not null,
  page_title text,
  sessions integer not null default 0,
  screen_page_views integer not null default 0,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (metric_date, page_path)
);

create table public.ga4_location_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  city text not null,
  country text not null,
  sessions integer not null default 0,
  active_users integer not null default 0,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (metric_date, city, country)
);

create table public.ga4_device_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  device_category text not null,
  sessions integer not null default 0,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (metric_date, device_category)
);

create index ga4_page_daily_metrics_date_idx on public.ga4_page_daily_metrics (metric_date desc);
create index ga4_location_daily_metrics_date_idx on public.ga4_location_daily_metrics (metric_date desc);
create index ga4_device_daily_metrics_date_idx on public.ga4_device_daily_metrics (metric_date desc);

alter table public.ga4_page_daily_metrics enable row level security;
alter table public.ga4_location_daily_metrics enable row level security;
alter table public.ga4_device_daily_metrics enable row level security;

grant select on public.ga4_page_daily_metrics to authenticated;
grant select on public.ga4_location_daily_metrics to authenticated;
grant select on public.ga4_device_daily_metrics to authenticated;
grant all on public.ga4_page_daily_metrics to service_role;
grant all on public.ga4_location_daily_metrics to service_role;
grant all on public.ga4_device_daily_metrics to service_role;
revoke all on public.ga4_page_daily_metrics from anon;
revoke all on public.ga4_location_daily_metrics from anon;
revoke all on public.ga4_device_daily_metrics from anon;

create policy ga4_page_daily_metrics_select_authenticated
  on public.ga4_page_daily_metrics for select to authenticated using (true);
create policy ga4_location_daily_metrics_select_authenticated
  on public.ga4_location_daily_metrics for select to authenticated using (true);
create policy ga4_device_daily_metrics_select_authenticated
  on public.ga4_device_daily_metrics for select to authenticated using (true);

create policy ga4_page_daily_metrics_all_service
  on public.ga4_page_daily_metrics for all to service_role using (true) with check (true);
create policy ga4_location_daily_metrics_all_service
  on public.ga4_location_daily_metrics for all to service_role using (true) with check (true);
create policy ga4_device_daily_metrics_all_service
  on public.ga4_device_daily_metrics for all to service_role using (true) with check (true);

comment on table public.ga4_page_daily_metrics is 'Visualizações diárias das páginas mais relevantes (GA4)';
comment on table public.ga4_location_daily_metrics is 'Sessões diárias por cidade de origem do público (GA4)';
comment on table public.ga4_device_daily_metrics is 'Sessões diárias por categoria de dispositivo (GA4)';
