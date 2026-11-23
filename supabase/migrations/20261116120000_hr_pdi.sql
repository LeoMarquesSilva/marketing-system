-- PDI (Plano de Desenvolvimento Individual) — substitui o módulo de PDI do Feedz.
-- Estrutura igual à do Feedz (plano → frentes/competências → ações com progresso 0-100),
-- mais o que o Feedz não tem: 70-20-10 como campo, evidência, prazo por ação,
-- histórico de progresso e comentários do gestor.
-- Engenharia reversa em docs/feedz/README.md e docs/feedz/telas-logado.md.

-- 1) Gestor direto de cada colaborador (base do PDI, da 1:1 e das avaliações).
alter table public.hr_employees
  add column if not exists manager_employee_id uuid references public.hr_employees(id) on delete set null;

alter table public.hr_employees
  drop constraint if exists hr_employees_manager_not_self;
alter table public.hr_employees
  add constraint hr_employees_manager_not_self check (manager_employee_id is null or manager_employee_id <> id);

create index if not exists hr_employees_manager_idx on public.hr_employees (manager_employee_id);

-- 2) Tipos de PDI (no Feedz: "Desenvolvimento de Competências Comportamentais e Técnicas").
create table if not exists public.hr_pdi_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists hr_pdi_types_name_key on public.hr_pdi_types (lower(name));

insert into public.hr_pdi_types (name, description, sort_order) values
  ('Competências comportamentais e técnicas', 'Plano construído a partir da avaliação de competências.', 1),
  ('Liderança', 'Desenvolvimento de quem lidera ou vai liderar pessoas.', 2),
  ('Habilidades técnicas', 'Domínio técnico da área de atuação.', 3),
  ('Carreira', 'Preparação para o próximo passo de carreira.', 4)
on conflict do nothing;

-- 3) Plano.
create table if not exists public.hr_pdi_plans (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  -- Quem acompanha (gestor direto na criação; o RH pode trocar).
  manager_employee_id uuid references public.hr_employees(id) on delete set null,
  type_id uuid references public.hr_pdi_types(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  -- Visão de carreira / foco do plano ("onde quero chegar").
  career_goal text check (career_goal is null or char_length(career_goal) <= 2000),
  origin text not null default 'manual' check (origin in ('manual', 'avaliacao', 'feedz')),
  origin_label text,
  start_date date not null,
  due_date date not null,
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'cancelado')),
  completed_at timestamptz,
  status_note text,
  -- "De acordo" do gestor com o plano.
  agreed_at timestamptz,
  agreed_by uuid references public.users(id) on delete set null,
  feedz_id bigint unique,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_pdi_plans_dates check (due_date >= start_date)
);
create index if not exists hr_pdi_plans_employee_idx on public.hr_pdi_plans (employee_id, status);
create index if not exists hr_pdi_plans_manager_idx on public.hr_pdi_plans (manager_employee_id);

-- 4) Frentes do plano (no Feedz: "grupo de tarefas"; na prática, uma competência).
create table if not exists public.hr_pdi_goals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.hr_pdi_plans(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text check (description is null or char_length(description) <= 4000),
  -- Valor CIVIL / competência da avaliação a que a frente se liga (texto livre por enquanto).
  competency text,
  sort_order integer not null default 0,
  feedz_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_pdi_goals_plan_idx on public.hr_pdi_goals (plan_id, sort_order);

-- 5) Ações (no Feedz: "tarefa", com status = progresso 0-100).
create table if not exists public.hr_pdi_actions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.hr_pdi_plans(id) on delete cascade,
  goal_id uuid not null references public.hr_pdi_goals(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 300),
  description text check (description is null or char_length(description) <= 8000),
  -- 70-20-10: prática no trabalho, troca com pessoas, aprendizado formal.
  learning_kind text check (learning_kind in ('pratica', 'troca', 'formal')),
  expected_evidence text check (expected_evidence is null or char_length(expected_evidence) <= 2000),
  success_indicator text check (success_indicator is null or char_length(success_indicator) <= 2000),
  due_date date,
  progress integer not null default 0 check (progress between 0 and 100),
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  learnings text check (learnings is null or char_length(learnings) <= 8000),
  evidence_url text check (evidence_url is null or char_length(evidence_url) <= 1000),
  sort_order integer not null default 0,
  last_update_at timestamptz,
  feedz_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_pdi_actions_plan_idx on public.hr_pdi_actions (plan_id);
create index if not exists hr_pdi_actions_goal_idx on public.hr_pdi_actions (goal_id, sort_order);

-- 6) Linha do tempo: atualização de progresso, comentário, mudança de status, "de acordo".
create table if not exists public.hr_pdi_activity (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.hr_pdi_plans(id) on delete cascade,
  action_id uuid references public.hr_pdi_actions(id) on delete cascade,
  kind text not null check (kind in ('progresso', 'comentario', 'status', 'acordo', 'criacao', 'edicao')),
  progress_from integer check (progress_from between 0 and 100),
  progress_to integer check (progress_to between 0 and 100),
  body text check (body is null or char_length(body) <= 4000),
  author_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hr_pdi_activity_plan_idx on public.hr_pdi_activity (plan_id, created_at desc);
create index if not exists hr_pdi_activity_action_idx on public.hr_pdi_activity (action_id, created_at desc);

-- Leitura e escrita só pelo servidor (service role), que confere quem está logado
-- (o próprio colaborador, o gestor da equipe ou o RH).
alter table public.hr_pdi_types enable row level security;
alter table public.hr_pdi_plans enable row level security;
alter table public.hr_pdi_goals enable row level security;
alter table public.hr_pdi_actions enable row level security;
alter table public.hr_pdi_activity enable row level security;
revoke all on public.hr_pdi_types, public.hr_pdi_plans, public.hr_pdi_goals, public.hr_pdi_actions, public.hr_pdi_activity
  from anon, authenticated;
grant select, insert, update, delete on public.hr_pdi_types, public.hr_pdi_plans, public.hr_pdi_goals, public.hr_pdi_actions, public.hr_pdi_activity
  to service_role;
