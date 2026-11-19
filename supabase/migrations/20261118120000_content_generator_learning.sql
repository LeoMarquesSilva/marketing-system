-- Gerador de conteúdo: configurações editáveis no módulo, aprendizado com o Instagram
-- e nota de potencial de cada matéria antes de gastar IA no carrossel.

-- Uma linha só (id 'default'): regras da IA do post e da busca.
create table if not exists public.content_generator_settings (
  id text primary key default 'default' check (id = 'default'),
  voice_instructions text not null default '',
  slide_count smallint not null default 5 check (slide_count between 3 and 10),
  default_cta text not null default '',
  avoid_rules text not null default '',
  min_relevance smallint not null default 4 check (min_relevance between 0 and 10),
  max_per_run smallint not null default 15 check (max_per_run between 1 and 40),
  use_learning boolean not null default true,
  updated_by_id uuid,
  updated_by_name text,
  updated_at timestamptz not null default now()
);

insert into public.content_generator_settings (id) values ('default') on conflict (id) do nothing;

-- Cada vez que a IA estuda o Instagram + escolhas + edições da equipe, guarda o resultado.
create table if not exists public.content_learning_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trigger text not null default 'manual',
  created_by_id uuid,
  created_by_name text,
  posts_analyzed integer not null default 0,
  choices_analyzed integer not null default 0,
  edits_analyzed integer not null default 0,
  stats jsonb not null default '{}'::jsonb,
  playbook jsonb not null default '{}'::jsonb
);

create index if not exists content_learning_snapshots_created_at_idx
  on public.content_learning_snapshots (created_at desc);

-- Nota de potencial (0–10) e o motivo, dados pela IA antes de gerar o carrossel.
alter table public.content_roteiros
  add column if not exists relevance_score smallint,
  add column if not exists relevance_reason text;

-- Quantas matérias ficaram abaixo da nota mínima em cada busca.
alter table public.content_fetch_runs
  add column if not exists low_score integer not null default 0;

-- Acesso só pelo servidor (service role); nada exposto ao navegador.
alter table public.content_generator_settings enable row level security;
alter table public.content_learning_snapshots enable row level security;
