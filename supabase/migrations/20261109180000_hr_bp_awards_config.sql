-- BP Awards configurável pelo RH (aba Configurações do comitê).
--
-- area_hubs: de qual hub é cada área, por edição. Área fora do mapa fica fora
-- dos hubs (o departamento "Sócio" fica fora de propósito: sócios patrimoniais
-- votam nos três e não concorrem).
--
-- hr_award_participants: exceções por pessoa. Sem linha, vale a regra da área;
-- com linha, ela define o hub da pessoa, em quais hubs indica e se concorre.

alter table public.hr_award_editions
  add column if not exists area_hubs jsonb not null default '{}'::jsonb;

update public.hr_award_editions
set area_hubs = '{
  "Cível": "empresarial",
  "Trabalhista": "empresarial",
  "Contratos": "empresarial",
  "Recuperação de Crédito": "empresarial",
  "Tributário": "empresarial",
  "Reestruturação": "reestruturacao",
  "Operações Legais": "operacoes"
}'::jsonb
where area_hubs = '{}'::jsonb;

create table if not exists public.hr_award_participants (
  edition_id uuid not null references public.hr_award_editions(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  -- Hub a que a pessoa pertence (onde pode ser indicada); null = fora dos hubs.
  hub text check (hub in ('empresarial', 'reestruturacao', 'operacoes')),
  -- Hubs em que a pessoa indica; vazio = não vota.
  vote_hubs text[] not null default '{}'
    check (vote_hubs <@ array['empresarial', 'reestruturacao', 'operacoes']::text[]),
  can_compete boolean not null default false,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (edition_id, employee_id)
);

drop trigger if exists hr_award_participants_set_updated_at on public.hr_award_participants;
create trigger hr_award_participants_set_updated_at
before update on public.hr_award_participants
for each row execute function public.set_ferias_updated_at();

alter table public.hr_award_participants enable row level security;
revoke all on public.hr_award_participants from anon, authenticated;
grant select, insert, update, delete on public.hr_award_participants to service_role;
