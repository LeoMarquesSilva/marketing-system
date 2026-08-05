-- Módulo de Férias (RH): colaboradores, períodos aquisitivos/concessivos,
-- gozos de férias e o calendário de recesso coletivo.
--
-- Migration aditiva. Os colaboradores ficam em tabela própria (`hr_employees`)
-- porque a ficha de RH inclui ex-funcionários e pessoas sem login no sistema;
-- o vínculo com `public.users` é opcional.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  cpf text unique,
  email text,
  department text,
  position text,
  admission_date date not null,
  termination_date date,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vacation_periods (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  entitled_days integer not null default 30 check (entitled_days >= 0),
  concessive_start date not null,
  concessive_end date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, period_start),
  check (period_end > period_start),
  check (concessive_end > concessive_start)
);

create table if not exists public.vacation_leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  -- Informado pelo RH: na ficha original o total nem sempre é o intervalo corrido
  -- (retornos antecipados, day offs compensados etc.).
  days integer not null check (days > 0),
  kind text not null default 'ferias' check (kind in ('ferias', 'recesso', 'abono')),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.company_recess (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  start_date date not null,
  end_date date not null,
  days integer not null check (days > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists hr_employees_user_idx on public.hr_employees(user_id);
create index if not exists hr_employees_created_by_idx on public.hr_employees(created_by);
create index if not exists hr_employees_active_name_idx on public.hr_employees(is_active, full_name);

create index if not exists vacation_periods_employee_idx
  on public.vacation_periods(employee_id, period_start);
create index if not exists vacation_periods_concessive_end_idx
  on public.vacation_periods(concessive_end);

create index if not exists vacation_leaves_employee_idx
  on public.vacation_leaves(employee_id, start_date);
create index if not exists vacation_leaves_created_by_idx
  on public.vacation_leaves(created_by);

-- ---------------------------------------------------------------------------
-- Trigger de updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_ferias_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hr_employees_set_updated_at on public.hr_employees;
create trigger hr_employees_set_updated_at
before update on public.hr_employees
for each row execute function public.set_ferias_updated_at();

drop trigger if exists vacation_periods_set_updated_at on public.vacation_periods;
create trigger vacation_periods_set_updated_at
before update on public.vacation_periods
for each row execute function public.set_ferias_updated_at();

drop trigger if exists vacation_leaves_set_updated_at on public.vacation_leaves;
create trigger vacation_leaves_set_updated_at
before update on public.vacation_leaves
for each row execute function public.set_ferias_updated_at();

drop trigger if exists company_recess_set_updated_at on public.company_recess;
create trigger company_recess_set_updated_at
before update on public.company_recess
for each row execute function public.set_ferias_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: dados sensíveis de RH. Admin ou permissão explícita "/ferias".
-- ---------------------------------------------------------------------------

alter table public.hr_employees enable row level security;
alter table public.vacation_periods enable row level security;
alter table public.vacation_leaves enable row level security;
alter table public.company_recess enable row level security;

revoke all on public.hr_employees from anon;
revoke all on public.vacation_periods from anon;
revoke all on public.vacation_leaves from anon;
revoke all on public.company_recess from anon;

grant select, insert, update, delete on public.hr_employees to authenticated, service_role;
grant select, insert, update, delete on public.vacation_periods to authenticated, service_role;
grant select, insert, update, delete on public.vacation_leaves to authenticated, service_role;
grant select, insert, update, delete on public.company_recess to authenticated, service_role;

create or replace function public.has_ferias_access()
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
        or '/ferias' = any (coalesce(u.permissions, array[]::text[]))
      )
  );
$$;

revoke all on function public.has_ferias_access() from public, anon;
grant execute on function public.has_ferias_access() to authenticated, service_role;

create policy "ferias managers manage employees"
on public.hr_employees for all to authenticated
using ((select public.has_ferias_access()))
with check ((select public.has_ferias_access()));

create policy "ferias managers manage periods"
on public.vacation_periods for all to authenticated
using ((select public.has_ferias_access()))
with check ((select public.has_ferias_access()));

create policy "ferias managers manage leaves"
on public.vacation_leaves for all to authenticated
using ((select public.has_ferias_access()))
with check ((select public.has_ferias_access()));

create policy "ferias managers manage recess"
on public.company_recess for all to authenticated
using ((select public.has_ferias_access()))
with check ((select public.has_ferias_access()));

comment on table public.hr_employees is
  'Colaboradores para controle de férias do RH; inclui ex-funcionários sem login.';
comment on column public.vacation_leaves.days is
  'Dias efetivamente gozados, informados pelo RH (pode divergir do intervalo corrido).';
