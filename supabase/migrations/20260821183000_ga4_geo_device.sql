-- GA4 Insights: de onde vem o público (localização) e em qual dispositivo.

create table if not exists public.ga4_top_locations (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  region text,
  country text not null,
  sessions integer not null default 0,
  active_users integer not null default 0,
  period_days integer not null default 28,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (city, country)
);

create table if not exists public.ga4_device_snapshot (
  id uuid primary key default gen_random_uuid(),
  device_category text not null unique,
  sessions integer not null default 0,
  period_days integer not null default 28,
  source_import_id uuid references public.ga4_imports(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists ga4_top_locations_sessions_idx
  on public.ga4_top_locations (sessions desc);

alter table public.ga4_top_locations enable row level security;
alter table public.ga4_device_snapshot enable row level security;

grant select on public.ga4_top_locations to authenticated;
grant select on public.ga4_device_snapshot to authenticated;
grant all on public.ga4_top_locations to service_role;
grant all on public.ga4_device_snapshot to service_role;
revoke all on public.ga4_top_locations from anon;
revoke all on public.ga4_device_snapshot from anon;

create policy ga4_top_locations_select_authenticated
  on public.ga4_top_locations for select to authenticated using (true);
create policy ga4_device_snapshot_select_authenticated
  on public.ga4_device_snapshot for select to authenticated using (true);

create policy ga4_top_locations_all_service
  on public.ga4_top_locations for all to service_role using (true) with check (true);
create policy ga4_device_snapshot_all_service
  on public.ga4_device_snapshot for all to service_role using (true) with check (true);

comment on table public.ga4_top_locations is 'Cidades de origem do público do site na janela móvel mais recente (GA4)';
comment on table public.ga4_device_snapshot is 'Sessões por categoria de dispositivo na janela móvel mais recente (GA4)';
