-- BP Awards: leitura da IA para a reunião do comitê (aba Reunião de /rh/bp-awards).
--
-- hr_award_ai_reviews: nota de 0 a 10 e resumo de cada indicado em cada valor,
-- dados a partir de todos os relatos que ele recebeu (força das evidências,
-- não a quantidade de votos).
-- hr_award_ai_slots: sugestão de vencedor por valor em cada hub (um prêmio por
-- pessoa no hub), o porquê, quem entra no lugar e pontos de atenção.
--
-- É apoio para o debate: quem decide é o comitê (hr_award_finalists).
-- Como as demais tabelas hr_award_*, só o servidor (service role) lê e grava.

create table if not exists public.hr_award_ai_reviews (
  edition_id uuid not null references public.hr_award_editions(id) on delete cascade,
  hub text not null check (hub in ('empresarial', 'reestruturacao', 'operacoes')),
  category text not null check (category in ('cliente', 'inovacao', 'valorizacao', 'inteligencia', 'liberdade')),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  score smallint not null check (score between 0 and 10),
  summary text not null check (length(summary) <= 600),
  created_at timestamptz not null default now(),
  primary key (edition_id, hub, category, employee_id)
);

create table if not exists public.hr_award_ai_slots (
  edition_id uuid not null references public.hr_award_editions(id) on delete cascade,
  hub text not null check (hub in ('empresarial', 'reestruturacao', 'operacoes')),
  category text not null check (category in ('cliente', 'inovacao', 'valorizacao', 'inteligencia', 'liberdade')),
  suggested_employee_id uuid references public.hr_employees(id) on delete set null,
  reason text not null default '' check (length(reason) <= 600),
  alternative_employee_ids uuid[] not null default '{}',
  attention text not null default '' check (length(attention) <= 600),
  created_at timestamptz not null default now(),
  primary key (edition_id, hub, category)
);

alter table public.hr_award_ai_reviews enable row level security;
alter table public.hr_award_ai_slots enable row level security;
revoke all on public.hr_award_ai_reviews from anon, authenticated;
revoke all on public.hr_award_ai_slots from anon, authenticated;
grant select, insert, update, delete on public.hr_award_ai_reviews to service_role;
grant select, insert, update, delete on public.hr_award_ai_slots to service_role;
