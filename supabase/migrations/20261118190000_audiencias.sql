-- Pauta de Audiências (Operações Legais): a pauta da área trabalhista sai do Excel e passa a ser
-- montada pelo tribunal (Minha Pauta do PJe, lida por um robô), conferida no DJEN e no VIOS.
-- Titular e backup vêm da dupla da pasta no VIOS; convites no Outlook e avisos no WhatsApp ficam
-- registrados aqui. Todo acesso passa pelas rotas da aplicação (service role): sem policy.

create or replace function public.aud_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Quem faz audiência: o nome como o VIOS escreve, ligado ao usuário do ORQESTRAI e ao WhatsApp.
create table if not exists public.aud_pessoas (
  id uuid primary key default gen_random_uuid(),
  nome_vios text not null,
  nome_curto text not null,
  sigla text,
  user_id uuid,
  email text,
  whatsapp text,
  cargo text,
  faz_audiencia boolean not null default true,
  coordenacao boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists aud_pessoas_nome_vios_idx on public.aud_pessoas (lower(nome_vios));
drop trigger if exists aud_pessoas_updated_at on public.aud_pessoas;
create trigger aud_pessoas_updated_at before update on public.aud_pessoas
  for each row execute function public.aud_set_updated_at();

-- Uma audiência como o tribunal (ou o VIOS) a registra. `chave` identifica o registro na origem
-- ("pje:TRT15:7652410", "vios:883412"). Redesignação no PJe = registro antigo cancelado + novo
-- designado: o novo aponta para o antigo em `substitui_id` e herda titular e backup.
create table if not exists public.aud_audiencias (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  origem text not null check (origem in ('pje', 'vios', 'manual')),
  tribunal text,
  cnj text not null,
  inicio timestamptz not null,
  fim timestamptz,
  tipo text not null,
  tipo_descricao text,
  rito_sumarissimo boolean not null default false,
  modalidade_tribunal text check (modalidade_tribunal in ('presencial', 'video', 'hibrida')),
  modalidade_equipe text check (modalidade_equipe in ('presencial', 'video')),
  orgao text,
  sala text,
  juizo_digital boolean,
  situacao text not null default 'designada' check (situacao in ('designada', 'cancelada', 'realizada')),
  link_sala text,
  link_fonte text check (link_fonte in ('pje', 'djen', 'manual')),
  link_fonte_data date,
  link_anterior text,
  cliente text,
  grupo_cliente text,
  ci_processo text,
  reclamante_iniciais text,
  titular_id uuid references public.aud_pessoas (id) on delete set null,
  backup_id uuid references public.aud_pessoas (id) on delete set null,
  substitui_id uuid references public.aud_audiencias (id) on delete set null,
  -- O que mudou no tribunal desde a última leitura: tipo, horario, vara, link, cancelada.
  mudancas text[] not null default '{}',
  mudanca_conferida_em timestamptz,
  mudanca_conferida_por text,
  -- Conferência com o VIOS (relatório de tarefas): data e hora que o VIOS tem.
  vios_tarefa_ci text,
  vios_inicio timestamptz,
  vios_situacao text,
  -- Conferência com o DJEN.
  djen_conferido_em timestamptz,
  djen_data date,
  djen_inicio timestamptz,
  djen_modalidade text,
  -- Completado pela equipe.
  correspondente text,
  observacao text,
  lida_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aud_audiencias_inicio_idx on public.aud_audiencias (inicio);
create index if not exists aud_audiencias_cnj_idx on public.aud_audiencias (cnj);
drop trigger if exists aud_audiencias_updated_at on public.aud_audiencias;
create trigger aud_audiencias_updated_at before update on public.aud_audiencias
  for each row execute function public.aud_set_updated_at();

-- Histórico de cada audiência: atribuição, troca, mudança no tribunal, conferência.
create table if not exists public.aud_historico (
  id uuid primary key default gen_random_uuid(),
  audiencia_id uuid not null references public.aud_audiencias (id) on delete cascade,
  acao text not null,
  de text,
  para text,
  motivo text,
  feito_por text,
  em timestamptz not null default now()
);
create index if not exists aud_historico_audiencia_idx on public.aud_historico (audiencia_id, em desc);

-- Cada leitura de fonte (PJe pelo robô, DJEN, relatório do VIOS).
create table if not exists public.aud_leituras (
  id uuid primary key default gen_random_uuid(),
  fonte text not null check (fonte in ('pje', 'djen', 'vios')),
  tribunal text,
  origem text,
  iniciada_em timestamptz not null default now(),
  terminada_em timestamptz,
  total integer not null default 0,
  novas integer not null default 0,
  alteradas integer not null default 0,
  canceladas integer not null default 0,
  erro text,
  detalhe jsonb
);
create index if not exists aud_leituras_fonte_idx on public.aud_leituras (fonte, iniciada_em desc);

-- Convites do Outlook: um por papel (titular, backup) em cada audiência.
create table if not exists public.aud_convites (
  id uuid primary key default gen_random_uuid(),
  audiencia_id uuid not null references public.aud_audiencias (id) on delete cascade,
  papel text not null check (papel in ('titular', 'backup')),
  pessoa_id uuid references public.aud_pessoas (id) on delete set null,
  graph_event_id text,
  versao text,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'simulado', 'cancelado', 'erro')),
  resposta text check (resposta in ('aceito', 'recusado', 'provisorio', 'sem_resposta')),
  erro text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audiencia_id, papel)
);
drop trigger if exists aud_convites_updated_at on public.aud_convites;
create trigger aud_convites_updated_at before update on public.aud_convites
  for each row execute function public.aud_set_updated_at();

-- Avisos no WhatsApp (e outros canais): `dedupe_key` impede mandar o mesmo aviso duas vezes.
create table if not exists public.aud_avisos (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  canal text not null default 'whatsapp',
  audiencia_id uuid references public.aud_audiencias (id) on delete set null,
  texto text not null,
  mencoes text[] not null default '{}',
  status text not null default 'simulado' check (status in ('simulado', 'enviado', 'erro', 'desligado')),
  erro text,
  criado_em timestamptz not null default now()
);

-- Configuração do módulo (duração por tipo, grupo do WhatsApp, horários dos avisos).
create table if not exists public.aud_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

alter table public.aud_pessoas enable row level security;
alter table public.aud_audiencias enable row level security;
alter table public.aud_historico enable row level security;
alter table public.aud_leituras enable row level security;
alter table public.aud_convites enable row level security;
alter table public.aud_avisos enable row level security;
alter table public.aud_config enable row level security;

revoke all on public.aud_pessoas, public.aud_audiencias, public.aud_historico, public.aud_leituras,
  public.aud_convites, public.aud_avisos, public.aud_config from anon, authenticated;
grant all on public.aud_pessoas, public.aud_audiencias, public.aud_historico, public.aud_leituras,
  public.aud_convites, public.aud_avisos, public.aud_config to service_role;
