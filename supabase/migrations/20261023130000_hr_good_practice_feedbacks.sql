-- Feedbacks de boas práticas (RH > Boas práticas).
--
-- Registro das ocorrências do Manual de Boas Práticas: quem, de qual área,
-- para qual gestor foi enviado, a providência do gestor e se foi visualizado
-- no Feedz. Por enquanto é só registro para o RH — nada é enviado ao
-- colaborador a partir daqui. Substitui a planilha
-- DASHBOARD_FEEDBACKS_BOAS_PRATICAS.xlsx (aba Registro).
--
-- employee_id / manager_employee_id ligam ao cadastro quando a pessoa foi
-- identificada; o nome fica sempre gravado (equipes inteiras, ex.: "Eq.
-- Reestruturação", não têm cadastro e vêm com is_team = true).
-- viewed: true = visualizado, false = não visualizado, null = sem dado do Feedz.

create table if not exists public.hr_good_practice_feedbacks (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null,
  sent_on date not null,
  employee_id uuid references public.hr_employees(id) on delete set null,
  employee_name text not null check (length(trim(employee_name)) > 0),
  is_team boolean not null default false,
  manager_employee_id uuid references public.hr_employees(id) on delete set null,
  manager_name text not null check (length(trim(manager_name)) > 0),
  area text not null check (length(trim(area)) > 0),
  category text not null check (length(trim(category)) > 0),
  description text not null check (length(trim(description)) > 0),
  manager_action text,
  responded_on date,
  viewed boolean,
  viewed_on date,
  source text not null default 'sistema' check (source in ('sistema', 'planilha')),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (viewed_on is null or viewed is true)
);

create index if not exists hr_good_practice_feedbacks_sent_idx
  on public.hr_good_practice_feedbacks (sent_on desc);

create index if not exists hr_good_practice_feedbacks_employee_idx
  on public.hr_good_practice_feedbacks (employee_id);

create index if not exists hr_good_practice_feedbacks_manager_idx
  on public.hr_good_practice_feedbacks (manager_employee_id);

drop trigger if exists hr_good_practice_feedbacks_set_updated_at on public.hr_good_practice_feedbacks;
create trigger hr_good_practice_feedbacks_set_updated_at
before update on public.hr_good_practice_feedbacks
for each row execute function public.set_ferias_updated_at();

alter table public.hr_good_practice_feedbacks enable row level security;

revoke all on public.hr_good_practice_feedbacks from anon;
grant select on public.hr_good_practice_feedbacks to authenticated;
grant select, insert, update, delete on public.hr_good_practice_feedbacks to service_role;

drop policy if exists "hr reads good practice feedbacks" on public.hr_good_practice_feedbacks;
create policy "hr reads good practice feedbacks"
on public.hr_good_practice_feedbacks for select to authenticated
using ((select public.has_hr_access()));
