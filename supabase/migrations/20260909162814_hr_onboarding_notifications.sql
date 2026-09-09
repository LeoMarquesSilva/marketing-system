-- Ficha completa de colaborador (campos que faltavam em hr_employees) +
-- notificação de RH quando o sync do VIOS cria um colaborador novo ou
-- muda o status ativo/inativo de um existente.
--
-- hr_qualifications (autoatendimento de advogados p/ quadro societário)
-- não é alterada por esta migration.

-- 1. Campos novos na ficha do colaborador ---------------------------------

alter table public.hr_employees
  add column if not exists employment_type text,
  add column if not exists registration_number text,
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists rg text,
  add column if not exists oab_number text,
  add column if not exists oab_uf text;

create unique index if not exists hr_employees_registration_number_uidx
  on public.hr_employees (registration_number)
  where registration_number is not null;

-- 2. Flag de destinatária fixa das notificações de RH ----------------------

alter table public.users
  add column if not exists is_hr_notification_recipient boolean not null default false;

create or replace function public.is_hr_notification_recipient()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and u.is_hr_notification_recipient
  );
$$;

revoke all on function public.is_hr_notification_recipient() from public, anon;
grant execute on function public.is_hr_notification_recipient() to authenticated, service_role;

-- 3. Tabela de notificações -------------------------------------------------

create table if not exists public.hr_onboarding_notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  event_type text not null check (event_type in ('new_employee', 'status_changed')),
  previous_is_active boolean,
  new_is_active boolean,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);

create index if not exists hr_onboarding_notifications_employee_idx
  on public.hr_onboarding_notifications(employee_id);

create index if not exists hr_onboarding_notifications_pending_idx
  on public.hr_onboarding_notifications(created_at)
  where resolved_at is null;

alter table public.hr_onboarding_notifications enable row level security;

revoke all on public.hr_onboarding_notifications from anon;
grant select on public.hr_onboarding_notifications to authenticated;
grant select, insert, update, delete on public.hr_onboarding_notifications to service_role;

create policy "hr recipients read onboarding notifications"
on public.hr_onboarding_notifications for select to authenticated
using (
  (select public.has_hr_access())
  or (select public.is_hr_notification_recipient())
);

-- 4. sync_hr_employees_from_vios(): gera notificações ----------------------
-- Só o sync do VIOS gera notificação (nunca edição manual da RH), e só
-- quando algo realmente muda (evita spam em reprocessamentos idempotentes).

create or replace function public.sync_hr_employees_from_vios()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_matched integer := 0;
  v_unmatched integer := 0;
  v_updated_employees integer := 0;
  v_created_employees integer := 0;
  v_created_from_vios_only integer := 0;
  v_updated_users integer := 0;
