-- Vistagem: inconsistências (devolução ao jurídico e erros de agendamento) e o
-- check final dos agendamentos pela controladoria.
-- Tipos e subtipos seguem os valores já usados na BKP (SIOE sp_publicacoes),
-- para os indicadores de eficiência continuarem comparáveis.

create table if not exists public.vistagem_inconsistencias (
  id uuid primary key default gen_random_uuid(),
  publicacao_id uuid not null references public.vistagem_publicacoes(id) on delete cascade,
  -- juridico: devolução da conferência; agendamento: erro encontrado no check
  origem text not null check (origem in ('juridico', 'agendamento')),
  tipo text not null,
  subtipo text,
  descricao text not null,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  -- contestação do jurídico (ex.: "a devolução estava errada")
  contestacao text,
  contestado_por uuid references auth.users(id) on delete set null,
  contestado_em timestamptz,
  -- exclusão pela controladoria: não conta nos indicadores
  excluida_em timestamptz,
  excluida_por uuid references auth.users(id) on delete set null,
  motivo_exclusao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vistagem_inconsistencias_publicacao_idx
  on public.vistagem_inconsistencias (publicacao_id, criado_em desc);
create index if not exists vistagem_inconsistencias_abertas_idx
  on public.vistagem_inconsistencias (criado_em desc)
  where excluida_em is null;

drop trigger if exists vistagem_inconsistencias_set_updated_at on public.vistagem_inconsistencias;
create trigger vistagem_inconsistencias_set_updated_at
before update on public.vistagem_inconsistencias
for each row execute function public.set_updated_at();

alter table public.vistagem_inconsistencias enable row level security;
revoke all on public.vistagem_inconsistencias from anon, authenticated;
grant select, insert, update, delete on public.vistagem_inconsistencias to service_role;

comment on table public.vistagem_inconsistencias is
  'Inconsistências da vistagem: do jurídico (devolução) e de agendamento (check). Excluídas não contam nos indicadores.';

alter table public.vistagem_publicacoes
  add column if not exists checado_por uuid references auth.users(id) on delete set null,
  add column if not exists checado_em timestamptz,
  add column if not exists check_nota text;

comment on column public.vistagem_publicacoes.check_nota is
  'Observação do check dos agendamentos (vai para o campo CHECK da BKP quando a gravação for ligada).';
