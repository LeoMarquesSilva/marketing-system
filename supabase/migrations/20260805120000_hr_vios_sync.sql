-- Sync de colaboradores VIOS → hr_employees (staging + RPC).
-- Match por e-mail normalizado (bpplaw ↔ bismarchipires). Não cria colaboradores.

-- ---------------------------------------------------------------------------
-- Coluna de vínculo estável no cadastro de RH
-- ---------------------------------------------------------------------------

alter table public.hr_employees
  add column if not exists vios_ci text;

create unique index if not exists hr_employees_vios_ci_uidx
  on public.hr_employees (vios_ci)
  where vios_ci is not null;

comment on column public.hr_employees.vios_ci is
  'CI do colaborador no VIOS; preenchido pelo sync quando houver match por e-mail.';

-- ---------------------------------------------------------------------------
-- Staging: espelho do último export VIOS
-- ---------------------------------------------------------------------------

create table if not exists public.hr_vios_employees (
  ci text primary key,
  company text,
  department text,
  cost_center text,
  full_name text not null,
  position text,
  profile text,
  email text,
  phone text,
  mobile text,
  situation text,
  is_active boolean not null default true,
  matched_employee_id uuid references public.hr_employees(id) on delete set null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_vios_employees_email_idx
  on public.hr_vios_employees (lower(trim(email)));
create index if not exists hr_vios_employees_matched_idx
  on public.hr_vios_employees (matched_employee_id);
create index if not exists hr_vios_employees_active_idx
  on public.hr_vios_employees (is_active);

drop trigger if exists hr_vios_employees_set_updated_at on public.hr_vios_employees;
create trigger hr_vios_employees_set_updated_at
before update on public.hr_vios_employees
for each row execute function public.set_ferias_updated_at();

comment on table public.hr_vios_employees is
  'Espelho do último export de colaboradores do VIOS. Match com hr_employees por e-mail.';

-- ---------------------------------------------------------------------------
-- Normalização de e-mail (bpplaw ≡ bismarchipires)
-- ---------------------------------------------------------------------------

create or replace function public.normalize_hr_email(p_email text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when e is null or e = '' then null
    when right(e, length('@bismarchipires.com.br')) = '@bismarchipires.com.br' then
      left(e, length(e) - length('@bismarchipires.com.br')) || '@bpplaw.com.br'
    when right(e, length('@bismarchipires.com')) = '@bismarchipires.com' then
      left(e, length(e) - length('@bismarchipires.com')) || '@bpplaw.com.br'
    else e
  end
  from (select lower(trim(p_email)) as e) s;
$$;

revoke all on function public.normalize_hr_email(text) from public, anon;
grant execute on function public.normalize_hr_email(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Situação VIOS → is_active
-- ---------------------------------------------------------------------------

create or replace function public.vios_situation_is_active(p_situation text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(trim(coalesce(p_situation, ''))) in ('ativo', 'ativa', 'active');
$$;

revoke all on function public.vios_situation_is_active(text) from public, anon;
grant execute on function public.vios_situation_is_active(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Rematch (sem substituir staging) — útil após cadastro manual
-- ---------------------------------------------------------------------------

create or replace function public.sync_hr_employees_from_vios()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matched integer := 0;
  v_unmatched integer := 0;
  v_updated integer := 0;
begin
  -- Limpa vínculos da staging e rematcha
  -- WHERE true: o Supabase bloqueia UPDATE sem cláusula WHERE
  update public.hr_vios_employees
  set matched_employee_id = null
  where true;

  -- 1) Match por CI já gravado em hr_employees
  update public.hr_vios_employees v
  set matched_employee_id = e.id
  from public.hr_employees e
  where e.vios_ci is not null
    and e.vios_ci = v.ci
    and v.matched_employee_id is null;

  -- 2) Match por e-mail normalizado (apenas quando o e-mail aponta para 1 colaborador)
  with candidates as (
    select
      v.ci,
      e.id as employee_id,
      count(*) over (partition by v.ci) as matches_for_vios,
      count(*) over (partition by e.id) as matches_for_employee
    from public.hr_vios_employees v
    join public.hr_employees e
      on public.normalize_hr_email(e.email) is not null
     and public.normalize_hr_email(e.email) = public.normalize_hr_email(v.email)
    where v.matched_employee_id is null
      and v.email is not null
      and trim(v.email) <> ''
  )
  update public.hr_vios_employees v
  set matched_employee_id = c.employee_id
  from candidates c
  where v.ci = c.ci
    and c.matches_for_vios = 1
    and c.matches_for_employee = 1;

  -- Propaga dados VIOS → hr_employees (só quem casou)
  with applied as (
    update public.hr_employees e
    set
      vios_ci = v.ci,
      full_name = coalesce(nullif(trim(v.full_name), ''), e.full_name),
      department = coalesce(nullif(trim(v.department), ''), e.department),
      position = coalesce(nullif(trim(v.position), ''), e.position),
      email = coalesce(nullif(trim(v.email), ''), e.email),
      is_active = v.is_active,
      updated_at = now()
    from public.hr_vios_employees v
    where v.matched_employee_id = e.id
    returning e.id
  )
  select count(*) into v_updated from applied;

  select count(*) into v_matched
  from public.hr_vios_employees
  where matched_employee_id is not null;

  select count(*) into v_unmatched
  from public.hr_vios_employees
  where matched_employee_id is null;

  return jsonb_build_object(
    'matched', v_matched,
    'unmatched', v_unmatched,
    'updated', v_updated,
    'synced_at', now()
  );
end;
$$;

revoke all on function public.sync_hr_employees_from_vios() from public, anon, authenticated;
grant execute on function public.sync_hr_employees_from_vios() to service_role;

-- ---------------------------------------------------------------------------
-- Import completo: substitui staging e rematcha
-- Payload: array JSON com chaves do export VIOS (ci/CI, nome/Nome, etc.)
-- ---------------------------------------------------------------------------

create or replace function public.import_hr_vios_employees(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sync_at timestamptz := now();
  v_imported integer := 0;
  v_result jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows deve ser um array JSON';
  end if;

  -- Substitui o espelho pelo export atual
  -- WHERE true: o Supabase bloqueia DELETE sem cláusula WHERE
  delete from public.hr_vios_employees where true;

  insert into public.hr_vios_employees (
    ci,
    company,
    department,
    cost_center,
    full_name,
    position,
    profile,
    email,
    phone,
    mobile,
    situation,
    is_active,
    synced_at
  )
  select
    nullif(trim(coalesce(r->>'ci', r->>'CI', '')), ''),
    nullif(trim(coalesce(r->>'company', r->>'Empresa', '')), ''),
    nullif(trim(coalesce(r->>'department', r->>'Departamento', '')), ''),
    nullif(trim(coalesce(r->>'cost_center', r->>'Rateio', '')), ''),
    coalesce(
      nullif(trim(coalesce(r->>'full_name', r->>'Nome', '')), ''),
      'Sem nome'
    ),
    nullif(trim(coalesce(r->>'position', r->>'Função', r->>'Funcao', '')), ''),
    nullif(trim(coalesce(r->>'profile', r->>'Perfil', '')), ''),
    nullif(trim(coalesce(r->>'email', r->>'E-mail', r->>'Email', '')), ''),
    nullif(trim(coalesce(r->>'phone', r->>'Telefone', '')), ''),
    nullif(trim(coalesce(r->>'mobile', r->>'Celular', '')), ''),
    nullif(trim(coalesce(r->>'situation', r->>'Situação', r->>'Situacao', '')), ''),
    public.vios_situation_is_active(
      coalesce(r->>'situation', r->>'Situação', r->>'Situacao', '')
    ),
    v_sync_at
  from jsonb_array_elements(p_rows) as r
  where nullif(trim(coalesce(r->>'ci', r->>'CI', '')), '') is not null;

  get diagnostics v_imported = row_count;

  v_result := public.sync_hr_employees_from_vios();
  return v_result || jsonb_build_object('imported', v_imported);
end;
$$;

revoke all on function public.import_hr_vios_employees(jsonb) from public, anon, authenticated;
grant execute on function public.import_hr_vios_employees(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- RLS: gestores de férias leem a staging; escrita só via service_role/RPC
-- ---------------------------------------------------------------------------

alter table public.hr_vios_employees enable row level security;

revoke all on public.hr_vios_employees from anon;
grant select on public.hr_vios_employees to authenticated;
grant select, insert, update, delete on public.hr_vios_employees to service_role;

drop policy if exists "ferias managers read vios employees" on public.hr_vios_employees;
create policy "ferias managers read vios employees"
on public.hr_vios_employees for select to authenticated
using ((select public.has_ferias_access()));
