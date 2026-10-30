-- Bismarchi | Pires Awards (Pessoas e Cultura > BP Awards).
--
-- Premiação CIVIL da festa de 10 anos: cada colaborador ativo indica, com
-- login (votação identificada), quem mais representa cada um dos 5 valores e
-- descreve uma situação concreta. As indicações ficam salvas como rascunho
-- até o envio e podem ser editadas enquanto a votação estiver aberta.
-- O comitê (quem tem RH) escolhe até 3 finalistas e 1 vencedor por valor;
-- a revelação acontece no telão da festa e o resultado só aparece para
-- todos depois que o RH publica.
--
-- Os valores (cliente, inovacao, valorizacao, inteligencia, liberdade) ficam
-- no código (src/lib/rh/bp-awards/types.ts). Tudo aqui é lido e gravado só
-- pelo servidor (service role): votos não ficam expostos ao navegador.

create table if not exists public.hr_award_editions (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique check (year between 2020 and 2100),
  title text not null check (length(trim(title)) > 0),
  voting_opens_at timestamptz,
  voting_closes_at timestamptz,
  -- Sócios (departamento "Sócio" e cargos "Sócio de Área") votam, mas só concorrem se true.
  partners_eligible boolean not null default false,
  results_published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (voting_opens_at is null or voting_closes_at is null or voting_closes_at > voting_opens_at)
);

create table if not exists public.hr_award_ballots (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.hr_award_editions(id) on delete cascade,
  voter_user_id uuid not null references public.users(id) on delete cascade,
  voter_employee_id uuid references public.hr_employees(id) on delete set null,
  -- null = rascunho; as indicações só entram na apuração depois do envio.
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, voter_user_id)
);

create table if not exists public.hr_award_nominations (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.hr_award_ballots(id) on delete cascade,
  edition_id uuid not null references public.hr_award_editions(id) on delete cascade,
  category text not null check (category in ('cliente', 'inovacao', 'valorizacao', 'inteligencia', 'liberdade')),
  nominee_employee_id uuid not null references public.hr_employees(id) on delete restrict,
  justification text not null default '' check (length(justification) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ballot_id, category)
);

create index if not exists hr_award_nominations_edition_idx
  on public.hr_award_nominations (edition_id, category, nominee_employee_id);

create table if not exists public.hr_award_finalists (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.hr_award_editions(id) on delete cascade,
  category text not null check (category in ('cliente', 'inovacao', 'valorizacao', 'inteligencia', 'liberdade')),
  employee_id uuid not null references public.hr_employees(id) on delete restrict,
  is_winner boolean not null default false,
  -- Texto da homenagem, lido na revelação.
  citation text check (citation is null or length(citation) <= 1200),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, category, employee_id)
);

create unique index if not exists hr_award_finalists_one_winner_idx
  on public.hr_award_finalists (edition_id, category)
  where is_winner;

drop trigger if exists hr_award_editions_set_updated_at on public.hr_award_editions;
create trigger hr_award_editions_set_updated_at
before update on public.hr_award_editions
for each row execute function public.set_ferias_updated_at();

drop trigger if exists hr_award_ballots_set_updated_at on public.hr_award_ballots;
create trigger hr_award_ballots_set_updated_at
before update on public.hr_award_ballots
for each row execute function public.set_ferias_updated_at();

drop trigger if exists hr_award_nominations_set_updated_at on public.hr_award_nominations;
create trigger hr_award_nominations_set_updated_at
before update on public.hr_award_nominations
for each row execute function public.set_ferias_updated_at();

drop trigger if exists hr_award_finalists_set_updated_at on public.hr_award_finalists;
create trigger hr_award_finalists_set_updated_at
before update on public.hr_award_finalists
for each row execute function public.set_ferias_updated_at();

alter table public.hr_award_editions enable row level security;
alter table public.hr_award_ballots enable row level security;
alter table public.hr_award_nominations enable row level security;
alter table public.hr_award_finalists enable row level security;

revoke all on public.hr_award_editions from anon, authenticated;
revoke all on public.hr_award_ballots from anon, authenticated;
revoke all on public.hr_award_nominations from anon, authenticated;
revoke all on public.hr_award_finalists from anon, authenticated;

grant select, insert, update, delete on public.hr_award_editions to service_role;
grant select, insert, update, delete on public.hr_award_ballots to service_role;
grant select, insert, update, delete on public.hr_award_nominations to service_role;
grant select, insert, update, delete on public.hr_award_finalists to service_role;

-- Edição da festa de 10 anos; as datas da votação o RH define na tela.
insert into public.hr_award_editions (year, title)
values (2026, 'Bismarchi | Pires Awards')
on conflict (year) do nothing;
