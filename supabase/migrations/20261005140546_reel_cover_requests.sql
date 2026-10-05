-- Capa de Reels pelo Planner: o Marketing pede a capa para a designer a partir
-- da Aprovação de Reels. A designer sobe a imagem direto na tarefa (não um link)
-- e, quando a tarefa é aprovada, a imagem vira a capa do reel automaticamente.

alter table public.marketing_requests
  add column if not exists reel_delivery_id uuid references public.reel_deliveries(id) on delete set null,
  add column if not exists art_image_path text;

create index if not exists marketing_requests_reel_delivery_idx
  on public.marketing_requests(reel_delivery_id) where reel_delivery_id is not null;

alter table public.reel_deliveries
  add column if not exists cover_request_id uuid references public.marketing_requests(id) on delete set null;

comment on column public.marketing_requests.art_image_path is
  'Imagem final enviada pela designer no bucket MARKETING-SYSTEM-REELS (tarefas de Capa de Reels).';

-- Aprovou a tarefa (ou trocou a imagem já aprovada): a imagem vira a capa do reel.
create or replace function public.apply_reel_cover_from_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reel_delivery_id is null or new.art_image_path is null then
    return new;
  end if;
  if new.workflow_stage not in ('revisado', 'pronto_envio', 'concluido') then
    return new;
  end if;
  if old.workflow_stage is not distinct from new.workflow_stage
     and old.art_image_path is not distinct from new.art_image_path then
    return new;
  end if;
  if new.art_image_path not like 'deliveries/' || new.reel_delivery_id::text || '/%' then
    return new;
  end if;

  update public.reel_deliveries
     set cover_path = new.art_image_path
   where id = new.reel_delivery_id
     and cover_path is distinct from new.art_image_path;
  return new;
end;
$$;

revoke execute on function public.apply_reel_cover_from_request() from public, anon, authenticated;

drop trigger if exists marketing_requests_apply_reel_cover on public.marketing_requests;
create trigger marketing_requests_apply_reel_cover
  after update of workflow_stage, art_image_path on public.marketing_requests
  for each row execute function public.apply_reel_cover_from_request();
