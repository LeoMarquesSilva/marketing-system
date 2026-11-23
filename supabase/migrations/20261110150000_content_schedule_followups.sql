-- Cobranças do cronograma editorial: quem foi cobrado, quando, por qual canal e até quando deve responder.
-- A pauta é identificada pelo CI da tarefa principal do VIOS (mesma chave do indicador de pautas do SIOE).
create table if not exists public.content_schedule_followups (
  id uuid primary key default gen_random_uuid(),
  vios_ci bigint not null,
  slot_id uuid references public.content_schedule_slots(id) on delete set null,
  collaborator_id uuid references public.users(id) on delete set null,
  collaborator_name text not null check (char_length(trim(collaborator_name)) between 1 and 200),
  area text not null check (char_length(trim(area)) between 1 and 120),
  due_date date,
  channel text not null check (channel in ('teams', 'email', 'whatsapp', 'pessoalmente', 'outro')),
  note text check (note is null or char_length(note) <= 2000),
  return_due date,
  sent_at timestamptz not null default now(),
  sent_by_id uuid references public.users(id) on delete set null,
  sent_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists content_schedule_followups_ci_idx
  on public.content_schedule_followups(vios_ci, sent_at);

alter table public.content_schedule_followups enable row level security;

-- O módulo recalcula autorização no servidor. Clientes autenticados não leem nem escrevem direto.
revoke all on public.content_schedule_followups from anon, authenticated;
grant all on public.content_schedule_followups to service_role;

drop policy if exists content_schedule_followups_service_role on public.content_schedule_followups;
create policy content_schedule_followups_service_role on public.content_schedule_followups
  for all to service_role using (true) with check (true);

comment on table public.content_schedule_followups is
  'Registro de cobranças das pautas do cronograma editorial (uma linha por contato feito).';
