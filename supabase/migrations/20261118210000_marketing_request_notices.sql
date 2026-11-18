-- Planner: quando a tarefa entra em "Concluído", quem pediu (solicitante) recebe um aviso
-- com a arte, sem precisar aprovar nada. Gatilho no banco para valer em todo caminho
-- (arrastar no quadro, botão no detalhe, calendário). Quem concluiu o próprio pedido não se avisa.
create table if not exists public.marketing_request_notices (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketing_requests(id) on delete cascade,
  recipient_id uuid not null,
  kind text not null default 'concluido' check (kind in ('concluido')),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (request_id, recipient_id, kind)
);

create index if not exists marketing_request_notices_recipient_idx
  on public.marketing_request_notices (recipient_id, seen_at, created_at desc);

alter table public.marketing_request_notices enable row level security;

create or replace function public.notify_marketing_request_concluded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
begin
  if new.workflow_stage = 'concluido'
     and old.workflow_stage is distinct from 'concluido'
     and new.solicitante_id is not null then
    select id into actor_id from public.users where auth_id = auth.uid() limit 1;
    if actor_id is null or actor_id <> new.solicitante_id then
      insert into public.marketing_request_notices (request_id, recipient_id, kind)
      values (new.id, new.solicitante_id, 'concluido')
      on conflict (request_id, recipient_id, kind) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marketing_request_concluded on public.marketing_requests;
create trigger trg_marketing_request_concluded
  after update of workflow_stage on public.marketing_requests
  for each row execute function public.notify_marketing_request_concluded();

comment on table public.marketing_request_notices is 'Aviso ao solicitante de que a tarefa do Planner foi concluída (mostra a arte; não pede aprovação).';
