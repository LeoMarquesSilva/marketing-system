-- Vistagem e agendamento: captura diária da Kurier.
-- O Power Automate salva o xlsx do dia no SharePoint; o Orquestra importa o
-- arquivo (vistagem_kurier_arquivos) e cada linha vira uma publicação
-- (vistagem_publicacoes). Duplicidades ficam gravadas e apontam para a
-- publicação principal, para conferência na aba Duplicidades.
-- Acesso somente pelo servidor (service_role), via rotas de Operações Legais.

-- ---------------------------------------------------------------------------
-- Arquivos recebidos da Kurier
-- ---------------------------------------------------------------------------

create table if not exists public.vistagem_kurier_arquivos (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null,
  data_arquivo date not null,
  lote integer not null default 1,
  sha256 text not null unique,
  sharepoint_item_id text unique,
  storage_path text,
  origem text not null check (origem in ('sharepoint', 'upload')),
  status text not null default 'processando'
    check (status in ('processando', 'processado', 'erro')),
  erro text,
  total_linhas integer not null default 0,
  total_captadas integer not null default 0,
  total_duplicidades integer not null default 0,
  total_descartadas integer not null default 0,
  enviado_por uuid references auth.users(id) on delete set null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vistagem_kurier_arquivos_data_idx
  on public.vistagem_kurier_arquivos (data_arquivo desc, lote);

drop trigger if exists vistagem_kurier_arquivos_set_updated_at on public.vistagem_kurier_arquivos;
create trigger vistagem_kurier_arquivos_set_updated_at
before update on public.vistagem_kurier_arquivos
for each row execute function public.set_updated_at();

comment on table public.vistagem_kurier_arquivos is
  'Cada xlsx diário da Kurier importado (SharePoint ou envio manual). sha256 impede importar o mesmo arquivo duas vezes.';

-- ---------------------------------------------------------------------------
-- Publicações
-- ---------------------------------------------------------------------------

create table if not exists public.vistagem_publicacoes (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'kurier'
    check (origem in ('kurier', 'push', 'email', 'manual')),
  kurier_arquivo_id uuid references public.vistagem_kurier_arquivos(id) on delete cascade,
  linha_arquivo integer,

  data_divulgacao date,
  data_publicacao date,
  numero_processo_original text not null default '',
  numero_processo text,
  processo_digitos text,
  processo_sufixo text,
  estado text,
  diario text,
  tribunal text,
  justica text check (justica in ('estadual', 'trabalhista', 'federal', 'superior')),
  nome_localizado text,
  caderno text,
  comarca text,
  titulo text,
  teor text not null,

  djen_id_comunicacao bigint,
  djen_orgao text,
  djen_tipo_comunicacao text,
  djen_intimados text[] not null default '{}',
  djen_partes jsonb not null default '[]'::jsonb,
  djen_advogados jsonb not null default '[]'::jsonb,

  chave_decisao text,
  status text not null default 'captada' check (status in (
    'captada', 'duplicidade', 'descartada', 'juridico_vistar', 'controladoria_vistar',
    'pronto_para_agendar', 'agendado', 'checado', 'revisar'
  )),
  motivo_descarte text,

  duplicidade_de uuid references public.vistagem_publicacoes(id) on delete set null,
  duplicidade_resultado text check (duplicidade_resultado in ('confirmada', 'nao_duplicidade')),
  duplicidade_revisada_por uuid references auth.users(id) on delete set null,
  duplicidade_revisada_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kurier_arquivo_id, linha_arquivo)
);

create index if not exists vistagem_publicacoes_status_data_idx
  on public.vistagem_publicacoes (status, data_publicacao desc);
create index if not exists vistagem_publicacoes_processo_idx
  on public.vistagem_publicacoes (processo_digitos);
create index if not exists vistagem_publicacoes_chave_idx
  on public.vistagem_publicacoes (chave_decisao);
create index if not exists vistagem_publicacoes_duplicidade_idx
  on public.vistagem_publicacoes (duplicidade_de);
create index if not exists vistagem_publicacoes_arquivo_idx
  on public.vistagem_publicacoes (kurier_arquivo_id, linha_arquivo);

drop trigger if exists vistagem_publicacoes_set_updated_at on public.vistagem_publicacoes;
create trigger vistagem_publicacoes_set_updated_at
before update on public.vistagem_publicacoes
for each row execute function public.set_updated_at();

comment on table public.vistagem_publicacoes is
  'Publicações do fluxo de vistagem. Na captura: captada, duplicidade (aponta para a principal em duplicidade_de) ou descartada.';
comment on column public.vistagem_publicacoes.chave_decisao is
  'Hash do despacho (CNJ + órgão + data + texto sem nomes das partes). Mesma chave = mesma publicação enviada mais de uma vez.';
comment on column public.vistagem_publicacoes.djen_id_comunicacao is
  'ID COMUNICAÇÃO do DJEN; usado depois para localizar a intimação no VIOS.';

-- ---------------------------------------------------------------------------
-- Acesso: somente service_role (rotas do servidor)
-- ---------------------------------------------------------------------------

alter table public.vistagem_kurier_arquivos enable row level security;
alter table public.vistagem_publicacoes enable row level security;

revoke all on public.vistagem_kurier_arquivos from anon, authenticated;
revoke all on public.vistagem_publicacoes from anon, authenticated;
grant select, insert, update, delete on public.vistagem_kurier_arquivos to service_role;
grant select, insert, update, delete on public.vistagem_publicacoes to service_role;

-- ---------------------------------------------------------------------------
-- Bucket privado com os arquivos originais da Kurier
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vistagem-kurier',
  'vistagem-kurier',
  false,
  52428800,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
