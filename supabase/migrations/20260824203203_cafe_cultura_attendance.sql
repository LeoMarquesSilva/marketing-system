-- Café com Cultura: edições mensais, expectativa de participação e check-in.

alter table public.events
  add column if not exists attendance_cutoff_at timestamptz,
  add column if not exists checkin_opens_at timestamptz,
  add column if not exists checkin_closes_at timestamptz;

alter table public.events drop constraint if exists events_checkin_window_valid;
alter table public.events add constraint events_checkin_window_valid
  check (
    checkin_opens_at is null
    or checkin_closes_at is null
    or checkin_closes_at > checkin_opens_at
  );

comment on column public.events.attendance_cutoff_at is
  'Prazo operacional informado pelo administrador para fechar a quantidade do local.';
comment on column public.events.checkin_opens_at is
  'Instante a partir do qual o check-in autenticado é aceito.';
comment on column public.events.checkin_closes_at is
  'Instante a partir do qual o check-in autenticado deixa de ser aceito.';

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  expectation_status text not null default 'confirmed'
    check (expectation_status in ('confirmed', 'excused_absence', 'excluded')),
  expectation_source text not null default 'automatic_roster'
    check (expectation_source in ('automatic_roster', 'responsum', 'admin')),
  checkin_at timestamptz,
  checkin_source text
    check (checkin_source is null or checkin_source in ('nfc', 'qr', 'admin')),
  responsum_ticket_ids uuid[] not null default '{}',
  responsum_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id),
  check ((checkin_at is null and checkin_source is null) or checkin_at is not null)
);

create index if not exists idx_event_participants_event
  on public.event_participants(event_id);
create index if not exists idx_event_participants_user
  on public.event_participants(user_id);
create index if not exists idx_event_participants_expectation
  on public.event_participants(event_id, expectation_status);
create index if not exists idx_event_participants_checkin
  on public.event_participants(event_id, checkin_at)
  where checkin_at is not null;

create table if not exists public.event_attendance_sync_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  trigger_source text not null
    check (trigger_source in ('cron', 'admin')),
  status text not null default 'running'
    check (status in ('running', 'success', 'error')),
  actor_user_id uuid references public.users(id) on delete set null,
  tickets_found integer not null default 0 check (tickets_found >= 0),
  participants_updated integer not null default 0 check (participants_updated >= 0),
  unmatched_tickets integer not null default 0 check (unmatched_tickets >= 0),
  error_message_sanitized text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_attendance_sync_runs_event
  on public.event_attendance_sync_runs(event_id, started_at desc);
create index if not exists idx_event_attendance_sync_runs_actor
  on public.event_attendance_sync_runs(actor_user_id)
  where actor_user_id is not null;

drop trigger if exists trg_event_participants_updated_at on public.event_participants;
create trigger trg_event_participants_updated_at
  before update on public.event_participants
  for each row execute function public.trg_events_updated_at();

alter table public.event_participants enable row level security;
alter table public.event_attendance_sync_runs enable row level security;

revoke all on public.event_participants from anon, authenticated;
revoke all on public.event_attendance_sync_runs from anon, authenticated;
grant select, insert, update, delete on public.event_participants to service_role;
grant select, insert, update, delete on public.event_attendance_sync_runs to service_role;

insert into public.event_series (slug, name, description, active)
values (
  'cafe-com-cultura',
  'Café com Cultura',
  'Encontro mensal institucional realizado na última sexta-feira do mês.',
  true
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    active = true;

insert into public.nfc_templates (
  name,
  description,
  category,
  action_type,
  action_config,
  is_system
)
select
  'Café com Cultura — Check-in mensal',
  'Etiqueta permanente que abre automaticamente a edição mensal ativa.',
  'Café com Cultura',
  'url',
  jsonb_build_object(
    'destinationUrl', 'https://marketing-system-xi.vercel.app/cafe-com-cultura',
    'title', 'Café com Cultura',
    'description', 'Confirme sua presença no encontro deste mês.',
    'loadingMessage', 'Preparando seu check-in…',
    'sensitive', true
  ),
  true
where not exists (
  select 1
  from public.nfc_templates
  where name = 'Café com Cultura — Check-in mensal'
);

comment on table public.event_participants is
  'Expectativa institucional e presença real de colaboradores por evento.';
comment on table public.event_attendance_sync_runs is
  'Auditoria sanitizada das sincronizações de presença com sistemas externos.';
