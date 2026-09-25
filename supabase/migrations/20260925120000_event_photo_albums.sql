-- Fotos de eventos: álbuns abertos a todos os colaboradores autenticados.
-- O marketing (gestores de fotos) cria álbuns e sobe as fotos; todo mundo vê e baixa.

create table if not exists public.event_photo_albums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  title text not null check (length(trim(title)) > 0),
  description text,
  event_date date,
  event_id uuid references public.events(id) on delete set null,
  cover_photo_id uuid,
  is_published boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_photo_albums_event_date_idx
  on public.event_photo_albums (event_date desc nulls last, created_at desc);

create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.event_photo_albums(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  preview_path text,
  preview_url text,
  original_filename text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_photos_album_idx
  on public.event_photos (album_id, created_at);

alter table public.event_photo_albums
  drop constraint if exists event_photo_albums_cover_photo_fk;
alter table public.event_photo_albums
  add constraint event_photo_albums_cover_photo_fk
  foreign key (cover_photo_id) references public.event_photos(id) on delete set null;

comment on table public.event_photo_albums is
  'Álbuns de fotos de eventos internos (ex.: Café com Cultura), visíveis a todos os colaboradores.';
comment on table public.event_photos is
  'Fotos de um álbum de evento. preview_* é a versão reduzida gerada no upload para a grade.';

alter table public.event_photo_albums enable row level security;
alter table public.event_photos enable row level security;

revoke all on public.event_photo_albums from anon;
revoke all on public.event_photos from anon;
grant select, insert, update, delete on public.event_photo_albums to authenticated, service_role;
grant select, insert, update, delete on public.event_photos to authenticated, service_role;

create policy "authenticated read published event albums"
on public.event_photo_albums for select to authenticated
using (is_published or (select public.has_collaborator_photos_manager_access()));

create policy "managers write event albums"
on public.event_photo_albums for all to authenticated
using ((select public.has_collaborator_photos_manager_access()))
with check ((select public.has_collaborator_photos_manager_access()));

create policy "authenticated read event photos"
on public.event_photos for select to authenticated
using (
  exists (
    select 1 from public.event_photo_albums a
    where a.id = album_id
      and (a.is_published or (select public.has_collaborator_photos_manager_access()))
  )
);

create policy "managers write event photos"
on public.event_photos for all to authenticated
using ((select public.has_collaborator_photos_manager_access()))
with check ((select public.has_collaborator_photos_manager_access()));

-- Storage: fotos de eventos ficam em MARKETING-SYSTEM-FOTOS/eventos/<album_id>/...
-- (bucket já é público para leitura). Só gestores de fotos escrevem nessa pasta.
drop policy if exists "Manager insert eventos MARKETING-SYSTEM-FOTOS" on storage.objects;
drop policy if exists "Manager update eventos MARKETING-SYSTEM-FOTOS" on storage.objects;
drop policy if exists "Manager delete eventos MARKETING-SYSTEM-FOTOS" on storage.objects;

create policy "Manager insert eventos MARKETING-SYSTEM-FOTOS"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'MARKETING-SYSTEM-FOTOS'
    and (storage.foldername(name))[1] = 'eventos'
    and (select public.has_collaborator_photos_manager_access())
  );

create policy "Manager update eventos MARKETING-SYSTEM-FOTOS"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'MARKETING-SYSTEM-FOTOS'
    and (storage.foldername(name))[1] = 'eventos'
    and (select public.has_collaborator_photos_manager_access())
  )
  with check (
    bucket_id = 'MARKETING-SYSTEM-FOTOS'
    and (storage.foldername(name))[1] = 'eventos'
    and (select public.has_collaborator_photos_manager_access())
  );

create policy "Manager delete eventos MARKETING-SYSTEM-FOTOS"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'MARKETING-SYSTEM-FOTOS'
    and (storage.foldername(name))[1] = 'eventos'
    and (select public.has_collaborator_photos_manager_access())
  );

-- Primeiro álbum: Café com Cultura de setembro/2026, ligado à edição mensal se existir.
insert into public.event_photo_albums (slug, title, event_date, event_id, is_published)
select
  'cafe-com-cultura-setembro-2026',
  'Café com Cultura — Setembro 2026',
  coalesce(e.event_date, date '2026-09-01'),
  e.id,
  true
from (select 1) seed
left join lateral (
  select ev.id, ev.event_date
  from public.events ev
  where ev.year = 2026
    and ev.name ilike '%caf%cultura%'
    and (ev.month_label ilike '%set%' or extract(month from ev.event_date) = 9)
  order by ev.event_date nulls last
  limit 1
) e on true
on conflict (slug) do nothing;
