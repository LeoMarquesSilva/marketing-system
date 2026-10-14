-- O Marketing marca como feito um pedido de ajuste resolvido sem vídeo novo
-- (ex.: correção na legenda ou no crédito). O pedido original continua no
-- histórico; resolvido, ele conta como aprovação daquela pessoa.

alter table public.reel_delivery_decisions
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_id uuid references public.users(id) on delete set null,
  add column if not exists resolved_by_name text,
  add column if not exists resolution_note text;

alter table public.reel_delivery_decisions
  drop constraint if exists reel_delivery_decision_resolution_note_check,
  add constraint reel_delivery_decision_resolution_note_check
    check (resolution_note is null or char_length(resolution_note) <= 2000),
  drop constraint if exists reel_delivery_decision_resolution_only_changes,
  add constraint reel_delivery_decision_resolution_only_changes
    check (resolved_at is null or decision = 'changes_requested');

create or replace function public.refresh_reel_delivery_status(p_delivery_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_delivery public.reel_deliveries%rowtype;
  v_version_id uuid;
  v_participants integer;
  v_approved integer;
  v_changes integer;
  v_status text;
begin
  select * into v_delivery from public.reel_deliveries where id = p_delivery_id for update;
  if not found then return null; end if;

  select id into v_version_id
    from public.reel_delivery_versions
   where delivery_id = p_delivery_id
   order by version_number desc
   limit 1;

  select count(*) into v_participants
    from public.reel_delivery_participants where delivery_id = p_delivery_id;

  -- Ajuste marcado como feito pelo Marketing vale como aprovação.
  select count(*) filter (where d.decision = 'approved' or d.resolved_at is not null),
         count(*) filter (where d.decision = 'changes_requested' and d.resolved_at is null)
    into v_approved, v_changes
    from public.reel_delivery_decisions d
    join public.reel_delivery_participants p
      on p.delivery_id = d.delivery_id and p.user_id = d.user_id
   where d.version_id = v_version_id;

  if v_version_id is null then
    v_status := 'awaiting_approval';
  elsif v_changes > 0 then
    v_status := 'changes_requested';
  elsif v_participants > 0 and v_approved >= v_participants then
    v_status := case when v_delivery.status in ('ready', 'published') then v_delivery.status else 'approved' end;
  else
    v_status := 'awaiting_approval';
  end if;

  update public.reel_deliveries
     set status = v_status,
         approved_at = case
           when v_status in ('approved', 'ready', 'published') then coalesce(v_delivery.approved_at, now())
           else null
         end,
         ready_at = case when v_status in ('ready', 'published') then v_delivery.ready_at else null end,
         published_at = case when v_status = 'published' then v_delivery.published_at else null end
   where id = p_delivery_id;

  return v_status;
end;
$function$;

revoke execute on function public.refresh_reel_delivery_status(uuid) from public, anon, authenticated;
grant execute on function public.refresh_reel_delivery_status(uuid) to service_role;
