-- Processos: cadastro de processos do ORQESTRAI (primeiro módulo do sistema que substitui o VIOS).
-- Começa pela Recuperação de Crédito, com o Grupo PST como piloto.
--
-- Os campos que já existem no VIOS chegam por sincronização (relatório "Processos Lista" + SIOE) e
-- podem ser editados aqui; cada edição entra em proc_vios_envios, a fila de gravação de volta no VIOS.
-- Os campos novos (crédito, contatos do executado, sócios, fiadores) só existem aqui.
--
-- Acesso: RLS ligado e sem policy. Tudo passa pelas rotas /api/operacoes-legais/processos, que conferem
-- o acesso a Operações Legais e usam a service role.

create table if not exists public.proc_processos (
  id uuid primary key default gen_random_uuid(),
  ci text unique,
  origem text not null default 'vios' check (origem in ('vios', 'orquestrai')),

  -- Identificação
  cnj text,
  cnj_digitos text generated always as (nullif(regexp_replace(coalesce(cnj, ''), '\D', '', 'g'), '')) stored,
  outros_numeros text[] not null default '{}',
  pasta_interna text,
  vinculo text,

  -- Classificação
  departamento text,
  area text,
  materia text,
  acao text,
  fase text,
  situacao text,
  etiquetas text[] not null default '{}',
  jurisdicao_atual text,

  -- Responsáveis
  advogado_responsavel text,
  auxiliares text[] not null default '{}',

  -- Cliente
  grupo_cliente text,
  cliente text,
  polo_cliente text,
  contrato_cliente text,

  -- Partes como estão no VIOS (só os nomes, para busca e lista); documento, contatos e advogados ficam em proc_partes
  parte_ativa text,
  parte_passiva text,
  terceiros text,

  -- Órgão
  justica text,
  sistema_tribunal text,
  uf text,
  cidade text,
  comarca_tribunal text,
  orgao_julgador text,
  tipo_orgao_julgador text,
  magistrado text,

  -- Datas
  data_recebimento date,
  data_cadastro date,
  data_distribuicao date,
  data_citacao date,
  data_arquivamento date,
  data_encerramento date,
  motivo_encerramento text,

  -- Valores e risco
  valor_acao numeric(16, 2),
  valor_acao_atualizado numeric(16, 2),
  valor_envolvido numeric(16, 2),
  valor_provisionado numeric(16, 2),
  valor_risco numeric(16, 2),
  percentual_risco numeric(6, 2),
  probabilidade text,
  grau_risco text,
  parecer_risco text,
  beneficio_economico numeric(16, 2),
  complexidade text,
  impacto text,
  honorarios_sucumbencia numeric(16, 2),

  -- Outros
  processo_eletronico boolean,
  segredo_justica boolean,
  exibir_cliente boolean,
  objeto text,
  sintese text,
  ultimo_andamento_texto text,
  ultimo_andamento_data date,

  -- Saneamento: itens da lista da equipe marcados como "não se aplica" neste processo
  itens_nao_aplicaveis text[] not null default '{}',

  -- Sincronização com o VIOS
  vios_editado_em text,
  sincronizado_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proc_processos_cnj_digitos_idx on public.proc_processos (cnj_digitos);
create index if not exists proc_processos_grupo_idx on public.proc_processos (grupo_cliente);
create index if not exists proc_processos_area_idx on public.proc_processos (area);

drop trigger if exists proc_processos_set_updated_at on public.proc_processos;
create trigger proc_processos_set_updated_at
before update on public.proc_processos
for each row execute function public.set_updated_at();

comment on table public.proc_processos is
  'Cadastro de processos (uma linha por pasta). Campos do VIOS chegam por sincronização; os demais são do ORQESTRAI.';
comment on column public.proc_processos.ci is 'CI da pasta no VIOS. Nulo só em processo criado direto no ORQESTRAI.';
comment on column public.proc_processos.itens_nao_aplicaveis is
  'Chaves dos itens do saneamento que não se aplicam a este processo (ex.: não há fiador).';

-- Campos só da Recuperação de Crédito, 1:1 com o processo.
create table if not exists public.proc_credito (
  processo_id uuid primary key references public.proc_processos(id) on delete cascade,
  contrato_credito text,
  valor_original numeric(16, 2),
  data_origem_debito date,
  natureza_credito text check (natureza_credito is null or natureza_credito in ('concursal', 'extraconcursal', 'nao_se_aplica')),
  data_acordo date,
  valor_acordo numeric(16, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists proc_credito_set_updated_at on public.proc_credito;
create trigger proc_credito_set_updated_at
before update on public.proc_credito
for each row execute function public.set_updated_at();

comment on table public.proc_credito is
  'Dados do crédito em cobrança (Recuperação de Crédito): contrato, valor e data de origem, natureza e acordo.';

-- Pessoas ligadas aos processos (devedor, sócio, fiador, advogado). A mesma pessoa serve a vários processos.
create table if not exists public.proc_pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  documento_digitos text generated always as (nullif(regexp_replace(coalesce(documento, ''), '\D', '', 'g'), '')) stored,
  oab text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proc_pessoas_documento_idx on public.proc_pessoas (documento_digitos);

drop trigger if exists proc_pessoas_set_updated_at on public.proc_pessoas;
create trigger proc_pessoas_set_updated_at
before update on public.proc_pessoas
for each row execute function public.set_updated_at();

comment on table public.proc_pessoas is
  'Pessoa física ou jurídica que aparece em processos: parte, representante, sócio, fiador ou advogado.';

create table if not exists public.proc_partes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  pessoa_id uuid not null references public.proc_pessoas(id) on delete cascade,
  polo text not null check (polo in ('ativo', 'passivo', 'terceiro')),
  papel text not null default 'parte'
    check (papel in ('parte', 'representante', 'socio', 'administrador', 'corresponsavel', 'fiador', 'avalista', 'advogado')),
  vinculo text,
  devedor boolean not null default false,
  referente_a uuid references public.proc_partes(id) on delete set null,
  origem text not null default 'manual' check (origem in ('manual', 'vios', 'ia')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proc_partes_processo_idx on public.proc_partes (processo_id);
create index if not exists proc_partes_pessoa_idx on public.proc_partes (pessoa_id);

drop trigger if exists proc_partes_set_updated_at on public.proc_partes;
create trigger proc_partes_set_updated_at
before update on public.proc_partes
for each row execute function public.set_updated_at();

comment on table public.proc_partes is
  'Quem participa de cada processo, em que polo e com que papel. referente_a liga sócio, fiador ou advogado à parte.';
comment on column public.proc_partes.vinculo is 'Tipo de parte como está no VIOS (Exequente, Requerido…) ou o vínculo informado (sócio, fiador…).';
comment on column public.proc_partes.devedor is 'É o devedor/executado do crédito: o saneamento cobra endereços, contatos e advogado desta parte.';

create table if not exists public.proc_pessoa_enderecos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.proc_pessoas(id) on delete cascade,
  endereco text not null,
  cidade text,
  uf text,
  cep text,
  observacao text,
  origem text not null default 'manual' check (origem in ('manual', 'vios', 'ia')),
  created_at timestamptz not null default now()
);

create index if not exists proc_pessoa_enderecos_pessoa_idx on public.proc_pessoa_enderecos (pessoa_id);

comment on table public.proc_pessoa_enderecos is 'Endereços identificados de cada pessoa (todos, não só o atual).';

create table if not exists public.proc_pessoa_contatos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.proc_pessoas(id) on delete cascade,
  tipo text not null check (tipo in ('celular', 'telefone', 'email', 'site')),
  valor text not null,
  whatsapp boolean not null default false,
  observacao text,
  origem text not null default 'manual' check (origem in ('manual', 'vios', 'ia')),
  created_at timestamptz not null default now()
);

create index if not exists proc_pessoa_contatos_pessoa_idx on public.proc_pessoa_contatos (pessoa_id);

comment on table public.proc_pessoa_contatos is 'Celular, telefone, e-mail e site de cada pessoa, com a marca de WhatsApp.';

-- Histórico: uma linha por campo alterado.
create table if not exists public.proc_alteracoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  origem text not null check (origem in ('manual', 'vios', 'ia')),
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text,
  criado_em timestamptz not null default now()
);

create index if not exists proc_alteracoes_processo_idx on public.proc_alteracoes (processo_id, criado_em desc);

comment on table public.proc_alteracoes is
  'Histórico do cadastro: campo, valor anterior e novo, quem alterou e de onde veio (tela, VIOS ou IA).';

-- Fila de gravação no VIOS: no máximo um envio em aberto por campo de cada processo.
create table if not exists public.proc_vios_envios (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  ci text,
  campo text not null,
  valor_vios text,
  valor_novo text,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'confirmado', 'erro', 'cancelado')),
  simulado boolean not null default true,
  erro text,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  enviado_em timestamptz,
  confirmado_em timestamptz
);

