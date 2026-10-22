-- Conta de pagamento de cada colaborador, extraída do banco em que o
-- escritório paga a folha (hoje, Santander). É a fonte mais confiável para o
-- bloco "Dados bancários" da ficha: preenche a ficha de quem ainda não enviou
-- e foi aplicada por cima do que estava declarado nas fichas existentes.
--
-- `previous_declared` guarda o que a pessoa tinha declarado na ficha antes da
-- importação sobrescrever (para a RH conferir/recuperar).
--
-- Dados bancários: só o service_role lê e escreve; a tela do RH passa pelo
-- servidor com a checagem de acesso de fichas cadastrais.

create table if not exists public.hr_employee_bank_accounts (
  employee_id uuid primary key references public.hr_employees(id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  agency text not null,
  account text not null,
  account_type text not null default 'CC',
  source text not null default 'folha_santander',
  source_file text,
  previous_declared jsonb,
  imported_at timestamptz not null default now(),
  imported_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists hr_employee_bank_accounts_imported_by_idx
  on public.hr_employee_bank_accounts (imported_by);

drop trigger if exists hr_employee_bank_accounts_set_updated_at on public.hr_employee_bank_accounts;
create trigger hr_employee_bank_accounts_set_updated_at
before update on public.hr_employee_bank_accounts
for each row execute function public.set_ferias_updated_at();

alter table public.hr_employee_bank_accounts enable row level security;

revoke all on public.hr_employee_bank_accounts from anon, authenticated;
grant select, insert, update, delete on public.hr_employee_bank_accounts to service_role;

comment on table public.hr_employee_bank_accounts is
  'Conta de pagamento do colaborador vinda da folha (banco pagador); só service_role.';
