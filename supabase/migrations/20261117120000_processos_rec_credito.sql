-- Processos: saneamento da carteira de Recuperação de Crédito.
--
-- Títulos executados (nota promissória, duplicata, CCB…) com o cálculo de atualização pela Tabela Prática do
-- TJSP; tentativas de citação (AR, oficial de justiça, edital) com o endereço; pedidos de execução e o que deles
-- resultou; lançamentos de dinheiro (guias pagas e valores levantados); próximos passos do processo; e os
-- índices mensais do TJSP usados no cálculo.
--
-- Os dados vêm da leitura dos autos (como sugestão, aprovada por uma pessoa) ou são lançados à mão na ficha.
-- `origem` diz qual dos dois; `documento_id` e `pagina` apontam de onde saiu, quando veio dos autos.
--
-- Acesso: RLS ligado e sem policy, como as outras tabelas proc_*.

-- Índices do TJSP, um por mês (primeiro dia do mês), importados da planilha oficial "Atualização Monetária e
-- Juros Moratórios", aba Índices: a Tabela Prática (Lei nº 14.905/2024) para a correção e a taxa legal do mês
-- ("Selic menos correção", em %) para os juros depois de 27/08/2024.
create table if not exists public.proc_indices_tjsp (
  mes date primary key,
  tabela_pratica numeric(24, 12) not null,
  taxa_legal numeric(12, 8),
  importado_em timestamptz not null default now(),
  constraint proc_indices_tjsp_primeiro_dia check (extract(day from mes) = 1)
);

comment on table public.proc_indices_tjsp is
  'Índices mensais do TJSP: Tabela Prática (Lei 14.905/2024) e taxa legal (Selic menos correção, % ao mês), da planilha oficial do tribunal.';

create table if not exists public.proc_titulos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  -- Lista "Tipo de título" em Cadastros: nota promissória, duplicata, CCB…
  tipo text not null,
  numero text,
  valor numeric(16, 2) not null check (valor > 0),
  vencimento date not null,
  origem text not null default 'manual' check (origem in ('manual', 'autos')),
  documento_id uuid references public.proc_documentos(id) on delete set null,
  pagina integer,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proc_titulos_processo_idx on public.proc_titulos (processo_id, vencimento);

comment on table public.proc_titulos is
  'Títulos executados no processo (Rec. Crédito): tipo, número, valor e vencimento. Base do cálculo de atualização.';

create table if not exists public.proc_citacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  endereco text,
  tentativa_em date,
  meio text not null default 'ar' check (meio in ('ar', 'oficial', 'edital', 'eletronica', 'outro')),
  resultado text not null default 'pendente' check (resultado in ('positiva', 'negativa', 'pendente')),
  observacao text,
  origem text not null default 'manual' check (origem in ('manual', 'autos')),
  documento_id uuid references public.proc_documentos(id) on delete set null,
  pagina integer,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proc_citacoes_processo_idx on public.proc_citacoes (processo_id, tentativa_em);

comment on table public.proc_citacoes is
  'Tentativas de citação do devedor (AR, oficial, edital): endereço já pleiteado, data e resultado positivo ou negativo.';

create table if not exists public.proc_pedidos_execucao (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  pedido_em date,
  -- SISBAJUD, RENAJUD, INFOJUD, penhora, pesquisa de bens, CNIB, SERASAJUD, protesto, outro…
  tipo text not null,
  descricao text,
  situacao text not null default 'requerido' check (situacao in ('requerido', 'deferido', 'indeferido', 'prejudicado')),
  decidido_em date,
  resultado text,
  valor_obtido numeric(16, 2),
  origem text not null default 'manual' check (origem in ('manual', 'autos')),
  documento_id uuid references public.proc_documentos(id) on delete set null,
  pagina integer,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proc_pedidos_execucao_processo_idx on public.proc_pedidos_execucao (processo_id, pedido_em);

comment on table public.proc_pedidos_execucao is
  'Passos do escritório na execução: o que foi pedido, se foi deferido e o resultado (valor bloqueado, bem achado, negativo).';

create table if not exists public.proc_lancamentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  -- guia_paga: custas e diligências pagas; levantamento: valor recebido (alvará, transferência, acordo pago).
  tipo text not null check (tipo in ('guia_paga', 'levantamento')),
  data date not null,
  valor numeric(16, 2) not null check (valor > 0),
  descricao text,
  origem text not null default 'manual' check (origem in ('manual', 'autos')),
  documento_id uuid references public.proc_documentos(id) on delete set null,
  pagina integer,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proc_lancamentos_processo_idx on public.proc_lancamentos (processo_id, tipo, data);

comment on table public.proc_lancamentos is
  'Dinheiro do processo: guias pagas (somadas na carteira) e valores levantados (o que já foi recuperado).';

alter table public.proc_credito add column if not exists proximos_passos text;
comment on column public.proc_credito.proximos_passos is 'Próximos passos do processo, na carteira de Rec. Crédito (sugerido pela leitura dos autos ou escrito pela equipe).';

do $$
declare
  tabela text;
begin
  foreach tabela in array array['proc_titulos', 'proc_citacoes', 'proc_pedidos_execucao', 'proc_lancamentos'] loop
    execute format('drop trigger if exists %1$s_set_updated_at on public.%1$s', tabela);
    execute format('create trigger %1$s_set_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', tabela);
  end loop;
  foreach tabela in array array['proc_indices_tjsp', 'proc_titulos', 'proc_citacoes', 'proc_pedidos_execucao', 'proc_lancamentos'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('revoke all on public.%I from anon, authenticated', tabela);
    execute format('grant select, insert, update, delete on public.%I to service_role', tabela);
  end loop;
end $$;

-- Lista "Tipo de título" em Cadastros, com os tipos pedidos pela equipe; dá para ampliar na tela de Cadastros.
insert into public.proc_opcoes (lista, valor, chave, origem, ordem)
values
  ('tipo_titulo', 'Nota promissória', 'nota promissoria', 'manual', 1),
  ('tipo_titulo', 'Duplicata', 'duplicata', 'manual', 2),
  ('tipo_titulo', 'CCB (Cédula de Crédito Bancário)', 'ccb (cedula de credito bancario)', 'manual', 3)
on conflict (lista, chave) do nothing;