begin
  update public.hr_vios_employees
  set matched_employee_id = null
  where true;

  update public.hr_vios_employees v
  set matched_employee_id = e.id
  from public.hr_employees e
  where e.vios_ci is not null
    and e.vios_ci = v.ci
    and v.matched_employee_id is null;

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

  with user_candidates as (
    select
      u.id as user_id,
      v.ci,
      coalesce(nullif(trim(v.full_name), ''), u.name) as full_name,
      coalesce(nullif(trim(v.email), ''), u.email) as email,
      coalesce(nullif(trim(v.department), ''), nullif(trim(u.department), ''), 'Não informado') as department,
      nullif(trim(v.position), '') as position,
      v.is_active,
      coalesce(p.joined_on, u.created_at::date, current_date) as admission_date,
      row_number() over (
        partition by u.id
        order by v.is_active desc, v.ci
      ) as rn_user,
      row_number() over (
        partition by v.ci
        order by u.is_active desc nulls last, u.created_at nulls last, u.id
      ) as rn_ci
    from public.hr_vios_employees v
    join public.users u
      on public.normalize_hr_email(u.email) is not null
     and public.normalize_hr_email(u.email) = public.normalize_hr_email(v.email)
    left join public.professional_profiles p
      on p.user_id = u.id
     and p.joined_on is not null
    where v.matched_employee_id is null
      and v.email is not null
      and trim(v.email) <> ''
      and not exists (
        select 1 from public.hr_employees e where e.user_id = u.id
      )
      and not exists (
        select 1 from public.hr_employees e where e.vios_ci = v.ci
      )
      and not exists (
        select 1
        from public.hr_employees e
        where public.normalize_hr_email(e.email) = public.normalize_hr_email(v.email)
      )
      and not exists (
        select 1
        from public.hr_employees e
        where e.vacation_exempt
          and public.normalize_hr_email(e.email) = public.normalize_hr_email(v.email)
      )
  ),
  inserted as (
    insert into public.hr_employees (
      user_id,
      full_name,
      email,
      department,
      position,
      admission_date,
      is_active,
      vios_ci
    )
    select
      user_id,
      full_name,
      email,
      department,
      position,
      admission_date,
      is_active,
      ci
    from user_candidates
    where rn_user = 1
      and rn_ci = 1
    on conflict do nothing
    returning id
  )
  select count(*) into v_created_employees from inserted;

  insert into public.hr_onboarding_notifications (employee_id, event_type)
  select id, 'new_employee' from inserted;

  update public.hr_vios_employees v
  set matched_employee_id = e.id
  from public.hr_employees e
  where e.vios_ci is not null
    and e.vios_ci = v.ci
    and v.matched_employee_id is null;

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

  -- CI sem match nenhum (nem hr_employees, nem users): antes ficava só no
  -- banner "cadastre manualmente" (nunca ligado na UI). Agora vira uma ficha
  -- mínima em hr_employees (sem user_id) para a RH completar via notificação.
  with new_from_unmatched as (
    insert into public.hr_employees (
      full_name,
      email,
      department,
      position,
      admission_date,
      is_active,
      vios_ci
    )
    select
      v.full_name,
      nullif(trim(v.email), ''),
      coalesce(nullif(trim(v.department), ''), 'Não informado'),
      nullif(trim(v.position), ''),
      current_date,
      v.is_active,
      v.ci
    from public.hr_vios_employees v
    where v.matched_employee_id is null
    on conflict do nothing
    returning id
  )
  select count(*) into v_created_from_vios_only from new_from_unmatched;

  insert into public.hr_onboarding_notifications (employee_id, event_type)
  select id, 'new_employee' from new_from_unmatched;

  update public.hr_vios_employees v
  set matched_employee_id = e.id
  from public.hr_employees e
  where e.vios_ci is not null
    and e.vios_ci = v.ci
    and v.matched_employee_id is null;

  -- Atualização de fichas existentes: só vínculo VIOS + ativo/inativo.
  -- Cargo, área, nome e e-mail não são sobrescritos pelo export.
  with before_update as (
    select
      e.id,
      e.is_active as old_is_active,
      e.vacation_exempt,
      v.ci,
      v.is_active as vios_is_active
    from public.hr_employees e
    join public.hr_vios_employees v on v.matched_employee_id = e.id
  ),
  computed as (
    select
      id,
      ci,
      old_is_active,
      case
        when vacation_exempt then old_is_active
        when not vios_is_active then false
        when not old_is_active then false
        else true
      end as new_is_active
    from before_update
  ),
  applied as (
    update public.hr_employees e
    set
      vios_ci = c.ci,
      user_id = coalesce(
        e.user_id,
        (
          select u.id
          from public.users u
          join public.hr_vios_employees v on v.ci = c.ci
          where public.normalize_hr_email(u.email) = public.normalize_hr_email(v.email)
          order by u.is_active desc nulls last, u.created_at nulls last, u.id
          limit 1
        )
      ),
      is_active = c.new_is_active,
      updated_at = now()
    from computed c
    where c.id = e.id
    returning e.id
  )
  select count(*) into v_updated_employees from applied;

  insert into public.hr_onboarding_notifications (employee_id, event_type, previous_is_active, new_is_active)
  select id, 'status_changed', old_is_active, new_is_active
  from computed
  where old_is_active is distinct from new_is_active;

  with pick as (
    select
      v.ci,
      v.is_active,
      public.normalize_hr_email(v.email) as nemail,
      row_number() over (
        partition by public.normalize_hr_email(v.email)
        order by v.is_active desc, v.ci
      ) as rn
    from public.hr_vios_employees v
    where v.email is not null
      and trim(v.email) <> ''
      and public.normalize_hr_email(v.email) is not null
  ),
  applied_users as (
    update public.users u
    set
      is_active = case
        when not p.is_active then false
        when not coalesce(u.is_active, true) then false
        else true
      end,
      updated_at = now()
    from pick p
    where p.rn = 1
      and public.normalize_hr_email(u.email) = p.nemail
    returning u.id
  )
  select count(*) into v_updated_users from applied_users;

  select count(*) into v_matched
  from public.hr_vios_employees
  where matched_employee_id is not null;

  select count(*) into v_unmatched
  from public.hr_vios_employees
  where matched_employee_id is null;

  return jsonb_build_object(
    'matched', v_matched,
    'unmatched', v_unmatched,
    'updated', v_updated_employees,
    'created_employees', v_created_employees,
    'created_from_vios_only', v_created_from_vios_only,
    'updated_users', v_updated_users,
    'synced_at', now()
  );
end;
$function$;

comment on function public.sync_hr_employees_from_vios() is
  'Casa VIOS com hr_employees (criando ficha mínima quando não há match algum), atualiza apenas ativo/inativo e gera notificação em hr_onboarding_notifications para colaborador novo ou mudança real de status.';

revoke all on function public.sync_hr_employees_from_vios() from public, anon, authenticated;
grant execute on function public.sync_hr_employees_from_vios() to service_role;
