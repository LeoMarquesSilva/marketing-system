-- Perfis visuais dos projetos de infra (custos).
create table if not exists public.infra_project_profiles (
  project_ref text primary key,
  display_name text,
  logo_url text,
  category text,
  description text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists infra_project_profiles_sort_idx
  on public.infra_project_profiles (sort_order asc, display_name asc);

alter table public.infra_project_profiles enable row level security;

create policy "infra_project_profiles_select_authenticated"
  on public.infra_project_profiles
  for select
  to authenticated
  using (true);

create policy "infra_project_profiles_insert_authenticated"
  on public.infra_project_profiles
  for insert
  to authenticated
  with check (true);

create policy "infra_project_profiles_update_authenticated"
  on public.infra_project_profiles
  for update
  to authenticated
  using (true)
  with check (true);

-- Logos dos projetos (bucket público)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'MARKETING-SYSTEM-PROJETOS',
  'MARKETING-SYSTEM-PROJETOS',
  true,
  2097152,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read MARKETING-SYSTEM-PROJETOS" on storage.objects;
drop policy if exists "Auth insert MARKETING-SYSTEM-PROJETOS" on storage.objects;
drop policy if exists "Auth update MARKETING-SYSTEM-PROJETOS" on storage.objects;
drop policy if exists "Auth delete MARKETING-SYSTEM-PROJETOS" on storage.objects;

create policy "Public read MARKETING-SYSTEM-PROJETOS"
  on storage.objects for select
  using (bucket_id = 'MARKETING-SYSTEM-PROJETOS');

create policy "Auth insert MARKETING-SYSTEM-PROJETOS"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'MARKETING-SYSTEM-PROJETOS');

create policy "Auth update MARKETING-SYSTEM-PROJETOS"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'MARKETING-SYSTEM-PROJETOS');

create policy "Auth delete MARKETING-SYSTEM-PROJETOS"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'MARKETING-SYSTEM-PROJETOS');
