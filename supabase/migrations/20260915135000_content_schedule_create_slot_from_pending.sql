-- Quando o conteúdo não possui vaga compatível, o Marketing pode criar a data
-- de referência e encerrar a pendência em uma única transação.
create or replace function public.create_content_schedule_slot_from_link(
  p_link_id uuid,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.content_schedule_links%rowtype;
  v_slot_id uuid;
begin
  select *
    into v_link
    from public.content_schedule_links
   where id = p_link_id
     and status = 'pending'
   for update;

  if not found then return null; end if;

  insert into public.content_schedule_slots (
    area,
    due_date,
    format,
    collaborator_id,
    source_key,
    content_roteiro_id,
    reel_studio_id,
    created_by
  )
  values (
    v_link.area,
    v_link.event_date,
    v_link.format,
    v_link.collaborator_id,
    'pending-link:' || v_link.id::text,
    v_link.content_roteiro_id,
    v_link.reel_studio_id,
    p_created_by
  )
  returning id into v_slot_id;

  update public.content_schedule_links
     set status = 'resolved',
         resolved_slot_id = v_slot_id
   where id = v_link.id;

  return v_slot_id;
end;
$$;

revoke all on function public.create_content_schedule_slot_from_link(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_content_schedule_slot_from_link(uuid, uuid)
  to service_role;
