-- Vistagem do jurídico, conferência da controladoria e envio ao robô do SAMA.
-- O jurídico vincula à publicação uma ou mais tarefas do VIOS (lista travada do
-- catálogo do SAMA) com data, responsável, revisor e observação. A controladoria
-- valida (as tarefas vão para a fila vios_agendamentos do SAMA) ou devolve.

alter table public.vistagem_publicacoes
  add column if not exists vistado_por uuid references auth.users(id) on delete set null,
  add column if not exists vistado_em timestamptz,
  add column if not exists observacao_vistagem text,
  add column if not exists conferido_por uuid references auth.users(id) on delete set null,
  add column if not exists conferido_em timestamptz,
  add column if not exists devolucao_motivo text,
  add column if not exists devolvido_por uuid references auth.users(id) on delete set null,
  add column if not exists devolvido_em timestamptz,
  add column if not exists devolucoes integer not null default 0;

create table if not exists public.vistagem_agendamentos (
  id uuid primary key default gen_random_uuid(),
  publicacao_id uuid not null references public.vistagem_publicacoes(id) on delete cascade,
  ordem integer not null default 1,
  etiqueta text not null check (etiqueta in ('PRAZO', 'PROVIDENCIA')),
  tarefa text not null,
  tarefa_id text,
  data date not null,
  responsavel text not null,
  responsavel_id text,
  revisor text,
  revisor_id text,
  observacao text,
  -- envio ao robô (fila vios_agendamentos do SAMA)
  envio_status text not null default 'nao_enviado'
    check (envio_status in ('nao_enviado', 'pendente', 'enviado', 'processando', 'concluido', 'erro')),
  envio_simulado boolean,
  sama_agendamento_id uuid,
  vios_tarefa_id text,
  envio_erro text,
  enviado_em timestamptz,
  envio_atualizado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vistagem_agendamentos_publicacao_idx
  on public.vistagem_agendamentos (publicacao_id, ordem);
create index if not exists vistagem_agendamentos_envio_idx
  on public.vistagem_agendamentos (envio_status)
  where envio_status in ('pendente', 'enviado', 'processando');

drop trigger if exists vistagem_agendamentos_set_updated_at on public.vistagem_agendamentos;
create trigger vistagem_agendamentos_set_updated_at
before update on public.vistagem_agendamentos
for each row execute function public.set_updated_at();

alter table public.vistagem_agendamentos enable row level security;
revoke all on public.vistagem_agendamentos from anon, authenticated;
grant select, insert, update, delete on public.vistagem_agendamentos to service_role;

comment on table public.vistagem_agendamentos is
  'Tarefas do VIOS vinculadas pelo jurídico a cada publicação (lista travada do catálogo do SAMA) e o acompanhamento do envio ao robô.';
comment on column public.vistagem_agendamentos.data is
  'Data escolhida pelo vistador no calendário; vai para a tarefa no VIOS (data prevista = data limite).';
comment on column public.vistagem_agendamentos.envio_simulado is
  'true quando o robô só preencheu o formulário no VIOS sem gravar (modo simulação durante os testes).';
