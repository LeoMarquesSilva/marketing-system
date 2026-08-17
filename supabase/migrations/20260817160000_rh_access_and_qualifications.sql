-- ---------------------------------------------------------------------------
-- RH: unifica permissão /ferias -> /rh, cria has_hr_access() e tabela
-- hr_qualifications (qualificação jurídica dos colaboradores).
-- ---------------------------------------------------------------------------

-- 1) Backfill: quem tinha /ferias passa a ter /rh (mantém /ferias por compat).
update public.users
set permissions = array_append(permissions, '/rh')
where permissions is not null
  and '/ferias' = any (permissions)
  and not ('/rh' = any (permissions));

-- 2) Função canônica de acesso RH (admin ou /rh ou /ferias legado).
create or replace function public.has_hr_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/rh' = any (coalesce(u.permissions, array[]::text[]))
        or '/ferias' = any (coalesce(u.permissions, array[]::text[]))
      )
  );
$$;

revoke all on function public.has_hr_access() from public, anon;
grant execute on function public.has_hr_access() to authenticated, service_role;

-- 3) Atualiza has_ferias_access para delegar a has_hr_access.
create or replace function public.has_ferias_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_hr_access();
$$;

-- 4) Tabela de qualificações (1 linha por usuário).
create table if not exists public.hr_qualifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  full_name text,
  birth_date date,
  nationality text not null default 'brasileira',
  marital_status text,
  profession text,
  treatment_gender text check (treatment_gender in ('f', 'm')),
  cpf text unique,
  rg text,
  rg_issuer text,
  oab_number text,
  oab_uf text,
  cep text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  personal_phone text,
  personal_email text,
  status text not null default 'pendente' check (status in ('pendente', 'completo')),
  completed_at timestamptz,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_qualifications_status_idx
  on public.hr_qualifications(status);
create index if not exists hr_qualifications_updated_by_idx
  on public.hr_qualifications(updated_by);

drop trigger if exists hr_qualifications_set_updated_at on public.hr_qualifications;
create trigger hr_qualifications_set_updated_at
before update on public.hr_qualifications
for each row execute function public.set_ferias_updated_at();

alter table public.hr_qualifications enable row level security;

revoke all on public.hr_qualifications from anon;
revoke insert, update, delete on public.hr_qualifications from authenticated;
grant select on public.hr_qualifications to authenticated;
grant select, insert, update, delete on public.hr_qualifications to service_role;

-- Colaborador lê a própria linha.
create policy "users read own qualification"
on public.hr_qualifications for select to authenticated
using (
  user_id = (
    select u.id from public.users u
    where u.auth_id = (select auth.uid())
    limit 1
  )
);

-- RH/admin lê todas.
create policy "hr managers read all qualifications"
on public.hr_qualifications for select to authenticated
using ((select public.has_hr_access()));

comment on table public.hr_qualifications is
  'Qualificação jurídica preenchida pelo colaborador; leitura ampla só para RH.';
