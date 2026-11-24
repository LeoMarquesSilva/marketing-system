-- Reuniões 1:1 — substitui as 1:1 do Feedz (proposta aprovada em 19/11/2026: docs/feedz/proposta-1-1.md).
-- Líder e liderado; pauta compartilhada; ações combinadas; anotações privadas (o RH lê as dos dois
-- se a chave estiver ligada, como no Feedz); marcação com sala e Teams no Outlook (modelo do SAMA).

-- 1) Configurações (uma linha só).
create table if not exists public.hr_one_on_one_settings (
  id boolean primary key default true check (id),
  -- Quem lê as anotações privadas de todos: 'nenhum', 'admin' ou 'rh' (RH completo e admin).
  private_notes_readers text not null default 'rh' check (private_notes_readers in ('nenhum', 'admin', 'rh')),
  email_agenda_enabled boolean not null default false,
  email_reminder_enabled boolean not null default false,
  overdue_days integer not null default 30 check (overdue_days between 7 and 180),
  member_can_schedule boolean not null default true,
  member_can_reschedule boolean not null default true,
  member_can_rate boolean not null default true,
  -- Salas do escritório (caixas de usuário no Microsoft 365, como no SAMA).
  rooms jsonb not null default '[
    {"key": "SALA_1", "label": "Sala 1", "email": "SALA01@bpplaw.com.br"},
    {"key": "SALA_2", "label": "Sala 2", "email": "SALA02@bpplaw.com.br"},
    {"key": "BIBLIOTECA", "label": "Biblioteca", "email": "BIBLIOTECA@bpplaw.com.br"},
    {"key": "OUTBACK", "label": "Outback", "email": "OUTBACK@bpplaw.com.br"}
  ]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);
insert into public.hr_one_on_one_settings (id) values (true) on conflict do nothing;

-- 2) Categorias (as 7 da empresa no Feedz) com tópicos sugeridos.
create table if not exists public.hr_one_on_one_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  suggested_topics text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  feedz_name text,
  created_at timestamptz not null default now()
);
create unique index if not exists hr_one_on_one_categories_name_key on public.hr_one_on_one_categories (lower(name));

insert into public.hr_one_on_one_categories (name, sort_order, feedz_name) values
  ('Acompanhamento do PDI', 1, 'Acompanhamento Do Plano de Desenvolvimento Individual'),
  ('Devolutiva da Avaliação de Competências', 2, 'Devolutiva Avaliaçao de Competências'),
  ('Alinhamento de prioridades e entregas', 3, 'Alinhamento de prioridades e entregas'),
  ('Acompanhamento das metas individuais e coletivas', 4, 'Acompanhamento das metas individuais e coletivas'),
  ('Desenvolvimento contínuo e alinhamento de expectativas', 5, 'Desenvolvimento contínuo e alinhamento de expectativas'),
  ('Discussão de desempenho e evolução de competências', 6, 'Discussão de desempenho e evolução de competências'),
  ('Reforço de cultura, valores e boas práticas do escritório', 7, 'Reforço de cultura, valores e boas práticas do escritório')
on conflict do nothing;

-- 3) Recorrência (a categoria e os tópicos se repetem em todas as reuniões da série).
create table if not exists public.hr_one_on_one_series (
  id uuid primary key default gen_random_uuid(),
  leader_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  member_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  category_id uuid references public.hr_one_on_one_categories(id) on delete set null,
  frequency text not null check (frequency in ('semanal', 'quinzenal', 'mensal')),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 240),
  room_key text,
  starts_on date not null,
  ends_on date not null,
  topics text[] not null default '{}',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint hr_one_on_one_series_dates check (ends_on >= starts_on),
  constraint hr_one_on_one_series_pair check (leader_employee_id <> member_employee_id)
);

-- 4) Reunião.
create table if not exists public.hr_one_on_one_meetings (
  id uuid primary key default gen_random_uuid(),
  leader_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  member_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  category_id uuid references public.hr_one_on_one_categories(id) on delete set null,
  series_id uuid references public.hr_one_on_one_series(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room_key text,
  status text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  finished_at timestamptz,
  finished_by uuid references public.users(id) on delete set null,
  cancel_reason text,
  -- Evento no Outlook do organizador (criado pelo ORQESTRAI).
  outlook_event_id text,
  outlook_organizer text,
  teams_join_url text,
  -- Nota do liderado para a reunião (1 a 5).
  rating integer check (rating between 1 and 5),
  rating_comment text check (rating_comment is null or char_length(rating_comment) <= 2000),
  rated_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  feedz_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_one_on_one_meetings_time check (ends_at > starts_at),
  constraint hr_one_on_one_meetings_pair check (leader_employee_id <> member_employee_id)
);
create index if not exists hr_one_on_one_meetings_pair_idx on public.hr_one_on_one_meetings (leader_employee_id, member_employee_id, starts_at desc);
create index if not exists hr_one_on_one_meetings_member_idx on public.hr_one_on_one_meetings (member_employee_id, starts_at desc);
create index if not exists hr_one_on_one_meetings_starts_idx on public.hr_one_on_one_meetings (starts_at desc);

-- 5) Pauta compartilhada.
create table if not exists public.hr_one_on_one_topics (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.hr_one_on_one_meetings(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  source text not null default 'livre' check (source in ('livre', 'sugerido', 'pdi', 'pendencia', 'feedz')),
  pdi_action_id uuid references public.hr_pdi_actions(id) on delete set null,
  author_employee_id uuid references public.hr_employees(id) on delete set null,
  discussed boolean not null default false,
  sort_order integer not null default 0,
  feedz_id bigint unique,
  created_at timestamptz not null default now()
);
create index if not exists hr_one_on_one_topics_meeting_idx on public.hr_one_on_one_topics (meeting_id, sort_order);

-- 6) Ações combinadas (da dupla; a reunião de origem é opcional). Abertas seguem para a próxima.
create table if not exists public.hr_one_on_one_actions (
  id uuid primary key default gen_random_uuid(),
  leader_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  member_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  meeting_id uuid references public.hr_one_on_one_meetings(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 1000),
  owner_employee_id uuid references public.hr_employees(id) on delete set null,
  due_date date,
  done_at timestamptz,
  done_by uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  feedz_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_one_on_one_actions_pair_idx on public.hr_one_on_one_actions (leader_employee_id, member_employee_id, done_at);

-- 7) Anotações privadas (uma por autor por reunião).
create table if not exists public.hr_one_on_one_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.hr_one_on_one_meetings(id) on delete cascade,
  author_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 30000),
  feedz_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, author_employee_id)
);

-- Leitura e escrita só pelo servidor (service role), que confere quem está logado.
alter table public.hr_one_on_one_settings enable row level security;
alter table public.hr_one_on_one_categories enable row level security;
alter table public.hr_one_on_one_series enable row level security;
alter table public.hr_one_on_one_meetings enable row level security;
alter table public.hr_one_on_one_topics enable row level security;
alter table public.hr_one_on_one_actions enable row level security;
alter table public.hr_one_on_one_notes enable row level security;
revoke all on public.hr_one_on_one_settings, public.hr_one_on_one_categories, public.hr_one_on_one_series,
  public.hr_one_on_one_meetings, public.hr_one_on_one_topics, public.hr_one_on_one_actions, public.hr_one_on_one_notes
  from anon, authenticated;
grant select, insert, update, delete on public.hr_one_on_one_settings, public.hr_one_on_one_categories, public.hr_one_on_one_series,
  public.hr_one_on_one_meetings, public.hr_one_on_one_topics, public.hr_one_on_one_actions, public.hr_one_on_one_notes
  to service_role;
