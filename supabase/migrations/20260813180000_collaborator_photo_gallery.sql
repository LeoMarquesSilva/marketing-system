-- Galeria de fotos corporativas por colaborador + usos escolhidos.

create table if not exists public.photo_usage_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  is_official boolean not null default false,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists photo_usage_types_one_official_idx
  on public.photo_usage_types (is_official)
  where is_official = true;

insert into public.photo_usage_types (slug, label, is_official, is_system, sort_order, is_active)
values
  ('oficial', 'Oficial', true, true, 0, true),
  ('posts', 'Posts', false, false, 1, true),
  ('site-materiais', 'Site/materiais', false, false, 2, true),
  ('eventos', 'Eventos', false, false, 3, true)
on conflict (slug) do nothing;

create table if not exists public.collaborator_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  original_filename text,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists collaborator_photos_user_id_idx
  on public.collaborator_photos (user_id, created_at desc);

create table if not exists public.collaborator_photo_usages (
  user_id uuid not null references public.users(id) on delete cascade,
  usage_type_id uuid not null references public.photo_usage_types(id) on delete cascade,
  photo_id uuid not null references public.collaborator_photos(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_type_id)
);

create index if not exists collaborator_photo_usages_photo_id_idx
  on public.collaborator_photo_usages (photo_id);

comment on table public.collaborator_photos is
  'Fotos da sessão corporativa disponibilizadas pelo marketing para cada colaborador.';
comment on table public.photo_usage_types is
  'Usos que o colaborador pode marcar (Oficial é sistema; demais o MTK edita).';
comment on table public.collaborator_photo_usages is
  'Escolha do colaborador: um registro por pessoa+uso, apontando para uma foto.';

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.users u
  where u.auth_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.has_collaborator_photos_manager_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_id = (select auth.uid())
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/fotos-colaboradores' = any (coalesce(u.permissions, array[]::text[]))
        or '/usuarios' = any (coalesce(u.permissions, array[]::text[]))
        or u.id in (
          '2f08c695-770e-47ce-b4e4-ce27fa414df8'::uuid,
          '73b4ed1a-6adf-4f61-9f5d-3fcce646d6b7'::uuid
        )
      )
  );
$$;

create or replace function public.protect_official_photo_usage_type()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_official or old.is_system then
      raise exception 'O uso Oficial não pode ser apagado.';
    end if;
    return old;
  end if;

  if old.is_official or old.is_system then
    if new.is_official is distinct from old.is_official
       or new.is_system is distinct from old.is_system
       or new.is_active = false then
      raise exception 'O uso Oficial não pode ser desativado nem alterado.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists photo_usage_types_protect_official on public.photo_usage_types;
create trigger photo_usage_types_protect_official
before update or delete on public.photo_usage_types
for each row execute function public.protect_official_photo_usage_type();

alter table public.photo_usage_types enable row level security;
alter table public.collaborator_photos enable row level security;
alter table public.collaborator_photo_usages enable row level security;

revoke all on public.photo_usage_types from anon;
revoke all on public.collaborator_photos from anon;
revoke all on public.collaborator_photo_usages from anon;

grant select, insert, update, delete on public.photo_usage_types to authenticated, service_role;
grant select, insert, update, delete on public.collaborator_photos to authenticated, service_role;
grant select, insert, update, delete on public.collaborator_photo_usages to authenticated, service_role;

grant execute on function public.current_app_user_id() to authenticated, service_role;
grant execute on function public.has_collaborator_photos_manager_access() to authenticated, service_role;

create policy "authenticated read photo usage types"
on public.photo_usage_types for select to authenticated
using (true);

create policy "managers write photo usage types"
on public.photo_usage_types for all to authenticated
using ((select public.has_collaborator_photos_manager_access()))
with check ((select public.has_collaborator_photos_manager_access()));

create policy "own or manager read collaborator photos"
on public.collaborator_photos for select to authenticated
using (
  user_id = (select public.current_app_user_id())
  or (select public.has_collaborator_photos_manager_access())
);

create policy "managers insert collaborator photos"
on public.collaborator_photos for insert to authenticated
with check ((select public.has_collaborator_photos_manager_access()));

create policy "managers delete collaborator photos"
on public.collaborator_photos for delete to authenticated
using ((select public.has_collaborator_photos_manager_access()));

create policy "own or manager read photo usages"
on public.collaborator_photo_usages for select to authenticated
using (
  user_id = (select public.current_app_user_id())
  or (select public.has_collaborator_photos_manager_access())
);

create policy "own or manager write photo usages"
on public.collaborator_photo_usages for all to authenticated
using (
  user_id = (select public.current_app_user_id())
  or (select public.has_collaborator_photos_manager_access())
)
with check (
  user_id = (select public.current_app_user_id())
  or (select public.has_collaborator_photos_manager_access())
);
