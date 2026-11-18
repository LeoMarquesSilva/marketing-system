-- Processos, Etapa 2: autos e saneamento com sugestão de IA.
--
-- proc_autos_pedidos  fila do robô de download (um conector por sistema de tribunal).
-- proc_documentos     PDFs dos autos no bucket privado "processos-autos", baixados pelo robô ou anexados à mão.
-- proc_sugestoes      o que a IA leu nos autos e propõe para o cadastro. Nada é gravado sem uma pessoa aprovar.
--
-- Acesso: RLS ligado e sem policy, como nas outras tabelas proc_*. As telas passam pelas rotas
-- /api/operacoes-legais/processos e o robô pelas rotas /api/robos/autos (token próprio); as duas usam a service role.

create table if not exists public.proc_autos_pedidos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  cnj text not null,
  sistema text not null,
  tribunal text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'aguardando_pessoa', 'concluido', 'erro', 'cancelado')),
  motivo_espera text check (motivo_espera is null or motivo_espera in ('login', 'segundo_fator', 'captcha', 'segredo_justica')),
  erro text,
  segredo_liberado boolean not null default false,
  segredo_liberado_por uuid references auth.users(id) on delete set null,
  segredo_liberado_por_nome text,
  segredo_liberado_em timestamptz,
  tentativas integer not null default 0,
  robo text,
  pedido_por uuid references auth.users(id) on delete set null,
  pedido_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz
);

-- No máximo um pedido em aberto por processo.
create unique index if not exists proc_autos_pedidos_aberto_idx
  on public.proc_autos_pedidos (processo_id)
  where status in ('pendente', 'em_andamento', 'aguardando_pessoa');
create index if not exists proc_autos_pedidos_fila_idx on public.proc_autos_pedidos (status, criado_em);
create index if not exists proc_autos_pedidos_processo_idx on public.proc_autos_pedidos (processo_id, criado_em desc);

comment on table public.proc_autos_pedidos is
  'Fila do robô que baixa os autos no tribunal. O robô roda fora da Vercel e consome a fila pelas rotas /api/robos/autos.';
comment on column public.proc_autos_pedidos.sistema is 'Sistema do tribunal que atende o processo: esaj, pje, eproc, projudi…';
comment on column public.proc_autos_pedidos.motivo_espera is
  'Por que o robô parou à espera de uma pessoa: login, segundo fator, CAPTCHA (ele não contorna) ou segredo de justiça sem liberação.';
comment on column public.proc_autos_pedidos.segredo_liberado is
  'Uma pessoa liberou o download mesmo com o processo em segredo de justiça. Sem isso o robô não baixa.';

create table if not exists public.proc_documentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  nome text not null,
  storage_path text not null unique,
  tamanho_bytes bigint,
  paginas integer,
  origem text not null check (origem in ('robo', 'manual')),
  pedido_id uuid references public.proc_autos_pedidos(id) on delete set null,
  leitura_status text not null default 'pendente' check (leitura_status in ('pendente', 'lendo', 'lida', 'sem_texto', 'erro')),
  leitura_erro text,
  leitura_iniciada_em timestamptz,
  lido_em timestamptz,
  leitura_modelo text,
  leitura_custo_us numeric(10, 4),
  paginas_lidas integer,
  paginas_sem_texto integer,
  enviado_por uuid references auth.users(id) on delete set null,
  enviado_por_nome text,
  criado_em timestamptz not null default now()
);

create index if not exists proc_documentos_processo_idx on public.proc_documentos (processo_id, criado_em desc);

comment on table public.proc_documentos is
  'PDFs dos autos de cada processo, no bucket privado processos-autos. origem: robo (baixado do tribunal) ou manual (anexado na ficha).';
comment on column public.proc_documentos.leitura_status is
  'Leitura pela IA: pendente, lendo, lida, sem_texto (PDF só de imagem, sem camada de texto) ou erro.';
comment on column public.proc_documentos.paginas_sem_texto is 'Páginas sem camada de texto (digitalizadas): a IA não lê essas.';

create table if not exists public.proc_sugestoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  documento_id uuid references public.proc_documentos(id) on delete set null,
  tipo text not null check (tipo in ('campo', 'parte_nova', 'parte_documento', 'parte_oab', 'parte_endereco', 'parte_contato')),
  campo text,
  parte_id uuid references public.proc_partes(id) on delete cascade,
  item text not null,
  chave text not null,
  resumo text not null,
  valor jsonb not null,
  pagina integer,
  trecho text,
  trecho_conferido boolean not null default false,
  confianca text not null default 'media' check (confianca in ('alta', 'media', 'baixa')),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'aprovada', 'recusada')),
  valor_gravado jsonb,
  decidido_por uuid references auth.users(id) on delete set null,
  decidido_por_nome text,
  decidido_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint proc_sugestoes_alvo check (
    (tipo = 'campo' and campo is not null)
    or (tipo = 'parte_nova')
    or (tipo in ('parte_documento', 'parte_oab', 'parte_endereco', 'parte_contato') and parte_id is not null)
  )
);

-- A mesma proposta não volta numa releitura, nem depois de recusada.
create unique index if not exists proc_sugestoes_chave_idx on public.proc_sugestoes (processo_id, chave);
create index if not exists proc_sugestoes_processo_idx on public.proc_sugestoes (processo_id, situacao);

comment on table public.proc_sugestoes is
  'Propostas da IA a partir dos autos. Só viram cadastro quando uma pessoa aprova (com ou sem edição); a gravação entra no histórico com origem "ia".';
comment on column public.proc_sugestoes.tipo is
  'campo: valor de um campo do cadastro. parte_nova: pessoa que não está no processo (sócio, fiador, advogado). parte_*: dado que falta numa parte já cadastrada.';
comment on column public.proc_sugestoes.item is 'Item do saneamento a que a sugestão responde (chave de campo ou de item de partes).';
comment on column public.proc_sugestoes.chave is 'Identidade da proposta (tipo + alvo + valor normalizado), para não repetir.';
comment on column public.proc_sugestoes.trecho is 'Trecho dos autos de onde o valor saiu, na página indicada.';
comment on column public.proc_sugestoes.trecho_conferido is 'O trecho foi localizado no texto extraído do PDF (a página foi corrigida, se preciso).';
comment on column public.proc_sugestoes.valor_gravado is 'O que foi gravado ao aprovar (igual ao proposto ou editado pela pessoa).';

alter table public.proc_autos_pedidos enable row level security;
alter table public.proc_documentos enable row level security;
alter table public.proc_sugestoes enable row level security;

revoke all on public.proc_autos_pedidos, public.proc_documentos, public.proc_sugestoes from anon, authenticated;
grant select, insert, update, delete on public.proc_autos_pedidos, public.proc_documentos, public.proc_sugestoes to service_role;

-- Autos: bucket privado, só PDF. Upload por URL assinada criada na API; leitura por URL assinada de curta duração.
-- Sem policy em storage.objects para este bucket: só a service role alcança os arquivos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('processos-autos', 'processos-autos', false, 209715200, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
