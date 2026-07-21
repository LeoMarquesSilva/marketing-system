-- LinkedIn Insights: importações recorrentes, série diária, posts e snapshots.

create table if not exists public.linkedin_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_hash text not null unique,
  file_size integer not null default 0,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  daily_rows integer not null default 0,
  post_rows integer not null default 0,
  matched_posts integer not null default 0,
  date_from date,
  date_to date,
  warnings jsonb not null default '[]'::jsonb,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now()
);

create table if not exists public.linkedin_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null unique,
  organic_impressions integer not null default 0,
  sponsored_impressions integer not null default 0,
  total_impressions integer not null default 0,
  unique_organic_impressions integer not null default 0,
  organic_clicks integer not null default 0,
  sponsored_clicks integer not null default 0,
  total_clicks integer not null default 0,
  organic_reactions integer not null default 0,
  sponsored_reactions integer not null default 0,
  total_reactions integer not null default 0,
  organic_comments integer not null default 0,
  sponsored_comments integer not null default 0,
  total_comments integer not null default 0,
  organic_shares integer not null default 0,
  sponsored_shares integer not null default 0,
  total_shares integer not null default 0,
  organic_engagement_rate double precision not null default 0,
  sponsored_engagement_rate double precision not null default 0,
  total_engagement_rate double precision not null default 0,
  source_import_id uuid references public.linkedin_imports(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.linkedin_posts (
  id uuid primary key default gen_random_uuid(),
  linkedin_urn text not null unique,
  caption text,
  permalink text not null,
  publication_type text,
  campaign_name text,
  published_by text,
  published_at timestamptz,
  campaign_start_at timestamptz,
  campaign_end_at timestamptz,
  audience text,
  impressions integer not null default 0,
  views integer not null default 0,
  offsite_views integer not null default 0,
  clicks integer not null default 0,
  ctr double precision not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  followers integer not null default 0,
  engagement_rate double precision not null default 0,
  content_type text,
  byline text,
  instagram_post_id uuid references public.instagram_posts(id) on delete set null,
  match_confidence double precision,
  match_strategy text,
  latest_import_id uuid references public.linkedin_imports(id) on delete set null,
  synced_at timestamptz not null default now(),
  inserted_at timestamptz not null default now()
);

create table if not exists public.linkedin_post_snapshots (
  id uuid primary key default gen_random_uuid(),
  linkedin_post_id uuid not null references public.linkedin_posts(id) on delete cascade,
  import_id uuid not null references public.linkedin_imports(id) on delete cascade,
  snapshot_date date not null default current_date,
  impressions integer not null default 0,
  views integer not null default 0,
  clicks integer not null default 0,
  ctr double precision not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  followers integer not null default 0,
  engagement_rate double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (linkedin_post_id, import_id)
);

create index if not exists linkedin_daily_metrics_date_idx
  on public.linkedin_daily_metrics (metric_date desc);
create index if not exists linkedin_posts_published_at_idx
  on public.linkedin_posts (published_at desc);
create index if not exists linkedin_posts_instagram_post_idx
  on public.linkedin_posts (instagram_post_id);
create index if not exists linkedin_post_snapshots_post_date_idx
  on public.linkedin_post_snapshots (linkedin_post_id, snapshot_date desc);
create index if not exists linkedin_imports_imported_at_idx
  on public.linkedin_imports (imported_at desc);

alter table public.linkedin_imports enable row level security;
alter table public.linkedin_daily_metrics enable row level security;
alter table public.linkedin_posts enable row level security;
alter table public.linkedin_post_snapshots enable row level security;

grant select on public.linkedin_imports to authenticated;
grant select on public.linkedin_daily_metrics to authenticated;
grant select on public.linkedin_posts to authenticated;
grant select on public.linkedin_post_snapshots to authenticated;
grant all on public.linkedin_imports to service_role;
grant all on public.linkedin_daily_metrics to service_role;
grant all on public.linkedin_posts to service_role;
grant all on public.linkedin_post_snapshots to service_role;
revoke all on public.linkedin_imports from anon;
revoke all on public.linkedin_daily_metrics from anon;
revoke all on public.linkedin_posts from anon;
revoke all on public.linkedin_post_snapshots from anon;

create policy linkedin_imports_select_authenticated
  on public.linkedin_imports for select to authenticated using (true);
create policy linkedin_daily_metrics_select_authenticated
  on public.linkedin_daily_metrics for select to authenticated using (true);
create policy linkedin_posts_select_authenticated
  on public.linkedin_posts for select to authenticated using (true);
create policy linkedin_post_snapshots_select_authenticated
  on public.linkedin_post_snapshots for select to authenticated using (true);

create policy linkedin_imports_all_service
  on public.linkedin_imports for all to service_role using (true) with check (true);
create policy linkedin_daily_metrics_all_service
  on public.linkedin_daily_metrics for all to service_role using (true) with check (true);
create policy linkedin_posts_all_service
  on public.linkedin_posts for all to service_role using (true) with check (true);
create policy linkedin_post_snapshots_all_service
  on public.linkedin_post_snapshots for all to service_role using (true) with check (true);

comment on table public.linkedin_imports is 'Histórico dos arquivos XLS importados do LinkedIn';
comment on table public.linkedin_daily_metrics is 'Métricas diárias agregadas do LinkedIn';
comment on table public.linkedin_posts is 'Posts do LinkedIn, vinculados aos posts equivalentes do Instagram';
comment on table public.linkedin_post_snapshots is 'Evolução das métricas de cada post a cada importação';

-- Quem já podia acompanhar o Instagram também recebe a nova visão do LinkedIn.
update public.users
set permissions = array_append(permissions, '/linkedin-insights')
where permissions is not null
  and '/instagram-insights' = any(permissions)
  and not ('/linkedin-insights' = any(permissions));
