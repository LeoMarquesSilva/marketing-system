-- LinkedIn Insights: seguidores, visitantes e recortes demográficos.

alter table public.linkedin_imports
  add column if not exists report_type text not null default 'content',
  add column if not exists demographic_rows integer not null default 0;

alter table public.linkedin_imports
  add constraint linkedin_imports_report_type_check
  check (report_type in ('content', 'followers', 'visitors'));

create table if not exists public.linkedin_follower_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null unique,
  sponsored_followers integer not null default 0,
  organic_followers integer not null default 0,
  auto_invited_followers integer not null default 0,
  total_followers integer not null default 0,
  source_import_id uuid references public.linkedin_imports(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.linkedin_visitor_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null unique,
  overview_views_desktop integer not null default 0,
  overview_views_mobile integer not null default 0,
  overview_views_total integer not null default 0,
  overview_unique_desktop integer not null default 0,
  overview_unique_mobile integer not null default 0,
  overview_unique_total integer not null default 0,
  life_views_desktop integer not null default 0,
  life_views_mobile integer not null default 0,
  life_views_total integer not null default 0,
  life_unique_desktop integer not null default 0,
  life_unique_mobile integer not null default 0,
  life_unique_total integer not null default 0,
  jobs_views_desktop integer not null default 0,
  jobs_views_mobile integer not null default 0,
  jobs_views_total integer not null default 0,
  jobs_unique_desktop integer not null default 0,
  jobs_unique_mobile integer not null default 0,
  jobs_unique_total integer not null default 0,
  total_views_desktop integer not null default 0,
  total_views_mobile integer not null default 0,
  total_views_total integer not null default 0,
  total_unique_desktop integer not null default 0,
  total_unique_mobile integer not null default 0,
  total_unique_total integer not null default 0,
  source_import_id uuid references public.linkedin_imports(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.linkedin_demographic_snapshots (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.linkedin_imports(id) on delete cascade,
  report_type text not null check (report_type in ('followers', 'visitors')),
  dimension text not null check (
    dimension in ('location', 'function', 'seniority', 'industry', 'company_size')
  ),
  label text not null,
  metric_value integer not null default 0 check (metric_value >= 0),
  captured_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (import_id, report_type, dimension, label)
);

create index if not exists linkedin_follower_daily_date_idx
  on public.linkedin_follower_daily_metrics (metric_date desc);
create index if not exists linkedin_follower_daily_import_idx
  on public.linkedin_follower_daily_metrics (source_import_id);
create index if not exists linkedin_visitor_daily_date_idx
  on public.linkedin_visitor_daily_metrics (metric_date desc);
create index if not exists linkedin_visitor_daily_import_idx
  on public.linkedin_visitor_daily_metrics (source_import_id);
create index if not exists linkedin_demographic_import_idx
  on public.linkedin_demographic_snapshots (import_id);
create index if not exists linkedin_demographic_lookup_idx
  on public.linkedin_demographic_snapshots (report_type, dimension, metric_value desc);
create index if not exists linkedin_imports_report_type_date_idx
  on public.linkedin_imports (report_type, imported_at desc);

alter table public.linkedin_follower_daily_metrics enable row level security;
alter table public.linkedin_visitor_daily_metrics enable row level security;
alter table public.linkedin_demographic_snapshots enable row level security;

grant select on public.linkedin_follower_daily_metrics to authenticated;
grant select on public.linkedin_visitor_daily_metrics to authenticated;
grant select on public.linkedin_demographic_snapshots to authenticated;
grant all on public.linkedin_follower_daily_metrics to service_role;
grant all on public.linkedin_visitor_daily_metrics to service_role;
grant all on public.linkedin_demographic_snapshots to service_role;
revoke all on public.linkedin_follower_daily_metrics from anon;
revoke all on public.linkedin_visitor_daily_metrics from anon;
revoke all on public.linkedin_demographic_snapshots from anon;

create policy linkedin_follower_daily_select_authenticated
  on public.linkedin_follower_daily_metrics for select to authenticated using (true);
create policy linkedin_visitor_daily_select_authenticated
  on public.linkedin_visitor_daily_metrics for select to authenticated using (true);
create policy linkedin_demographic_select_authenticated
  on public.linkedin_demographic_snapshots for select to authenticated using (true);

create policy linkedin_follower_daily_all_service
  on public.linkedin_follower_daily_metrics for all to service_role using (true) with check (true);
create policy linkedin_visitor_daily_all_service
  on public.linkedin_visitor_daily_metrics for all to service_role using (true) with check (true);
create policy linkedin_demographic_all_service
  on public.linkedin_demographic_snapshots for all to service_role using (true) with check (true);

comment on table public.linkedin_follower_daily_metrics is
  'Aquisição líquida diária de seguidores da página no LinkedIn';
comment on table public.linkedin_visitor_daily_metrics is
  'Visualizações e visitantes únicos diários da página no LinkedIn';
comment on table public.linkedin_demographic_snapshots is
  'Fotografias demográficas de seguidores e visitantes por arquivo importado';
