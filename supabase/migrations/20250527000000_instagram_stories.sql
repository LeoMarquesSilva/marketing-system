-- Stories do Instagram persistidos (expiram em 24h na API); guarda metricas historicas
create table if not exists public.instagram_stories (
  id uuid primary key default gen_random_uuid(),
  ig_story_id text not null unique,
  media_type text,
  media_url text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz,
  reach integer not null default 0,
  views integer not null default 0,
  replies integer not null default 0,
  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.instagram_stories is 'Stories do Instagram persistidos (expiram em 24h na API); guarda metricas historicas';

create index if not exists instagram_stories_published_at_idx
  on public.instagram_stories (published_at desc);

alter table public.instagram_stories enable row level security;

create policy instagram_stories_all_service
  on public.instagram_stories for all to service_role using (true) with check (true);

create policy instagram_stories_select_authenticated
  on public.instagram_stories for select to authenticated using (true);
