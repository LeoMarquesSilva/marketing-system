-- Insights diarios da conta + snapshot de demografia da audiencia.
create table if not exists public.instagram_account_insights (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reach integer not null default 0,
  views integer not null default 0,
  reach_followers integer not null default 0,
  reach_non_followers integer not null default 0,
  accounts_engaged integer not null default 0,
  total_interactions integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  replies integer not null default 0,
  follows integer not null default 0,
  unfollows integer not null default 0,
  profile_links_taps integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.instagram_account_insights is 'Insights diarios da conta IG (endpoint /{ig}/insights)';
create index if not exists instagram_account_insights_date_idx on public.instagram_account_insights (date desc);
alter table public.instagram_account_insights enable row level security;
create policy instagram_account_insights_all_service on public.instagram_account_insights for all to service_role using (true) with check (true);
create policy instagram_account_insights_select_auth on public.instagram_account_insights for select to authenticated using (true);

create table if not exists public.instagram_demographics (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  breakdown text not null,
  label text not null,
  value integer not null default 0,
  snapshot_date date not null default current_date,
  updated_at timestamptz not null default now(),
  unique (kind, breakdown, label)
);
comment on table public.instagram_demographics is 'Snapshot de demografia da audiencia IG (follower/engaged/reached por age/gender/city/country)';
create index if not exists instagram_demographics_kind_breakdown_idx on public.instagram_demographics (kind, breakdown);
alter table public.instagram_demographics enable row level security;
create policy instagram_demographics_all_service on public.instagram_demographics for all to service_role using (true) with check (true);
create policy instagram_demographics_select_auth on public.instagram_demographics for select to authenticated using (true);
