-- Feedback contínuo (substitui o Feedback do Feedz) e o sino geral de avisos.
-- Proposta e decisões de 23/11/2026 em docs/feedz/proposta-feedback.md.
-- Tudo passa pela API do ORQESTRAI (service role); RLS ligada e sem acesso direto do navegador.

-- ---------------------------------------------------------------------------
-- Sino geral: um aviso por pessoa (feedback, pedido, resposta, lembrete...).
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (char_length(kind) between 2 and 60),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text check (body is null or char_length(body) <= 500),
  link text check (link is null or char_length(link) <= 500),
  actor_employee_id uuid references public.hr_employees(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Configurações do feedback (uma linha só).
-- ---------------------------------------------------------------------------
create table if not exists public.hr_feedback_settings (
  id boolean primary key default true check (id),
  coverage_days integer not null default 30 check (coverage_days between 7 and 180),
  hr_reads_content boolean not null default true,
  mural_enabled boolean not null default true,
  ai_enabled boolean not null default true,
  email_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);
insert into public.hr_feedback_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Modelos de texto (o RH cadastra; "Bismarchi Pires" vem do Feedz).
-- ---------------------------------------------------------------------------
create table if not exists public.hr_feedback_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  body text not null default '' check (char_length(body) <= 4000),
  kind text check (kind is null or kind in ('reconhecimento', 'desenvolvimento')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  feedz_template_id bigint unique,
  created_at timestamptz not null default now()
);
create unique index if not exists hr_feedback_templates_name_idx on public.hr_feedback_templates (lower(name));

insert into public.hr_feedback_templates (name, body, kind, sort_order) values
  ('SCI (Situação, Comportamento, Impacto)', E'Situação: \nComportamento: \nImpacto: ', null, 2),
  ('Parar, continuar, começar', E'Parar: \nContinuar: \nComeçar: ', 'desenvolvimento', 3),
  ('Comunicação Não Violenta', E'O que observei: \nO que senti: \nO que preciso: \nO que peço: ', 'desenvolvimento', 4),
  ('Ótimas ideias', E'A ideia: \nPor que fez diferença: ', 'reconhecimento', 5),
  ('Boa reunião', E'O que funcionou na reunião: \nO impacto para o time: ', 'reconhecimento', 6)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Pedidos de feedback.
-- ---------------------------------------------------------------------------
create table if not exists public.hr_feedback_requests (
  id uuid primary key default gen_random_uuid(),
  -- quem pede
  requester_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  -- quem deve responder
  giver_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  -- sobre quem é o feedback (o próprio pedinte ou, no pedido do gestor, um liderado)
  subject_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  due_date date,
  status text not null default 'aberto' check (status in ('aberto', 'respondido', 'recusado')),
  answered_at timestamptz,
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 500),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint hr_feedback_requests_pair check (giver_employee_id <> subject_employee_id)
);
create index if not exists hr_feedback_requests_giver_idx on public.hr_feedback_requests (giver_employee_id, status);
create index if not exists hr_feedback_requests_requester_idx on public.hr_feedback_requests (requester_employee_id);

-- ---------------------------------------------------------------------------
-- Feedbacks.
-- ---------------------------------------------------------------------------
create table if not exists public.hr_feedbacks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reconhecimento', 'desenvolvimento', 'sem_tipo', 'boa_pratica')),
  from_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  to_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  -- privado = só quem recebe; gestor = quem recebe + gestores dela; publico = mural (só reconhecimento)
  visibility text not null default 'privado' check (visibility in ('privado', 'gestor', 'publico')),
  civil_values text[] not null default '{}',
  -- notas de 1 a 5 por valor trazidas do Feedz (o ORQESTRAI usa só etiqueta)
  value_ratings jsonb,
  template_id uuid references public.hr_feedback_templates(id) on delete set null,
  template_name text,
  message text not null check (char_length(btrim(message)) between 1 and 20000),
  in_person boolean not null default false,
  ai_assisted boolean not null default false,
  request_id uuid references public.hr_feedback_requests(id) on delete set null,
  good_practice_id uuid references public.hr_good_practice_feedbacks(id) on delete set null,
  read_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  feedz_id bigint unique,
  constraint hr_feedbacks_pair check (from_employee_id <> to_employee_id),
  constraint hr_feedbacks_public_only_recognition check (visibility <> 'publico' or kind = 'reconhecimento'),
  constraint hr_feedbacks_values check (cardinality(civil_values) <= 5)
);
create index if not exists hr_feedbacks_to_idx on public.hr_feedbacks (to_employee_id, created_at desc);
create index if not exists hr_feedbacks_from_idx on public.hr_feedbacks (from_employee_id, created_at desc);
create index if not exists hr_feedbacks_public_idx on public.hr_feedbacks (created_at desc) where visibility = 'publico' and deleted_at is null;
create index if not exists hr_feedbacks_good_practice_idx on public.hr_feedbacks (good_practice_id) where good_practice_id is not null;

create table if not exists public.hr_feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.hr_feedbacks(id) on delete cascade,
  author_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 5000),
  feedz_id bigint unique,
  created_at timestamptz not null default now()
);
create index if not exists hr_feedback_replies_feedback_idx on public.hr_feedback_replies (feedback_id, created_at);

-- Anotação privada de cada autor (nem o RH lê).
create table if not exists public.hr_feedback_notes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.hr_feedbacks(id) on delete cascade,
  author_employee_id uuid not null references public.hr_employees(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  updated_at timestamptz not null default now(),
  unique (feedback_id, author_employee_id)
);

-- ---------------------------------------------------------------------------
-- Acesso: só a API (service role).
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.hr_feedback_settings enable row level security;
alter table public.hr_feedback_templates enable row level security;
alter table public.hr_feedback_requests enable row level security;
alter table public.hr_feedbacks enable row level security;
alter table public.hr_feedback_replies enable row level security;
alter table public.hr_feedback_notes enable row level security;

revoke all on public.notifications, public.hr_feedback_settings, public.hr_feedback_templates, public.hr_feedback_requests,
  public.hr_feedbacks, public.hr_feedback_replies, public.hr_feedback_notes
  from anon, authenticated;
grant all on public.notifications, public.hr_feedback_settings, public.hr_feedback_templates, public.hr_feedback_requests,
  public.hr_feedbacks, public.hr_feedback_replies, public.hr_feedback_notes
  to service_role;
