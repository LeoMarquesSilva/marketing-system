-- Processos: linha do tempo do processo (andamentos).
--
-- Cada consulta ao DataJud guarda aqui todos os movimentos do processo (hoje a capa só usava o último). A mesma
-- linha do tempo vai receber os prazos e as providências da equipe quando esses módulos chegarem; por isso a
-- coluna `fonte` já prevê esses tipos.
--
-- Acesso: RLS ligado e sem policy, como as outras tabelas proc_*.

create table if not exists public.proc_andamentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  quando timestamptz not null,
  fonte text not null check (fonte in ('datajud', 'vios', 'manual', 'prazo', 'providencia')),
  titulo text not null,
  detalhe text,
  -- Instância no DataJud (G1, G2, JE, TR…), quando houver.
  grau text,
  -- Código do movimento na Tabela Processual Unificada do CNJ (DataJud).
  codigo integer,
  -- Identidade do andamento no processo: a mesma consulta repetida não duplica a linha do tempo.
  chave text not null,
  created_at timestamptz not null default now(),
  constraint proc_andamentos_chave_unica unique (processo_id, chave)
);

create index if not exists proc_andamentos_processo_idx on public.proc_andamentos (processo_id, quando desc);

comment on table public.proc_andamentos is
  'Linha do tempo do processo: movimentos do DataJud (e, nas próximas etapas, prazos e providências da equipe).';
comment on column public.proc_andamentos.fonte is 'datajud (movimento do tribunal), vios, manual, prazo, providencia.';

alter table public.proc_andamentos enable row level security;
revoke all on public.proc_andamentos from anon, authenticated;
grant select, insert, update, delete on public.proc_andamentos to service_role;
