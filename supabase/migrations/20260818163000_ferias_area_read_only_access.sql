-- Acesso somente leitura às férias por área, com regra automática por cargo
-- e substituição administrativa por usuário.

alter table public.users
  add column if not exists ferias_access_mode text not null default 'auto',
  add column if not exists ferias_area_scope text[],
  add column if not exists ferias_view_enabled boolean not null default false;

alter table public.users
  drop constraint if exists users_ferias_access_mode_check;

alter table public.users
  add constraint users_ferias_access_mode_check
  check (ferias_access_mode in ('auto', 'disabled', 'custom'));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.resolve_user_ferias_view_enabled(
  target_user_id uuid,
  access_mode text,
  area_scope text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when access_mode = 'disabled' then false
    when access_mode = 'custom' then coalesce(cardinality(area_scope), 0) > 0
    else exists (
      select 1
      from public.hr_employees h
      where h.user_id = target_user_id
        and lower(
          translate(trim(coalesce(h.position, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç',
                    'AAAAEEEIIIOOOOUUUCaaaaeeeiiioooouuuc')
        ) in ('gerente', 'coordenador', 'socio')
    )
  end;
$$;

create or replace function private.set_user_ferias_view_enabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.ferias_view_enabled := private.resolve_user_ferias_view_enabled(
    new.id,
    new.ferias_access_mode,
    new.ferias_area_scope
  );
  return new;
end;
$$;

drop trigger if exists users_set_ferias_view_enabled on public.users;
create trigger users_set_ferias_view_enabled
before insert or update of ferias_access_mode, ferias_area_scope
on public.users
for each row execute function private.set_user_ferias_view_enabled();

create or replace function private.refresh_linked_user_ferias_view_enabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.user_id is not null then
    update public.users u
    set ferias_view_enabled = private.resolve_user_ferias_view_enabled(
      u.id,
      u.ferias_access_mode,
      u.ferias_area_scope
    )
    where u.id = old.user_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.user_id is not null then
    update public.users u
    set ferias_view_enabled = private.resolve_user_ferias_view_enabled(
      u.id,
      u.ferias_access_mode,
      u.ferias_area_scope
    )
    where u.id = new.user_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists hr_employees_refresh_ferias_view_enabled on public.hr_employees;
create trigger hr_employees_refresh_ferias_view_enabled
after insert or delete or update of user_id, position
on public.hr_employees
for each row execute function private.refresh_linked_user_ferias_view_enabled();

-- Os dois sócios atuais têm visão global somente leitura.
update public.users
set ferias_access_mode = 'custom',
    ferias_area_scope = array['*']::text[]
where id in (
  '9394f718-5e3a-4b2a-ae53-84faefcd4c7e',
  'ee154f53-d53e-460a-8b88-f2164564ffd3'
);

-- Materialização usada apenas pela navegação no cliente. A autorização real
-- continua sendo recalculada no servidor a cada requisição.
update public.users u
set ferias_view_enabled = private.resolve_user_ferias_view_enabled(
  u.id,
  u.ferias_access_mode,
  u.ferias_area_scope
);

create index if not exists users_ferias_view_enabled_idx
  on public.users(ferias_view_enabled)
  where ferias_view_enabled = true;

comment on column public.users.ferias_access_mode is
  'auto usa cargo/área de hr_employees; disabled bloqueia; custom substitui o escopo.';
comment on column public.users.ferias_area_scope is
  'Áreas canônicas do modo custom; * representa visão global somente leitura.';
comment on column public.users.ferias_view_enabled is
  'Indicador materializado para navegação; não deve ser usado sozinho para autorização.';
