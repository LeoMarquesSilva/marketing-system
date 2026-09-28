-- Resolve vaga e pendência na mesma transação para não deixar alertas fantasmas.
create or replace function public.resolve_content_schedule_link(
  p_link_id uuid,
  p_slot_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.content_schedule_links%rowtype;
  v_slot public.content_schedule_slots%rowtype;
begin
  select *
    into v_link
    from public.content_schedule_links
   where id = p_link_id
     and status = 'pending'
   for update;

  if not found then
    return 'link_not_found';
  end if;

  select *
    into v_slot
    from public.content_schedule_slots
   where id = p_slot_id
   for update;

  if not found then
    return 'slot_not_found';
  end if;

  if v_slot.cancelled
     or v_slot.format <> v_link.format
     or v_slot.collaborator_id is distinct from v_link.collaborator_id
     or lower(trim(v_slot.area)) <> lower(trim(v_link.area)) then
    return 'mismatch';
  end if;

  if v_link.format = 'reel' then
    if v_slot.reel_studio_id is not null
       and v_slot.reel_studio_id is distinct from v_link.reel_studio_id then
      return 'occupied';
    end if;

    update public.content_schedule_slots
       set reel_studio_id = v_link.reel_studio_id,
           content_roteiro_id = case
             when v_link.content_roteiro_id is not null then v_link.content_roteiro_id
             else content_roteiro_id
           end
     where id = p_slot_id;
  else
    if v_slot.content_roteiro_id is not null
       and v_slot.content_roteiro_id is distinct from v_link.content_roteiro_id then
      return 'occupied';
    end if;

    update public.content_schedule_slots
       set content_roteiro_id = v_link.content_roteiro_id
     where id = p_slot_id;
  end if;

  update public.content_schedule_links
     set status = 'resolved',
         resolved_slot_id = p_slot_id
   where id = p_link_id;

  return 'resolved';
end;
$$;

revoke all on function public.resolve_content_schedule_link(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_content_schedule_link(uuid, uuid)
  to service_role;
