-- Felicitações: elogio com um clique (os cinco valores CIVIL do escritório) e curtida em mensagem.

create table if not exists public.hr_celebration_praises (
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  kind text not null check (kind in ('aniversario', 'empresa')),
  year integer not null check (year between 2020 and 2100),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Mesmas chaves das categorias do BP Awards (AWARD_CATEGORY_KEYS).
  praise text not null check (praise in ('cliente', 'inovacao', 'valorizacao', 'inteligencia', 'liberdade')),
  created_at timestamptz not null default now(),
  primary key (employee_id, kind, year, user_id, praise)
);

create table if not exists public.hr_celebration_comment_likes (
  comment_id uuid not null references public.hr_celebration_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- Leitura e escrita só pelo servidor (service role), que confere quem está logado.
alter table public.hr_celebration_praises enable row level security;
alter table public.hr_celebration_comment_likes enable row level security;
revoke all on public.hr_celebration_praises from anon, authenticated;
revoke all on public.hr_celebration_comment_likes from anon, authenticated;
grant select, insert, update, delete on public.hr_celebration_praises to service_role;
grant select, insert, update, delete on public.hr_celebration_comment_likes to service_role;
