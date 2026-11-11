-- Pessoas: proc_pessoas passa a ser o cadastro único de pessoas do ORQESTRAI (clientes, partes contrárias,
-- sócios, fiadores, advogados), usado por Processos e, depois, por contratos, cobrança e financeiro.
--
-- Na primeira carga de Processos cada parte ganhou a própria pessoa (277 registros para 140 nomes). Aqui
-- a pessoa ganha a identidade do VIOS (CI da pessoa, espelhado no SIOE), o que permite unificar as
-- repetidas e trazer CPF/CNPJ, categoria, grupo, endereço e contatos que o VIOS já tem.
--
-- Acesso: igual às demais proc_*, só pelas rotas com service role.

alter table public.proc_pessoas
  add column if not exists vios_ci text,
  add column if not exists tipo text check (tipo is null or tipo in ('fisica', 'juridica')),
  add column if not exists nome_fantasia text,
  add column if not exists categoria text,
  add column if not exists grupo_cliente text,
  add column if not exists etiquetas text[] not null default '{}',
  add column if not exists origem text not null default 'manual' check (origem in ('manual', 'vios', 'ia')),
  add column if not exists nome_chave text,
  add column if not exists vios_sincronizado_em timestamptz;

comment on column public.proc_pessoas.vios_ci is 'CI da pessoa no VIOS (Cadastros > Pessoas). Uma pessoa do VIOS corresponde a uma só aqui.';
comment on column public.proc_pessoas.categoria is 'Categoria no VIOS (Cliente ativo, Contrário ativo, Advogado contrário ativo…). Só leitura aqui.';
comment on column public.proc_pessoas.nome_chave is
  'Nome sem acento, caixa ou pontuação, mantido pelo servidor: serve à busca e a achar repetidas.';

-- Nome sem acento/caixa/pontuação para as pessoas que já existem (o servidor mantém daqui em diante).
update public.proc_pessoas
set nome_chave = trim(regexp_replace(
  translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
  '[^a-z0-9]+', ' ', 'g'))
where nome_chave is null;

-- As pessoas criadas pela carga de processos vieram do VIOS.
update public.proc_pessoas
set origem = 'vios'
where origem = 'manual'
  and id in (select pessoa_id from public.proc_partes where origem = 'vios');

create unique index if not exists proc_pessoas_vios_ci_idx on public.proc_pessoas (vios_ci) where vios_ci is not null;
create index if not exists proc_pessoas_nome_chave_idx on public.proc_pessoas (nome_chave);

-- Vínculos entre pessoas, independentes de processo: sócio de, administrador de, fiador de, advogado de.
create table if not exists public.proc_pessoa_vinculos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.proc_pessoas(id) on delete cascade,
  relacionada_id uuid not null references public.proc_pessoas(id) on delete cascade,
  tipo text not null check (tipo in ('representante', 'socio', 'administrador', 'corresponsavel', 'fiador', 'avalista', 'advogado', 'outro')),
  observacao text,
  origem text not null default 'manual' check (origem in ('manual', 'vios', 'ia')),
  created_at timestamptz not null default now(),
  constraint proc_pessoa_vinculos_distintas check (pessoa_id <> relacionada_id),
  constraint proc_pessoa_vinculos_unico unique (pessoa_id, relacionada_id, tipo)
);

create index if not exists proc_pessoa_vinculos_relacionada_idx on public.proc_pessoa_vinculos (relacionada_id);

comment on table public.proc_pessoa_vinculos is
  'Vínculo entre duas pessoas: pessoa_id é sócia, administradora, fiadora ou advogada de relacionada_id.';

-- Registro de cada unificação: quem foi absorvida por quem.
create table if not exists public.proc_pessoas_unificacoes (
  id uuid primary key default gen_random_uuid(),
  destino_id uuid not null references public.proc_pessoas(id) on delete cascade,
  origem_nome text not null,
  origem_documento text,
  origem_vios_ci text,
  partes_movidas integer not null default 0,
  automatica boolean not null default false,
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text,
  criado_em timestamptz not null default now()
);

create index if not exists proc_pessoas_unificacoes_destino_idx on public.proc_pessoas_unificacoes (destino_id);

comment on table public.proc_pessoas_unificacoes is
  'Histórico das unificações: a pessoa absorvida (nome, documento, CI do VIOS) e a que ficou.';

-- A carga de pessoas usa o mesmo registro de execuções da de processos.
alter table public.proc_sync_execucoes drop constraint if exists proc_sync_execucoes_origem_check;
alter table public.proc_sync_execucoes
  add constraint proc_sync_execucoes_origem_check check (origem in ('sharepoint', 'csv', 'pessoas'));

alter table public.proc_pessoa_vinculos enable row level security;
alter table public.proc_pessoas_unificacoes enable row level security;
revoke all on public.proc_pessoa_vinculos, public.proc_pessoas_unificacoes from anon, authenticated;
grant select, insert, update, delete on public.proc_pessoa_vinculos, public.proc_pessoas_unificacoes to service_role;
