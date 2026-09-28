-- Notifica Leonardo quando um gestor altera o responsável de uma entrega.
create table if not exists public.content_schedule_assignment_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  slot_id uuid not null references public.content_schedule_slots(id) on delete cascade,
  changed_by_id uuid references public.users(id) on delete set null,
  changed_by_name text not null,
  previous_collaborator_id uuid references public.users(id) on delete set null,
  previous_collaborator_name text not null,
  new_collaborator_id uuid references public.users(id) on delete set null,
  new_collaborator_name text not null,
  area text not null,
  due_date date not null,
  format text not null check (format in ('post', 'reel')),
  source_name text,
  source_status text,
  source_notes text,
  vios_task_id uuid references public.vios_tasks(id) on delete set null,
  vios_ci text,
  vios_title text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);

create index if not exists content_schedule_assignment_notifications_pending_idx
  on public.content_schedule_assignment_notifications(recipient_id, created_at)
  where resolved_at is null;

alter table public.content_schedule_assignment_notifications enable row level security;
revoke all on public.content_schedule_assignment_notifications from anon, authenticated;
grant all on public.content_schedule_assignment_notifications to service_role;

drop policy if exists content_schedule_assignment_notifications_service_role
  on public.content_schedule_assignment_notifications;
create policy content_schedule_assignment_notifications_service_role
  on public.content_schedule_assignment_notifications
  for all to service_role using (true) with check (true);

create or replace function public.assign_content_schedule_slot(
  p_slot_id uuid,
  p_expected_updated_at timestamptz,
  p_collaborator_id uuid,
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
  v_changed_by_name text;
  v_previous_name text;
  v_new_name text;
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
  if v_slot.content_roteiro_id is not null or v_slot.reel_studio_id is not null then
    return 'linked';
  end if;
  if v_slot.collaborator_id is not distinct from p_collaborator_id then
    return 'unchanged';
  end if;

  select coalesce(nullif(trim(name), ''), 'Gestor')
    into v_changed_by_name
    from public.users
   where id = p_changed_by_id;

  select coalesce(nullif(trim(name), ''), nullif(trim(v_slot.source_name), ''), 'Sem responsável')
    into v_previous_name
    from public.users
   where id = v_slot.collaborator_id;
  v_previous_name := coalesce(v_previous_name, nullif(trim(v_slot.source_name), ''), 'Sem responsável');

  select coalesce(nullif(trim(name), ''), 'Colaborador')
    into v_new_name
    from public.users
   where id = p_collaborator_id;
  v_new_name := coalesce(v_new_name, 'Sem responsável');

  select vt.id, vt.vios_id::text, vt.tarefa
    into v_vios_task_id, v_vios_ci, v_vios_title
    from public.content_roteiros cr
    left join public.vios_tasks vt on vt.id = cr.vios_task_id
   where cr.id = v_slot.content_roteiro_id;

  update public.content_schedule_slots
     set collaborator_id = p_collaborator_id
   where id = p_slot_id;

  if p_recipient_id is not null and p_changed_by_id is distinct from p_recipient_id then
    insert into public.content_schedule_assignment_notifications (
      recipient_id,
      slot_id,
      changed_by_id,
      changed_by_name,
      previous_collaborator_id,
      previous_collaborator_name,
      new_collaborator_id,
      new_collaborator_name,
      area,
      due_date,
      format,
      source_name,
      source_status,
      source_notes,
      vios_task_id,
      vios_ci,
      vios_title
    )
    values (
      p_recipient_id,
      p_slot_id,
      p_changed_by_id,
      coalesce(v_changed_by_name, 'Gestor'),
      v_slot.collaborator_id,
      v_previous_name,
      p_collaborator_id,
      v_new_name,
      v_slot.area,
      v_slot.due_date,
      v_slot.format,
      v_slot.source_name,
      v_slot.source_status,
      v_slot.source_notes,
      v_vios_task_id,
      v_vios_ci,
      v_vios_title
    );
  end if;

  return 'updated';
end;
$$;

revoke all on function public.assign_content_schedule_slot(uuid, timestamptz, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_content_schedule_slot(uuid, timestamptz, uuid, uuid, uuid)
  to service_role;
