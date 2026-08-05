-- Sync VIOS também casa com public.users (e-mail normalizado),
-- atualiza users + hr_employees e cria colaborador de férias quando faltar.

create or replace function public.sync_hr_employees_from_vios()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

  -- 1) Match por CI já gravado em hr_employees
  update public.hr_vios_employees v
  set matched_employee_id = e.id
  from public.hr_employees e
  where e.vios_ci is not null
    and e.vios_ci = v.ci
    and v.matched_employee_id is null;

  -- 2) Match por e-mail em hr_employees
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

  -- 3) Cria hr_employees a partir de users com e-mail equivalente no VIOS
  with user_candidates as (
    select
      u.id as user_id,
      v.ci,
      coalesce(nullif(trim(v.full_name), ''), u.name) as full_name,
      coalesce(nullif(trim(v.email), ''), u.email) as email,
      coalesce(nullif(trim(v.department), ''), nullif(trim(u.department), ''), 'Não informado') as department,
      nullif(trim(v.position), '') as position,
      v.is_active,
      coalesce(u.created_at::date, current_date) as admission_date,
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

  -- 4) Rematch por CI / e-mail após creates
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

  -- 5) Propaga VIOS → hr_employees
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
  select count(*) into v_updated_employees from applied;

  -- 6) Propaga VIOS → users
  with pick as (
    select
      v.ci,
      v.full_name,
      v.department,
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
      is_active = p.is_active,
      name = coalesce(nullif(trim(p.full_name), ''), u.name),
      department = case
        when nullif(trim(p.department), '') is not null then trim(p.department)
        else u.department
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
$$;

revoke all on function public.sync_hr_employees_from_vios() from public, anon, authenticated;
grant execute on function public.sync_hr_employees_from_vios() to service_role;
