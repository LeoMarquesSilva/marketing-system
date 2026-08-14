-- Sessões de fotos (ex.: Fotos Corporativas 2026) para marcar e filtrar uploads.

create table if not exists public.collaborator_photo_sessions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  year integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.collaborator_photo_sessions (slug, label, year, sort_order, is_active)
values ('fotos-corporativas-2026', 'Fotos Corporativas 2026', 2026, 0, true)
on conflict (slug) do nothing;

alter table public.collaborator_photos
  add column if not exists session_id uuid references public.collaborator_photo_sessions(id) on delete set null;

create index if not exists collaborator_photos_session_id_idx
  on public.collaborator_photos (session_id);

-- Backfill: fotos já existentes entram na sessão corporativa 2026.
update public.collaborator_photos p
set session_id = s.id
from public.collaborator_photo_sessions s
where p.session_id is null
  and s.slug = 'fotos-corporativas-2026';

alter table public.collaborator_photo_sessions enable row level security;

revoke all on public.collaborator_photo_sessions from anon;
grant select, insert, update, delete on public.collaborator_photo_sessions to authenticated, service_role;

create policy "authenticated read photo sessions"
on public.collaborator_photo_sessions for select to authenticated
using (true);

create policy "managers write photo sessions"
on public.collaborator_photo_sessions for all to authenticated
using ((select public.has_collaborator_photos_manager_access()))
with check ((select public.has_collaborator_photos_manager_access()));

comment on table public.collaborator_photo_sessions is
  'Sessões/campanhas de fotos (ex.: Fotos Corporativas 2026) usadas para marcar uploads.';
comment on column public.collaborator_photos.session_id is
  'Sessão da qual a foto faz parte.';
