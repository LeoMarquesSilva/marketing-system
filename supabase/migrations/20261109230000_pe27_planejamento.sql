-- PE27 (Planejamento Estratégico 2027): só admin por enquanto.
--
-- Estrutura do ciclo (apresentação do workshop de 05/11/2026):
--   Dimensões (Clientes, Pessoas, Acionistas) → Alavancas de valor → Metas
--   estratégicas → Metas de esforço (plano tático, ainda não modelado).
--
-- strategic_plan_groups / _group_members: grupos das dinâmicas do workshop
--   (quem estava em cada um e a foto do cartaz no bucket PE27).
-- strategic_plan_levers / _goals: alavancas e metas. As que vieram dos cartazes
--   guardam o texto original (original_*) e a observação da transcrição; a
--   revisão dos sócios muda o texto atual e registra a decisão (status).
--   "juntada" aponta para a alavanca/meta que ficou (merged_into).
--
-- Leitura e escrita só pelo servidor (service role), depois de conferir admin.

create table if not exists public.strategic_plan_groups (
  id uuid primary key default gen_random_uuid(),
  cycle text not null default 'PE27',
  dynamic smallint not null check (dynamic in (1, 2)),
  dimension text check (dimension in ('clientes', 'pessoas', 'acionistas')),
  name text not null,
  -- Título escrito no cartaz, quando tem (ex.: "Meta #01 – Cliente").
  poster_title text,
  -- Caminho da foto do cartaz no bucket PE27.
  poster_path text,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_plan_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.strategic_plan_groups(id) on delete cascade,
  employee_id uuid references public.hr_employees(id) on delete set null,
  -- Nome e área como estão na folha da dinâmica.
  name text not null,
  area text,
  is_area_partner boolean not null default false,
  sort smallint not null default 0
);

create index if not exists strategic_plan_group_members_group_idx
  on public.strategic_plan_group_members (group_id);

create table if not exists public.strategic_plan_levers (
  id uuid primary key default gen_random_uuid(),
  cycle text not null default 'PE27',
  dimension text not null check (dimension in ('clientes', 'pessoas', 'acionistas')),
  -- Grupo de origem; null = criada na revisão dos sócios.
  group_id uuid references public.strategic_plan_groups(id) on delete set null,
  position smallint not null default 0,
  title text not null,
  original_title text,
  transcription_note text,
  status text not null default 'em_analise'
    check (status in ('em_analise', 'mantida', 'ajustada', 'juntada', 'descartada')),
  merged_into uuid references public.strategic_plan_levers(id) on delete set null,
  decision_note text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists strategic_plan_levers_cycle_idx
  on public.strategic_plan_levers (cycle, dimension, position);

create table if not exists public.strategic_plan_goals (
  id uuid primary key default gen_random_uuid(),
  lever_id uuid not null references public.strategic_plan_levers(id) on delete cascade,
  position smallint not null default 0,
  text text not null,
  original_text text,
  transcription_note text,
  status text not null default 'em_analise'
    check (status in ('em_analise', 'mantida', 'ajustada', 'juntada', 'descartada')),
  merged_into uuid references public.strategic_plan_goals(id) on delete set null,
  decision_note text,
  -- Para a meta oficial: ponto de partida, alvo de 2027 e de onde vem o número.
  baseline text,
  target text,
  data_source text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists strategic_plan_goals_lever_idx
  on public.strategic_plan_goals (lever_id, position);

drop trigger if exists strategic_plan_groups_set_updated_at on public.strategic_plan_groups;
create trigger strategic_plan_groups_set_updated_at
before update on public.strategic_plan_groups
for each row execute function public.set_ferias_updated_at();

drop trigger if exists strategic_plan_levers_set_updated_at on public.strategic_plan_levers;
create trigger strategic_plan_levers_set_updated_at
before update on public.strategic_plan_levers
for each row execute function public.set_ferias_updated_at();

drop trigger if exists strategic_plan_goals_set_updated_at on public.strategic_plan_goals;
create trigger strategic_plan_goals_set_updated_at
before update on public.strategic_plan_goals
for each row execute function public.set_ferias_updated_at();

alter table public.strategic_plan_groups enable row level security;
alter table public.strategic_plan_group_members enable row level security;
alter table public.strategic_plan_levers enable row level security;
alter table public.strategic_plan_goals enable row level security;

revoke all on public.strategic_plan_groups from anon, authenticated;
revoke all on public.strategic_plan_group_members from anon, authenticated;
revoke all on public.strategic_plan_levers from anon, authenticated;
revoke all on public.strategic_plan_goals from anon, authenticated;

grant select, insert, update, delete on public.strategic_plan_groups to service_role;
grant select, insert, update, delete on public.strategic_plan_group_members to service_role;
grant select, insert, update, delete on public.strategic_plan_levers to service_role;
grant select, insert, update, delete on public.strategic_plan_goals to service_role;

-- Bucket privado: fotos dos cartazes e material do workshop (link assinado).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'PE27',
  'PE27',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
