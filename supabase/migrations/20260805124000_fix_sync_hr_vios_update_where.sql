-- Supabase bloqueia UPDATE sem WHERE; ajusta a RPC de rematch VIOS.
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
