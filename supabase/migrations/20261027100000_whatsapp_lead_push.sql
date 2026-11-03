-- Notificação push (com som) quando chega mensagem de lead no WhatsApp. Quem
-- envia é a Edge Function evolution-webhook; só recebe quem tem a flag ligada,
-- no mesmo molde de is_hr_notification_recipient.

alter table public.users
  add column if not exists is_whatsapp_lead_notification_recipient boolean not null default false;

-- Por enquanto só o Leonardo Marques.
update public.users
set is_whatsapp_lead_notification_recipient = true
where email = 'leonardo.marques@bismarchipires.com.br';

-- Uma linha por navegador inscrito (endpoint do serviço de push do navegador).
create table if not exists public.whatsapp_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz,
  last_error text
);

create index if not exists whatsapp_push_subscriptions_user_idx
  on public.whatsapp_push_subscriptions(user_id);

alter table public.whatsapp_push_subscriptions enable row level security;

revoke all on public.whatsapp_push_subscriptions from anon;
grant select, insert, update, delete on public.whatsapp_push_subscriptions to authenticated;
grant select, insert, update, delete on public.whatsapp_push_subscriptions to service_role;

-- Cada pessoa vê e apaga só as suas inscrições; inscrever exige a flag.
drop policy if exists "own whatsapp push subscriptions" on public.whatsapp_push_subscriptions;
create policy "own whatsapp push subscriptions"
on public.whatsapp_push_subscriptions for all to authenticated
using (
  user_id in (select u.id from public.users u where u.auth_id = (select auth.uid()))
)
with check (
  user_id in (
    select u.id from public.users u
    where u.auth_id = (select auth.uid())
      and u.is_whatsapp_lead_notification_recipient
  )
);
