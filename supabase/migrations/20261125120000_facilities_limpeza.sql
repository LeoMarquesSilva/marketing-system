-- Facilities > Limpeza (25/11/2026).
--
-- Substitui a planilha "Checklist limpeza V2": a equipe da limpeza marca no
-- celular os ambientes limpos do dia e encerra o dia; Facilities confere e
-- assina, anota o dia e a semana e acompanha os números.
--
-- Cronograma: 4 semanas x seg a sex, uma letra por ambiente e dia
-- (S = simples, M = média, C = completa, L = lavagem). A semana conta pelos
-- dias úteis do mês (sem feriados); a 5ª semana repete a 1ª (regra no código).

create table if not exists public.facility_cleaning_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facility_cleaning_schedule (
  area_id uuid not null references public.facility_cleaning_areas(id) on delete cascade,
  week smallint not null check (week between 1 and 4),
  weekday smallint not null check (weekday between 1 and 5),
  kind text not null check (kind in ('simples', 'media', 'completa', 'lavagem')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,
  primary key (area_id, week, weekday)
);

-- Um registro por dia útil em que algo aconteceu: encerramento, conferência ou "sem limpeza".
create table if not exists public.facility_cleaning_days (
  day date primary key,
  closed_by uuid references public.users(id) on delete set null,
  closed_at timestamptz,
  close_note text,
  no_cleaning_reason text,
  no_cleaning_by uuid references public.users(id) on delete set null,
  no_cleaning_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_result text check (review_result is null or review_result in ('ok', 'ressalvas')),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facility_cleaning_checks (
  day date not null,
  area_id uuid not null references public.facility_cleaning_areas(id) on delete cascade,
  status text not null check (status in ('limpo', 'nao_limpo')),
  reason text check (reason is null or reason in ('ocupada', 'reuniao', 'falta_material', 'outro')),
  note text,
  -- Tipo previsto no cronograma naquele dia (fica gravado mesmo se o cronograma mudar depois).
  kind text check (kind is null or kind in ('simples', 'media', 'completa', 'lavagem')),
  checked_by uuid references public.users(id) on delete set null,
  checked_at timestamptz not null default now(),
  primary key (day, area_id)
);
create index if not exists facility_cleaning_checks_day_idx on public.facility_cleaning_checks (day);

create table if not exists public.facility_cleaning_issues (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  area_id uuid references public.facility_cleaning_areas(id) on delete set null,
  description text not null,
  photo_path text,
  reported_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'aberto' check (status in ('aberto', 'resolvido', 'manutencao')),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  maintenance_plan_id uuid references public.maintenance_plans(id) on delete set null
);
create index if not exists facility_cleaning_issues_status_idx on public.facility_cleaning_issues (status, created_at desc);

-- Anotação da semana (segunda-feira da semana).
create table if not exists public.facility_cleaning_week_notes (
  week_start date primary key,
  note text not null,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Histórico do que muda depois de assinado ou encerrado (reabrir, sem limpeza...).
create table if not exists public.facility_cleaning_log (
  id bigint generated always as identity primary key,
  day date not null,
  action text not null,
  reason text,
  actor uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists facility_cleaning_log_day_idx on public.facility_cleaning_log (day);

drop trigger if exists facility_cleaning_areas_set_updated_at on public.facility_cleaning_areas;
create trigger facility_cleaning_areas_set_updated_at
before update on public.facility_cleaning_areas
for each row execute function public.set_ferias_updated_at();

drop trigger if exists facility_cleaning_days_set_updated_at on public.facility_cleaning_days;
create trigger facility_cleaning_days_set_updated_at
before update on public.facility_cleaning_days
for each row execute function public.set_ferias_updated_at();

-- ------------------------------------------------------------ acesso (só o servidor, depois de conferir a permissão)

alter table public.facility_cleaning_areas enable row level security;
alter table public.facility_cleaning_schedule enable row level security;
alter table public.facility_cleaning_days enable row level security;
alter table public.facility_cleaning_checks enable row level security;
alter table public.facility_cleaning_issues enable row level security;
alter table public.facility_cleaning_week_notes enable row level security;
alter table public.facility_cleaning_log enable row level security;

revoke all on public.facility_cleaning_areas from anon, authenticated;
revoke all on public.facility_cleaning_schedule from anon, authenticated;
revoke all on public.facility_cleaning_days from anon, authenticated;
revoke all on public.facility_cleaning_checks from anon, authenticated;
revoke all on public.facility_cleaning_issues from anon, authenticated;
revoke all on public.facility_cleaning_week_notes from anon, authenticated;
revoke all on public.facility_cleaning_log from anon, authenticated;

grant select, insert, update, delete on public.facility_cleaning_areas to service_role;
grant select, insert, update, delete on public.facility_cleaning_schedule to service_role;
grant select, insert, update, delete on public.facility_cleaning_days to service_role;
grant select, insert, update, delete on public.facility_cleaning_checks to service_role;
grant select, insert, update, delete on public.facility_cleaning_issues to service_role;
grant select, insert, update, delete on public.facility_cleaning_week_notes to service_role;
grant select, insert, update, delete on public.facility_cleaning_log to service_role;

-- ------------------------------------------------------------ cronograma da planilha "Checklist limpeza V2"

-- 15 ambientes, 300 células
insert into public.facility_cleaning_areas (name, position) values
  ('Recepção e Biblioteca', 10),
  ('Área Impressoras e Outback', 20),
  ('Copa Térreo', 30),
  ('ADM', 40),
  ('Cível', 50),
  ('Operações Legais', 60),
  ('Trabalhista', 70),
  ('Área Externa / Jardim', 80),
  ('Sala Sócios (Gustavo e Ricardo)', 90),
  ('Sala Reunião 2', 100),
  ('Sala Felipe', 110),
  ('Reestruturação', 120),
  ('Copa Superior / Cozinha', 130),
  ('Banheiros (Térreo e Superior)', 140),
  ('Escada', 150)
on conflict (name) do nothing;

insert into public.facility_cleaning_schedule (area_id, week, weekday, kind)
select a.id, v.week, v.weekday, v.kind
from (values
  ('Recepção e Biblioteca', 1, 1, 'simples'),
  ('Recepção e Biblioteca', 1, 2, 'simples'),
  ('Recepção e Biblioteca', 1, 3, 'completa'),
  ('Recepção e Biblioteca', 1, 4, 'simples'),
  ('Recepção e Biblioteca', 1, 5, 'simples'),
  ('Área Impressoras e Outback', 1, 1, 'simples'),
  ('Área Impressoras e Outback', 1, 2, 'simples'),
  ('Área Impressoras e Outback', 1, 3, 'completa'),
  ('Área Impressoras e Outback', 1, 4, 'simples'),
  ('Área Impressoras e Outback', 1, 5, 'simples'),
  ('Copa Térreo', 1, 1, 'simples'),
  ('Copa Térreo', 1, 2, 'simples'),
  ('Copa Térreo', 1, 3, 'completa'),
  ('Copa Térreo', 1, 4, 'simples'),
  ('Copa Térreo', 1, 5, 'simples'),
  ('ADM', 1, 1, 'simples'),
  ('ADM', 1, 2, 'simples'),
  ('ADM', 1, 3, 'completa'),
  ('ADM', 1, 4, 'simples'),
  ('ADM', 1, 5, 'simples'),
  ('Cível', 1, 1, 'simples'),
  ('Cível', 1, 2, 'simples'),
  ('Cível', 1, 3, 'completa'),
  ('Cível', 1, 4, 'simples'),
  ('Cível', 1, 5, 'simples'),
  ('Operações Legais', 1, 1, 'simples'),
  ('Operações Legais', 1, 2, 'simples'),
  ('Operações Legais', 1, 3, 'completa'),
  ('Operações Legais', 1, 4, 'simples'),
  ('Operações Legais', 1, 5, 'simples'),
  ('Trabalhista', 1, 1, 'simples'),
  ('Trabalhista', 1, 2, 'simples'),
  ('Trabalhista', 1, 3, 'completa'),
  ('Trabalhista', 1, 4, 'simples'),
  ('Trabalhista', 1, 5, 'simples'),
  ('Área Externa / Jardim', 1, 1, 'simples'),
  ('Área Externa / Jardim', 1, 2, 'simples'),
  ('Área Externa / Jardim', 1, 3, 'simples'),
  ('Área Externa / Jardim', 1, 4, 'simples'),
  ('Área Externa / Jardim', 1, 5, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 1, 1, 'media'),
  ('Sala Sócios (Gustavo e Ricardo)', 1, 2, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 1, 3, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 1, 4, 'media'),
  ('Sala Sócios (Gustavo e Ricardo)', 1, 5, 'simples'),
  ('Sala Reunião 2', 1, 1, 'simples'),
  ('Sala Reunião 2', 1, 2, 'media'),
  ('Sala Reunião 2', 1, 3, 'simples'),
  ('Sala Reunião 2', 1, 4, 'simples'),
  ('Sala Reunião 2', 1, 5, 'simples'),
  ('Sala Felipe', 1, 1, 'media'),
  ('Sala Felipe', 1, 2, 'simples'),
  ('Sala Felipe', 1, 3, 'simples'),
  ('Sala Felipe', 1, 4, 'media'),
  ('Sala Felipe', 1, 5, 'simples'),
  ('Reestruturação', 1, 1, 'simples'),
  ('Reestruturação', 1, 2, 'media'),
  ('Reestruturação', 1, 3, 'simples'),
  ('Reestruturação', 1, 4, 'simples'),
  ('Reestruturação', 1, 5, 'simples'),
  ('Copa Superior / Cozinha', 1, 1, 'media'),
  ('Copa Superior / Cozinha', 1, 2, 'simples'),
  ('Copa Superior / Cozinha', 1, 3, 'lavagem'),
  ('Copa Superior / Cozinha', 1, 4, 'simples'),
  ('Copa Superior / Cozinha', 1, 5, 'simples'),
  ('Banheiros (Térreo e Superior)', 1, 1, 'lavagem'),
  ('Banheiros (Térreo e Superior)', 1, 2, 'simples'),
  ('Banheiros (Térreo e Superior)', 1, 3, 'lavagem'),
  ('Banheiros (Térreo e Superior)', 1, 4, 'simples'),
  ('Banheiros (Térreo e Superior)', 1, 5, 'media'),
  ('Escada', 1, 1, 'simples'),
  ('Escada', 1, 2, 'media'),
  ('Escada', 1, 3, 'simples'),
  ('Escada', 1, 4, 'simples'),
  ('Escada', 1, 5, 'simples'),
  ('Recepção e Biblioteca', 2, 1, 'media'),
  ('Recepção e Biblioteca', 2, 2, 'simples'),
  ('Recepção e Biblioteca', 2, 3, 'simples'),
  ('Recepção e Biblioteca', 2, 4, 'simples'),
  ('Recepção e Biblioteca', 2, 5, 'simples'),
  ('Área Impressoras e Outback', 2, 1, 'simples'),
  ('Área Impressoras e Outback', 2, 2, 'media'),
  ('Área Impressoras e Outback', 2, 3, 'simples'),
  ('Área Impressoras e Outback', 2, 4, 'simples'),
  ('Área Impressoras e Outback', 2, 5, 'simples'),
  ('Copa Térreo', 2, 1, 'simples'),
  ('Copa Térreo', 2, 2, 'simples'),
  ('Copa Térreo', 2, 3, 'simples'),
  ('Copa Térreo', 2, 4, 'simples'),
  ('Copa Térreo', 2, 5, 'media'),
  ('ADM', 2, 1, 'simples'),
  ('ADM', 2, 2, 'media'),
  ('ADM', 2, 3, 'simples'),
  ('ADM', 2, 4, 'simples'),
  ('ADM', 2, 5, 'simples'),
  ('Cível', 2, 1, 'simples'),
  ('Cível', 2, 2, 'simples'),
  ('Cível', 2, 3, 'simples'),
  ('Cível', 2, 4, 'simples'),
  ('Cível', 2, 5, 'media'),
  ('Operações Legais', 2, 1, 'simples'),
  ('Operações Legais', 2, 2, 'media'),
  ('Operações Legais', 2, 3, 'simples'),
  ('Operações Legais', 2, 4, 'simples'),
  ('Operações Legais', 2, 5, 'simples'),
  ('Trabalhista', 2, 1, 'simples'),
  ('Trabalhista', 2, 2, 'simples'),
  ('Trabalhista', 2, 3, 'simples'),
  ('Trabalhista', 2, 4, 'media'),
  ('Trabalhista', 2, 5, 'simples'),
  ('Área Externa / Jardim', 2, 1, 'simples'),
  ('Área Externa / Jardim', 2, 2, 'simples'),
  ('Área Externa / Jardim', 2, 3, 'simples'),
  ('Área Externa / Jardim', 2, 4, 'simples'),
  ('Área Externa / Jardim', 2, 5, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 2, 1, 'media'),
  ('Sala Sócios (Gustavo e Ricardo)', 2, 2, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 2, 3, 'completa'),
  ('Sala Sócios (Gustavo e Ricardo)', 2, 4, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 2, 5, 'simples'),
  ('Sala Reunião 2', 2, 1, 'simples'),
  ('Sala Reunião 2', 2, 2, 'simples'),
  ('Sala Reunião 2', 2, 3, 'completa'),
  ('Sala Reunião 2', 2, 4, 'media'),
  ('Sala Reunião 2', 2, 5, 'simples'),
  ('Sala Felipe', 2, 1, 'media'),
  ('Sala Felipe', 2, 2, 'simples'),
  ('Sala Felipe', 2, 3, 'completa'),
  ('Sala Felipe', 2, 4, 'simples'),
  ('Sala Felipe', 2, 5, 'simples'),
  ('Reestruturação', 2, 1, 'simples'),
  ('Reestruturação', 2, 2, 'simples'),
  ('Reestruturação', 2, 3, 'completa'),
  ('Reestruturação', 2, 4, 'media'),
  ('Reestruturação', 2, 5, 'simples'),
  ('Copa Superior / Cozinha', 2, 1, 'media'),
  ('Copa Superior / Cozinha', 2, 2, 'simples'),
  ('Copa Superior / Cozinha', 2, 3, 'lavagem'),
  ('Copa Superior / Cozinha', 2, 4, 'simples'),
  ('Copa Superior / Cozinha', 2, 5, 'media'),
  ('Banheiros (Térreo e Superior)', 2, 1, 'lavagem'),
  ('Banheiros (Térreo e Superior)', 2, 2, 'simples'),
  ('Banheiros (Térreo e Superior)', 2, 3, 'lavagem'),
  ('Banheiros (Térreo e Superior)', 2, 4, 'simples'),
  ('Banheiros (Térreo e Superior)', 2, 5, 'media'),
  ('Escada', 2, 1, 'simples'),
  ('Escada', 2, 2, 'simples'),
  ('Escada', 2, 3, 'completa'),
  ('Escada', 2, 4, 'simples'),
  ('Escada', 2, 5, 'simples'),
  ('Recepção e Biblioteca', 3, 1, 'simples'),
  ('Recepção e Biblioteca', 3, 2, 'simples'),
  ('Recepção e Biblioteca', 3, 3, 'completa'),
  ('Recepção e Biblioteca', 3, 4, 'simples'),
  ('Recepção e Biblioteca', 3, 5, 'simples'),
  ('Área Impressoras e Outback', 3, 1, 'simples'),
  ('Área Impressoras e Outback', 3, 2, 'simples'),
  ('Área Impressoras e Outback', 3, 3, 'completa'),
  ('Área Impressoras e Outback', 3, 4, 'simples'),
  ('Área Impressoras e Outback', 3, 5, 'simples'),
  ('Copa Térreo', 3, 1, 'simples'),
  ('Copa Térreo', 3, 2, 'simples'),
  ('Copa Térreo', 3, 3, 'completa'),
  ('Copa Térreo', 3, 4, 'simples'),
  ('Copa Térreo', 3, 5, 'simples'),
  ('ADM', 3, 1, 'simples'),
  ('ADM', 3, 2, 'simples'),
  ('ADM', 3, 3, 'completa'),
  ('ADM', 3, 4, 'simples'),
  ('ADM', 3, 5, 'simples'),
  ('Cível', 3, 1, 'simples'),
  ('Cível', 3, 2, 'simples'),
  ('Cível', 3, 3, 'completa'),
  ('Cível', 3, 4, 'simples'),
  ('Cível', 3, 5, 'simples'),
  ('Operações Legais', 3, 1, 'simples'),
  ('Operações Legais', 3, 2, 'simples'),
  ('Operações Legais', 3, 3, 'completa'),
  ('Operações Legais', 3, 4, 'simples'),
  ('Operações Legais', 3, 5, 'simples'),
  ('Trabalhista', 3, 1, 'simples'),
  ('Trabalhista', 3, 2, 'simples'),
  ('Trabalhista', 3, 3, 'completa'),
  ('Trabalhista', 3, 4, 'simples'),
  ('Trabalhista', 3, 5, 'simples'),
  ('Área Externa / Jardim', 3, 1, 'simples'),
  ('Área Externa / Jardim', 3, 2, 'simples'),
  ('Área Externa / Jardim', 3, 3, 'simples'),
  ('Área Externa / Jardim', 3, 4, 'simples'),
  ('Área Externa / Jardim', 3, 5, 'lavagem'),
  ('Sala Sócios (Gustavo e Ricardo)', 3, 1, 'media'),
  ('Sala Sócios (Gustavo e Ricardo)', 3, 2, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 3, 3, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 3, 4, 'media'),
  ('Sala Sócios (Gustavo e Ricardo)', 3, 5, 'simples'),
  ('Sala Reunião 2', 3, 1, 'simples'),
  ('Sala Reunião 2', 3, 2, 'media'),
  ('Sala Reunião 2', 3, 3, 'simples'),
  ('Sala Reunião 2', 3, 4, 'simples'),
  ('Sala Reunião 2', 3, 5, 'simples'),
  ('Sala Felipe', 3, 1, 'media'),
  ('Sala Felipe', 3, 2, 'simples'),
  ('Sala Felipe', 3, 3, 'simples'),
  ('Sala Felipe', 3, 4, 'media'),
  ('Sala Felipe', 3, 5, 'simples'),
  ('Reestruturação', 3, 1, 'simples'),
  ('Reestruturação', 3, 2, 'media'),
  ('Reestruturação', 3, 3, 'simples'),
  ('Reestruturação', 3, 4, 'simples'),
  ('Reestruturação', 3, 5, 'simples'),
  ('Copa Superior / Cozinha', 3, 1, 'media'),
  ('Copa Superior / Cozinha', 3, 2, 'simples'),
  ('Copa Superior / Cozinha', 3, 3, 'lavagem'),
  ('Copa Superior / Cozinha', 3, 4, 'simples'),
  ('Copa Superior / Cozinha', 3, 5, 'media'),
  ('Banheiros (Térreo e Superior)', 3, 1, 'lavagem'),
  ('Banheiros (Térreo e Superior)', 3, 2, 'simples'),
  ('Banheiros (Térreo e Superior)', 3, 3, 'lavagem'),
  ('Banheiros (Térreo e Superior)', 3, 4, 'simples'),
  ('Banheiros (Térreo e Superior)', 3, 5, 'media'),
  ('Escada', 3, 1, 'simples'),
  ('Escada', 3, 2, 'simples'),
  ('Escada', 3, 3, 'simples'),
  ('Escada', 3, 4, 'media'),
  ('Escada', 3, 5, 'simples'),
  ('Recepção e Biblioteca', 4, 1, 'media'),
  ('Recepção e Biblioteca', 4, 2, 'simples'),
  ('Recepção e Biblioteca', 4, 3, 'simples'),
  ('Recepção e Biblioteca', 4, 4, 'simples'),
  ('Recepção e Biblioteca', 4, 5, 'simples'),
  ('Área Impressoras e Outback', 4, 1, 'simples'),
  ('Área Impressoras e Outback', 4, 2, 'media'),
  ('Área Impressoras e Outback', 4, 3, 'simples'),
  ('Área Impressoras e Outback', 4, 4, 'simples'),
  ('Área Impressoras e Outback', 4, 5, 'simples'),
  ('Copa Térreo', 4, 1, 'simples'),
  ('Copa Térreo', 4, 2, 'simples'),
  ('Copa Térreo', 4, 3, 'simples'),
  ('Copa Térreo', 4, 4, 'simples'),
  ('Copa Térreo', 4, 5, 'media'),
  ('ADM', 4, 1, 'simples'),
  ('ADM', 4, 2, 'media'),
  ('ADM', 4, 3, 'simples'),
  ('ADM', 4, 4, 'simples'),
  ('ADM', 4, 5, 'simples'),
  ('Cível', 4, 1, 'simples'),
  ('Cível', 4, 2, 'simples'),
  ('Cível', 4, 3, 'simples'),
  ('Cível', 4, 4, 'simples'),
  ('Cível', 4, 5, 'media'),
  ('Operações Legais', 4, 1, 'simples'),
  ('Operações Legais', 4, 2, 'media'),
  ('Operações Legais', 4, 3, 'simples'),
  ('Operações Legais', 4, 4, 'simples'),
  ('Operações Legais', 4, 5, 'simples'),
  ('Trabalhista', 4, 1, 'simples'),
  ('Trabalhista', 4, 2, 'simples'),
  ('Trabalhista', 4, 3, 'simples'),
  ('Trabalhista', 4, 4, 'media'),
  ('Trabalhista', 4, 5, 'simples'),
  ('Área Externa / Jardim', 4, 1, 'simples'),
  ('Área Externa / Jardim', 4, 2, 'simples'),
  ('Área Externa / Jardim', 4, 3, 'simples'),
  ('Área Externa / Jardim', 4, 4, 'simples'),
  ('Área Externa / Jardim', 4, 5, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 4, 1, 'media'),
  ('Sala Sócios (Gustavo e Ricardo)', 4, 2, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 4, 3, 'completa'),
  ('Sala Sócios (Gustavo e Ricardo)', 4, 4, 'simples'),
  ('Sala Sócios (Gustavo e Ricardo)', 4, 5, 'simples'),
  ('Sala Reunião 2', 4, 1, 'simples'),
  ('Sala Reunião 2', 4, 2, 'simples'),
  ('Sala Reunião 2', 4, 3, 'completa'),
  ('Sala Reunião 2', 4, 4, 'media'),
  ('Sala Reunião 2', 4, 5, 'simples'),
  ('Sala Felipe', 4, 1, 'media'),
  ('Sala Felipe', 4, 2, 'simples'),
  ('Sala Felipe', 4, 3, 'completa'),
  ('Sala Felipe', 4, 4, 'simples'),
  ('Sala Felipe', 4, 5, 'simples'),
  ('Reestruturação', 4, 1, 'simples'),
  ('Reestruturação', 4, 2, 'simples'),
  ('Reestruturação', 4, 3, 'completa'),
  ('Reestruturação', 4, 4, 'media'),
  ('Reestruturação', 4, 5, 'simples'),
  ('Copa Superior / Cozinha', 4, 1, 'media'),
  ('Copa Superior / Cozinha', 4, 2, 'simples'),
  ('Copa Superior / Cozinha', 4, 3, 'lavagem'),
  ('Copa Superior / Cozinha', 4, 4, 'simples'),
  ('Copa Superior / Cozinha', 4, 5, 'media'),
  ('Banheiros (Térreo e Superior)', 4, 1, 'lavagem'),
  ('Banheiros (Térreo e Superior)', 4, 2, 'simples'),
  ('Banheiros (Térreo e Superior)', 4, 3, 'lavagem'),
  ('Banheiros (Térreo e Superior)', 4, 4, 'simples'),
  ('Banheiros (Térreo e Superior)', 4, 5, 'media'),
  ('Escada', 4, 1, 'simples'),
  ('Escada', 4, 2, 'simples'),
  ('Escada', 4, 3, 'completa'),
  ('Escada', 4, 4, 'simples'),
  ('Escada', 4, 5, 'simples')
) as v(area, week, weekday, kind)
join public.facility_cleaning_areas a on a.name = v.area
on conflict (area_id, week, weekday) do nothing;
