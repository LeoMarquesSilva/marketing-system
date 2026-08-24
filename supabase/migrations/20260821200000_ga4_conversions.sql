-- GA4 Insights: conversões (leads reais, não só tráfego) por dia, por página de
-- entrada e por tipo de evento-chave já configurado na propriedade.

alter table public.ga4_daily_metrics
  add column if not exists conversions integer not null default 0;

create table if not exists public.ga4_landing_page_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  landing_page text not null,
  sessions integer not null default 0,
  conversions integer not null default 0,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (metric_date, landing_page)
);

create table if not exists public.ga4_key_event_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  event_name text not null,
  event_count integer not null default 0,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (metric_date, event_name)
);

create index if not exists ga4_landing_page_daily_metrics_date_idx
  on public.ga4_landing_page_daily_metrics (metric_date desc);
create index if not exists ga4_key_event_daily_metrics_date_idx
  on public.ga4_key_event_daily_metrics (metric_date desc);

alter table public.ga4_landing_page_daily_metrics enable row level security;
alter table public.ga4_key_event_daily_metrics enable row level security;

grant select on public.ga4_landing_page_daily_metrics to authenticated;
grant select on public.ga4_key_event_daily_metrics to authenticated;
grant all on public.ga4_landing_page_daily_metrics to service_role;
grant all on public.ga4_key_event_daily_metrics to service_role;
revoke all on public.ga4_landing_page_daily_metrics from anon;
revoke all on public.ga4_key_event_daily_metrics from anon;

create policy ga4_landing_page_daily_metrics_select_authenticated
  on public.ga4_landing_page_daily_metrics for select to authenticated using (true);
create policy ga4_key_event_daily_metrics_select_authenticated
  on public.ga4_key_event_daily_metrics for select to authenticated using (true);

create policy ga4_landing_page_daily_metrics_all_service
  on public.ga4_landing_page_daily_metrics for all to service_role using (true) with check (true);
create policy ga4_key_event_daily_metrics_all_service
  on public.ga4_key_event_daily_metrics for all to service_role using (true) with check (true);

comment on table public.ga4_landing_page_daily_metrics is 'Sessões e conversões por página de entrada (GA4) — mostra quais páginas geram leads de verdade';
comment on table public.ga4_key_event_daily_metrics is 'Contagem diária por evento-chave configurado na propriedade GA4 (ex.: form_submit, conversão de anúncio)';
