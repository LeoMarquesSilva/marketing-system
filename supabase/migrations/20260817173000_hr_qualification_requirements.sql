-- Pendência obrigatória da qualificação jurídica.
-- O RH solicita por usuário; o AuthGuard bloqueia até a conclusão do formulário.

alter table public.users
  add column if not exists qualification_required_at timestamptz,
  add column if not exists qualification_completed_at timestamptz,
  add column if not exists qualification_requested_by uuid
    references public.users(id) on delete set null;

create index if not exists users_qualification_pending_idx
  on public.users(qualification_required_at, qualification_completed_at)
  where qualification_required_at is not null;

comment on column public.users.qualification_required_at is
  'Momento em que o RH tornou obrigatório o preenchimento da qualificação.';
comment on column public.users.qualification_completed_at is
  'Última conclusão válida da qualificação pelo próprio colaborador.';
comment on column public.users.qualification_requested_by is
  'Usuário do RH que gerou a pendência e o link interno.';
