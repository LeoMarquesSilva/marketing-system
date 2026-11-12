-- Felicitações na tela inicial: curtir e comentar o aniversário (da pessoa ou de empresa)
-- de alguém da equipe, com a opção de marcar colegas no comentário.
-- A comemoração é identificada por pessoa + tipo + ano, igual às artes (hr_birthday_arts).

create table if not exists public.hr_celebration_reactions (
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  kind text not null check (kind in ('aniversario', 'empresa')),
  year integer not null check (year between 2020 and 2100),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employee_id, kind, year, user_id)
);

create table if not exists public.hr_celebration_comments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  kind text not null check (kind in ('aniversario', 'empresa')),
  year integer not null check (year between 2020 and 2100),
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  -- Colegas marcados no comentário (ids de hr_employees).
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists hr_celebration_comments_target_idx
  on public.hr_celebration_comments (employee_id, kind, year, created_at);

-- Leitura e escrita só pelo servidor (service role), que confere quem está logado.
alter table public.hr_celebration_reactions enable row level security;
alter table public.hr_celebration_comments enable row level security;
revoke all on public.hr_celebration_reactions from anon, authenticated;
revoke all on public.hr_celebration_comments from anon, authenticated;
grant select, insert, update, delete on public.hr_celebration_reactions to service_role;
grant select, insert, update, delete on public.hr_celebration_comments to service_role;
