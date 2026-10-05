-- Segundo responsável da vaga: reels gravados em dupla. O principal continua
-- guiando VIOS e vínculos; o segundo só existe quando há um principal.
alter table public.content_schedule_slots
  add column if not exists co_collaborator_id uuid references public.users(id) on delete set null;

alter table public.content_schedule_slots
  drop constraint if exists content_schedule_slot_co_collaborator_check;
alter table public.content_schedule_slots
  add constraint content_schedule_slot_co_collaborator_check check (
    co_collaborator_id is null
    or (collaborator_id is not null and co_collaborator_id <> collaborator_id)
  );

create index if not exists content_schedule_slots_co_collaborator_idx
  on public.content_schedule_slots(co_collaborator_id, due_date)
  where co_collaborator_id is not null;

comment on column public.content_schedule_slots.co_collaborator_id is
  'Segundo responsável (ex.: reel gravado por duas pessoas). Exige responsável principal.';

-- Mesmo contrato de assign_content_schedule_slot, para o par de responsáveis.
-- O principal fica travado depois do vínculo do conteúdo; o segundo pode mudar.
create or replace function public.assign_content_schedule_slot_people(
  p_slot_id uuid,
  p_expected_updated_at timestamptz,
  p_collaborator_id uuid,
  p_co_collaborator_id uuid,
  p_changed_by_id uuid,
  p_recipient_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot public.content_schedule_slots%rowtype;
  v_collaborator_id uuid := coalesce(p_collaborator_id, p_co_collaborator_id);
  v_co_collaborator_id uuid := case
    when p_collaborator_id is null or p_co_collaborator_id = p_collaborator_id then null
    else p_co_collaborator_id
  end;
  v_changed_by_name text;
  v_previous_name text;
  v_previous_co_name text;
  v_new_name text;
  v_new_co_name text;
  v_vios_task_id uuid;
  v_vios_ci text;
  v_vios_title text;
begin
  select *
    into v_slot
    from public.content_schedule_slots
   where id = p_slot_id
   for update;

  if not found then return 'not_found'; end if;
  if v_slot.updated_at is distinct from p_expected_updated_at then return 'stale'; end if;
  if v_slot.cancelled then return 'cancelled'; end if;
  if v_slot.collaborator_id is not distinct from v_collaborator_id
     and v_slot.co_collaborator_id is not distinct from v_co_collaborator_id then
    return 'unchanged';
  end if;
  if (v_slot.content_roteiro_id is not null or v_slot.reel_studio_id is not null)
     and v_slot.collaborator_id is distinct from v_collaborator_id then
    return 'linked';
  end if;

  select coalesce(nullif(trim(name), ''), 'Gestor')
    into v_changed_by_name
    from public.users
   where id = p_changed_by_id;

  select nullif(trim(name), '') into v_previous_name from public.users where id = v_slot.collaborator_id;
  select nullif(trim(name), '') into v_previous_co_name from public.users where id = v_slot.co_collaborator_id;
  v_previous_name := coalesce(v_previous_name, nullif(trim(v_slot.source_name), ''), 'Sem responsável');
  if v_slot.co_collaborator_id is not null then
    v_previous_name := v_previous_name || ' e ' || coalesce(v_previous_co_name, 'Colaborador');
  end if;

  select coalesce(nullif(trim(name), ''), 'Colaborador') into v_new_name from public.users where id = v_collaborator_id;
  select coalesce(nullif(trim(name), ''), 'Colaborador') into v_new_co_name from public.users where id = v_co_collaborator_id;
  v_new_name := coalesce(v_new_name, 'Sem responsável');
  if v_co_collaborator_id is not null then
    v_new_name := v_new_name || ' e ' || coalesce(v_new_co_name, 'Colaborador');
  end if;

  select vt.id, vt.vios_id::text, vt.tarefa
    into v_vios_task_id, v_vios_ci, v_vios_title
    from public.vios_tasks vt
   where vt.id = coalesce(
     v_slot.vios_task_id,
     (select cr.vios_task_id
        from public.content_roteiros cr
       where cr.id = v_slot.content_roteiro_id)
   );

  update public.content_schedule_slots
     set collaborator_id = v_collaborator_id,
         co_collaborator_id = v_co_collaborator_id
   where id = p_slot_id;

  if p_recipient_id is not null and p_changed_by_id is distinct from p_recipient_id then
    insert into public.content_schedule_assignment_notifications (
      recipient_id, slot_id, changed_by_id, changed_by_name,
      previous_collaborator_id, previous_collaborator_name,
      new_collaborator_id, new_collaborator_name,
      area, due_date, format, source_name, source_status, source_notes,
      vios_task_id, vios_ci, vios_title
    )
    values (
      p_recipient_id, p_slot_id, p_changed_by_id,
      coalesce(v_changed_by_name, 'Gestor'),
      v_slot.collaborator_id, v_previous_name,
      v_collaborator_id, v_new_name,
      v_slot.area, v_slot.due_date, v_slot.format,
      v_slot.source_name, v_slot.source_status, v_slot.source_notes,
      v_vios_task_id, v_vios_ci, v_vios_title
    );
  end if;

  return 'updated';
end;
$$;

revoke all on function public.assign_content_schedule_slot_people(uuid, timestamptz, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_content_schedule_slot_people(uuid, timestamptz, uuid, uuid, uuid, uuid)
  to service_role;
