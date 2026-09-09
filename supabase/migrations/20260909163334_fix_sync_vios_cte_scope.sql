-- Bug real encontrado ao testar em produção: CTEs (`inserted`, `new_from_unmatched`)
-- não sobrevivem entre statements separados — cada `WITH ... INSERT/SELECT` é um
-- statement isolado. O INSERT em hr_onboarding_notifications que vinha logo depois
-- referenciando essas CTEs quebrava com "relation does not exist". Corrige juntando
-- cada insert de ficha + sua notificação no mesmo statement (CTE encadeada).

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
  v_notified_new integer := 0;
  v_notified_unmatched integer := 0;
  v_notified_status_changed integer := 0;
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
  ),
  notified_new as (
    insert into public.hr_onboarding_notifications (employee_id, event_type)
    select id, 'new_employee' from inserted
    returning employee_id
  )
  select
    (select count(*) from inserted),
    (select count(*) from notified_new)
  into v_created_employees, v_notified_new;

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

  -- CI sem match nenhum: só cria ficha mínima + notifica quando o VIOS ainda
  -- marca a pessoa como ativa. Unmatched inativo é backlog/ruído (ex-colaborador
  -- cuja ficha nunca existiu neste sistema) e continua fora, sem ação automática.
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
      and v.is_active
    on conflict do nothing
    returning id
  ),
  notified_unmatched as (
    insert into public.hr_onboarding_notifications (employee_id, event_type)
    select id, 'new_employee' from new_from_unmatched
    returning employee_id
  )
  select
    (select count(*) from new_from_unmatched),
    (select count(*) from notified_unmatched)
  into v_created_from_vios_only, v_notified_unmatched;

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
  ),
  notified_status as (
    insert into public.hr_onboarding_notifications (employee_id, event_type, previous_is_active, new_is_active)
    select id, 'status_changed', old_is_active, new_is_active
    from computed
    where old_is_active is distinct from new_is_active
    returning employee_id
  )
  select
    (select count(*) from applied),
    (select count(*) from notified_status)
  into v_updated_employees, v_notified_status_changed;

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
    'notified_new', v_notified_new,
    'notified_unmatched', v_notified_unmatched,
    'notified_status_changed', v_notified_status_changed,
    'synced_at', now()
  );
end;
$function$;

comment on function public.sync_hr_employees_from_vios() is
  'Casa VIOS com hr_employees (criando ficha mínima só quando não há match algum e a pessoa ainda está ativa no VIOS), atualiza apenas ativo/inativo e gera notificação em hr_onboarding_notifications para colaborador novo ou mudança real de status.';

revoke all on function public.sync_hr_employees_from_vios() from public, anon, authenticated;
grant execute on function public.sync_hr_employees_from_vios() to service_role;
