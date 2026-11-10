-- Processos: cadastro de opções dos campos de escolha (o equivalente aos "Cadastros" do VIOS).
--
-- Cada campo de lista do cadastro de processo (justiça, área, fase, comarca, órgão julgador, tipo de parte…)
-- passa a ter as opções aqui. A carga inicial veio dos cadastros do VIOS (origem 'vios', com o código de lá);
-- depois a equipe inclui, corrige e desativa opções na tela de Cadastros (origem 'manual').
--
-- Acesso: RLS ligado e sem policy, como as outras tabelas proc_*.

create table if not exists public.proc_opcoes (
  id uuid primary key default gen_random_uuid(),
  lista text not null,
  valor text not null,
  -- Identidade da opção na lista: o valor sem caixa nem acento e, quando o nome se repete (comarca e cidade
  -- com o mesmo nome em estados diferentes), a UF.
  chave text not null,
  vios_ci text,
  extra jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  origem text not null default 'manual' check (origem in ('vios', 'manual')),
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proc_opcoes_lista_chave_unica unique (lista, chave)
);

create index if not exists proc_opcoes_lista_idx on public.proc_opcoes (lista, ativo, ordem);

drop trigger if exists proc_opcoes_set_updated_at on public.proc_opcoes;
create trigger proc_opcoes_set_updated_at
before update on public.proc_opcoes
for each row execute function public.set_updated_at();

comment on table public.proc_opcoes is
  'Opções dos campos de escolha do cadastro de processos (Cadastros). Carga inicial dos cadastros do VIOS; depois mantidas aqui.';
comment on column public.proc_opcoes.lista is 'Campo a que a lista serve: justica, area, fase, comarca_tribunal, cidade, tipo_parte…';
comment on column public.proc_opcoes.extra is 'Dados que ajudam a filtrar: uf, cidade, justiça, jurisdição, polo do tipo de parte, código IBGE.';
comment on column public.proc_opcoes.ativo is 'Desativada: some da escolha, mas os processos que já a usam continuam com ela.';

alter table public.proc_opcoes enable row level security;
revoke all on public.proc_opcoes from anon, authenticated;
grant select, insert, update, delete on public.proc_opcoes to service_role;
