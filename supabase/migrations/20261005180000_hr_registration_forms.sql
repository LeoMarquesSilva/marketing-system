-- Fichas cadastrais de admissão (CLT, Estágio, Sócio de serviço).
--
-- A RH gera um link por pessoa; a pessoa responde sem login (ainda não existe
-- no VIOS). As respostas ficam aqui, travadas para a pessoa, até a RH corrigir
-- e aprovar. Quando o sync do VIOS cria o colaborador, a RH vincula a ficha à
-- linha de hr_employees (sugestão por nome/CPF, sempre confirmada por alguém).
--
-- Acesso: só service_role escreve. A página pública passa por rota de API que
-- valida o token; anon não enxerga a tabela.

create table if not exists public.hr_registration_forms (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  employment_kind text not null check (employment_kind in ('clt', 'estagio', 'socio_servico')),
  invitee_name text not null,
  invitee_personal_email text,
  invitee_phone text,
  expected_admission_date date,
  status text not null default 'pendente'
    check (status in ('pendente', 'recebida', 'aprovada', 'cancelada')),
  -- Respostas no formato da ficha (versionadas por `form_version`).
  answers jsonb not null default '{}'::jsonb,
  form_version integer not null default 1,
  expires_at timestamptz not null,
  -- Recado da RH quando devolve a ficha para a pessoa corrigir.
  reopen_note text,
  submitted_at timestamptz,
  submitted_ip_hash text,
  submitted_user_agent text,
  consent_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  employee_id uuid references public.hr_employees(id) on delete set null,
  linked_at timestamptz,
  linked_by uuid references public.users(id) on delete set null,
  -- Momento em que os dados foram copiados para a ficha do colaborador.
  applied_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_registration_forms_status_idx
  on public.hr_registration_forms (status, created_at desc);
create index if not exists hr_registration_forms_employee_idx
  on public.hr_registration_forms (employee_id);
create index if not exists hr_registration_forms_created_by_idx
  on public.hr_registration_forms (created_by);
create index if not exists hr_registration_forms_approved_by_idx
  on public.hr_registration_forms (approved_by);
create index if not exists hr_registration_forms_linked_by_idx
  on public.hr_registration_forms (linked_by);

-- Uma ficha ativa (não cancelada) por colaborador.
create unique index if not exists hr_registration_forms_employee_active_uidx
  on public.hr_registration_forms (employee_id)
  where employee_id is not null and status <> 'cancelada';

drop trigger if exists hr_registration_forms_set_updated_at on public.hr_registration_forms;
create trigger hr_registration_forms_set_updated_at
before update on public.hr_registration_forms
for each row execute function public.set_ferias_updated_at();

alter table public.hr_registration_forms enable row level security;

revoke all on public.hr_registration_forms from anon;
revoke insert, update, delete on public.hr_registration_forms from authenticated;
grant select on public.hr_registration_forms to authenticated;
grant select, insert, update, delete on public.hr_registration_forms to service_role;

create policy "hr reads registration forms"
on public.hr_registration_forms for select to authenticated
using (
  (select public.has_hr_access())
  or (select public.is_hr_notification_recipient())
);

comment on table public.hr_registration_forms is
  'Ficha cadastral de admissão respondida por link público; leitura só RH.';

-- Notificação de RH também para "ficha recebida" (ainda sem colaborador). -----

alter table public.hr_onboarding_notifications
  alter column employee_id drop not null;

alter table public.hr_onboarding_notifications
  add column if not exists registration_form_id uuid
    references public.hr_registration_forms(id) on delete cascade;

create index if not exists hr_onboarding_notifications_registration_form_idx
  on public.hr_onboarding_notifications (registration_form_id);

alter table public.hr_onboarding_notifications
  drop constraint if exists hr_onboarding_notifications_event_type_check;
alter table public.hr_onboarding_notifications
  add constraint hr_onboarding_notifications_event_type_check
  check (event_type in ('new_employee', 'status_changed', 'registration_submitted'));

alter table public.hr_onboarding_notifications
  drop constraint if exists hr_onboarding_notifications_target_check;
alter table public.hr_onboarding_notifications
  add constraint hr_onboarding_notifications_target_check
  check (
    (event_type = 'registration_submitted' and registration_form_id is not null)
    or (event_type <> 'registration_submitted' and employee_id is not null)
  );
