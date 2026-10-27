-- Ficha cadastral: campos marcados ao devolver e linha do tempo.
--
-- `reopen_fields`: campos que a RH marcou ao devolver a ficha; a pessoa abre a
-- ficha direto no primeiro deles. Zera quando ela reenvia.
--
-- `hr_registration_form_events`: o vaivém de cada ficha (enviada, devolvida
-- com recado e campos, reenviada com o que mudou, corrigida pela RH,
-- aprovada, cancelada). `changes` guarda [{field, before, after}] dos campos
-- alterados. Dados pessoais: só service_role.

alter table public.hr_registration_forms
  add column if not exists reopen_fields text[] not null default '{}';

create table if not exists public.hr_registration_form_events (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.hr_registration_forms(id) on delete cascade,
  event_type text not null
    check (event_type in ('enviada', 'reenviada', 'devolvida', 'corrigida', 'aprovada', 'cancelada')),
  actor text not null check (actor in ('pessoa', 'rh')),
  actor_user_id uuid references public.users(id) on delete set null,
  note text,
  fields text[] not null default '{}',
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hr_registration_form_events_form_idx
  on public.hr_registration_form_events (form_id, created_at);
create index if not exists hr_registration_form_events_actor_idx
  on public.hr_registration_form_events (actor_user_id);

alter table public.hr_registration_form_events enable row level security;
revoke all on public.hr_registration_form_events from anon, authenticated;
grant select, insert, update, delete on public.hr_registration_form_events to service_role;

comment on table public.hr_registration_form_events is
  'Linha do tempo da ficha cadastral (envios, devoluções, correções); só service_role.';

-- O que já aconteceu antes da linha do tempo existir (aproximado pelas datas da ficha).
insert into public.hr_registration_form_events (form_id, event_type, actor, created_at)
select f.id, 'enviada', 'pessoa', f.submitted_at
from public.hr_registration_forms f
where f.submitted_at is not null
  and not exists (select 1 from public.hr_registration_form_events e where e.form_id = f.id);

insert into public.hr_registration_form_events (form_id, event_type, actor, actor_user_id, created_at)
select f.id, 'aprovada', 'rh', f.approved_by, f.approved_at
from public.hr_registration_forms f
where f.approved_at is not null
  and not exists (
    select 1 from public.hr_registration_form_events e where e.form_id = f.id and e.event_type = 'aprovada'
  );

insert into public.hr_registration_form_events (form_id, event_type, actor, note, created_at)
select f.id, 'devolvida', 'rh', f.reopen_note, greatest(f.updated_at, coalesce(f.submitted_at, f.updated_at))
from public.hr_registration_forms f
where f.status = 'pendente' and f.reopen_note is not null and f.submitted_at is not null
  and not exists (
    select 1 from public.hr_registration_form_events e where e.form_id = f.id and e.event_type = 'devolvida'
  );