create unique index if not exists proc_vios_envios_aberto_idx
  on public.proc_vios_envios (processo_id, campo)
  where status in ('pendente', 'enviado', 'erro');
create index if not exists proc_vios_envios_status_idx on public.proc_vios_envios (status, criado_em);

comment on table public.proc_vios_envios is
  'Edições de campos do VIOS feitas no ORQESTRAI, à espera de gravação no VIOS pelo robô. simulado = não grava de verdade.';
comment on column public.proc_vios_envios.valor_vios is 'Valor que estava no VIOS quando a edição foi feita.';

-- Registro de cada importação (sincronização diária ou CSV enviado na tela).
create table if not exists public.proc_sync_execucoes (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('sharepoint', 'csv')),
  status text not null default 'ok' check (status in ('ok', 'erro')),
  arquivo text,
  lidos integer not null default 0,
  no_recorte integer not null default 0,
  criados integer not null default 0,
  atualizados integer not null default 0,
  confirmados integer not null default 0,
  colunas_ignoradas text[] not null default '{}',
  erro text,
  executado_por uuid references auth.users(id) on delete set null,
  executado_por_nome text,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index if not exists proc_sync_execucoes_iniciado_idx on public.proc_sync_execucoes (iniciado_em desc);

comment on table public.proc_sync_execucoes is
  'Cada importação de processos do VIOS: quantos lidos, criados e atualizados, e as colunas que o importador não conhece.';

alter table public.proc_processos enable row level security;
alter table public.proc_credito enable row level security;
alter table public.proc_pessoas enable row level security;
alter table public.proc_partes enable row level security;
alter table public.proc_pessoa_enderecos enable row level security;
alter table public.proc_pessoa_contatos enable row level security;
alter table public.proc_alteracoes enable row level security;
alter table public.proc_vios_envios enable row level security;
alter table public.proc_sync_execucoes enable row level security;

revoke all on
  public.proc_processos, public.proc_credito, public.proc_pessoas, public.proc_partes,
  public.proc_pessoa_enderecos, public.proc_pessoa_contatos, public.proc_alteracoes,
  public.proc_vios_envios, public.proc_sync_execucoes
from anon, authenticated;

grant select, insert, update, delete on
  public.proc_processos, public.proc_credito, public.proc_pessoas, public.proc_partes,
  public.proc_pessoa_enderecos, public.proc_pessoa_contatos, public.proc_alteracoes,
  public.proc_vios_envios, public.proc_sync_execucoes
to service_role;
