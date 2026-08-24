-- VIOS passa a atualizar apenas ativo/inativo em hr_employees e users.
-- Cargo e área ficam sob controle da planilha/RH (não são sobrescritos).
-- Desativação manual não é revertida enquanto o VIOS ainda marcar "Ativo".

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

  -- Atualização de fichas existentes: só vínculo VIOS + ativo/inativo.
  -- Cargo, área, nome e e-mail não são sobrescritos pelo export.
  with applied as (
    update public.hr_employees e
    set
      vios_ci = v.ci,
      user_id = coalesce(
        e.user_id,
        (
          select u.id
          from public.users u
          where public.normalize_hr_email(u.email) = public.normalize_hr_email(v.email)
          order by u.is_active desc nulls last, u.created_at nulls last, u.id
          limit 1
        )
      ),
      is_active = case
        when e.vacation_exempt then e.is_active
        when not v.is_active then false
        when not e.is_active then false
        else true
      end,
      updated_at = now()
    from public.hr_vios_employees v
    where v.matched_employee_id = e.id
    returning e.id
  )
  select count(*) into v_updated_employees from applied;

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
    'updated_users', v_updated_users,
    'synced_at', now()
  );
end;
$function$;

comment on function public.sync_hr_employees_from_vios() is
  'Casa VIOS com hr_employees e atualiza apenas ativo/inativo; cargo/área vêm da planilha RH.';
