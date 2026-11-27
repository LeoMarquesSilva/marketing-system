-- Processos da área Trabalhista: saneamento próprio (contrato, afastamentos, pedidos por decisão, laudo e risco)
-- e o controle da negociação de acordo (e-mails ao advogado do reclamante, propostas e valor máximo do cliente).
-- Tudo só pela service role, depois do gate de Processos (como as demais proc_*).

-- 1:1 com o processo, como proc_credito. Entra no catálogo de campos (tabela "trabalhista").
create table if not exists public.proc_trabalhista (
  processo_id uuid primary key references public.proc_processos(id) on delete cascade,
  -- Contrato
  data_admissao date,
  data_termino date,
  tipo_termino text check (
    tipo_termino is null or tipo_termino in (
      'sem_justa_causa', 'pedido_demissao', 'justa_causa', 'rescisao_indireta', 'acordo_484a', 'termino_contrato', 'em_vigor', 'outro'
    )
  ),
  -- Na rescisão indireta (e em contrato em vigor com afastamento), o último dia de trabalho de fato.
  ultimo_dia_trabalhado date,
  cargo text,
  salario numeric(16, 2),
  -- Laudo pericial
  laudo_agente text check (laudo_agente is null or laudo_agente in ('insalubridade', 'periculosidade', 'ambos', 'nenhum')),
  laudo_grau text check (laudo_grau is null or laudo_grau in ('minimo', 'medio', 'maximo')),
  laudo_conclusao text,
  -- Decisões
  decisao_prevalece text check (decisao_prevalece is null or decisao_prevalece in ('sentenca', 'acordao', 'rr')),
  adicional_grau text check (adicional_grau is null or adicional_grau in ('minimo', 'medio', 'maximo')),
  adicional_base text check (adicional_base is null or adicional_base in ('salario_minimo', 'salario_contratual')),
  data_transito date,
  periodo_calculo_inicio date,
  periodo_calculo_fim date,
  -- Benefício econômico / risco (calculado pelo sistema ou digitado)
  risco_valor numeric(16, 2),
  risco_reflexos_percentual numeric(6, 2) check (risco_reflexos_percentual is null or (risco_reflexos_percentual >= 0 and risco_reflexos_percentual <= 100)),
  risco_reflexos numeric(16, 2),
  risco_total numeric(16, 2),
  observacoes_trabalhista text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists proc_trabalhista_set_updated_at on public.proc_trabalhista;
create trigger proc_trabalhista_set_updated_at
before update on public.proc_trabalhista
for each row execute function public.set_updated_at();

comment on table public.proc_trabalhista is
  'Dados trabalhistas do processo (1:1): contrato, laudo, decisão que prevalece, trânsito, período de cálculo e risco (valor, reflexos, total).';

-- Afastamentos pelo INSS: saem do período do adicional.
create table if not exists public.proc_trab_afastamentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  inicio date not null,
  -- Nulo: afastamento ainda em curso (vale até o fim do período de cálculo).
  fim date,
  especie text not null default 'auxilio_doenca' check (especie in ('auxilio_doenca', 'acidentario', 'outro')),
  observacao text,
  origem text not null default 'manual' check (origem in ('manual', 'autos')),
  documento_id uuid references public.proc_documentos(id) on delete set null,
  pagina integer,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proc_trab_afastamentos_periodo check (fim is null or fim >= inicio)
);

create index if not exists proc_trab_afastamentos_processo_idx on public.proc_trab_afastamentos (processo_id, inicio);

drop trigger if exists proc_trab_afastamentos_set_updated_at on public.proc_trab_afastamentos;
create trigger proc_trab_afastamentos_set_updated_at
before update on public.proc_trab_afastamentos
for each row execute function public.set_updated_at();

-- Pedidos da inicial e o resultado em cada decisão.
create table if not exists public.proc_trab_pedidos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  pedido text not null,
  valor_pedido numeric(16, 2) check (valor_pedido is null or valor_pedido >= 0),
  resultado_sentenca text check (resultado_sentenca is null or resultado_sentenca in ('deferido', 'em_parte', 'indeferido', 'nao_julgado')),
  resultado_acordao text check (resultado_acordao is null or resultado_acordao in ('deferido', 'em_parte', 'indeferido', 'nao_julgado')),
  resultado_rr text check (resultado_rr is null or resultado_rr in ('deferido', 'em_parte', 'indeferido', 'nao_julgado')),
  -- Limites da condenação: período, base, grau, reflexos deferidos.
  detalhe text,
  origem text not null default 'manual' check (origem in ('manual', 'autos')),
  documento_id uuid references public.proc_documentos(id) on delete set null,
  pagina integer,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proc_trab_pedidos_processo_idx on public.proc_trab_pedidos (processo_id, created_at);

drop trigger if exists proc_trab_pedidos_set_updated_at on public.proc_trab_pedidos;
create trigger proc_trab_pedidos_set_updated_at
before update on public.proc_trab_pedidos
for each row execute function public.set_updated_at();

-- Negociação de acordo (antes do acordo fechado, que vai para proc_acordos). Uma por processo.
create table if not exists public.proc_negociacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null unique references public.proc_processos(id) on delete cascade,
  status text not null default 'a_enviar' check (
    status in ('a_enviar', 'enviado', 'respondido', 'proposta_recebida', 'contraproposta', 'acordo_fechado', 'sem_interesse')
  ),
  enviado_em timestamptz,
  respondido_em timestamptz,
  proposta_valor numeric(16, 2) check (proposta_valor is null or proposta_valor > 0),
  proposta_condicoes text,
  contraproposta_valor numeric(16, 2) check (contraproposta_valor is null or contraproposta_valor > 0),
  contraproposta_condicoes text,
  acordo_valor numeric(16, 2) check (acordo_valor is null or acordo_valor > 0),
  acordo_condicoes text,
  valor_maximo_cliente numeric(16, 2) check (valor_maximo_cliente is null or valor_maximo_cliente >= 0),
  valor_maximo_em date,
  observacoes text,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists proc_negociacoes_set_updated_at on public.proc_negociacoes;
create trigger proc_negociacoes_set_updated_at
before update on public.proc_negociacoes
for each row execute function public.set_updated_at();

comment on table public.proc_negociacoes is
  'Tentativa de acordo de cada processo: status (a enviar … acordo fechado / sem interesse), propostas, contraproposta e o valor máximo indicado pelo cliente.';

create table if not exists public.proc_negociacao_eventos (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references public.proc_negociacoes(id) on delete cascade,
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  tipo text not null check (tipo in ('email_enviado', 'email_rascunho', 'status', 'proposta', 'contraproposta', 'acordo', 'valor_maximo', 'observacao', 'importacao')),
  descricao text not null,
  valor numeric(16, 2),
  -- E-mail: para quem, de que caixa, título e texto como saíram.
  para text[],
  remetente text,
  assunto text,
  corpo text,
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text,
  criado_em timestamptz not null default now()
);

create index if not exists proc_negociacao_eventos_processo_idx on public.proc_negociacao_eventos (processo_id, criado_em desc);

comment on table public.proc_negociacao_eventos is
  'Histórico da negociação: e-mails enviados (com destinatários, título e texto), mudanças de status, propostas e valor máximo.';

alter table public.proc_trabalhista enable row level security;
alter table public.proc_trab_afastamentos enable row level security;
alter table public.proc_trab_pedidos enable row level security;
alter table public.proc_negociacoes enable row level security;
alter table public.proc_negociacao_eventos enable row level security;

-- A leitura dos autos de processo trabalhista sugere afastamentos e pedidos: tipo "trabalhista", com `campo`
-- dizendo qual. Só alarga as listas aceitas; nada que já está gravado muda.
alter table public.proc_sugestoes drop constraint if exists proc_sugestoes_tipo_check;
alter table public.proc_sugestoes
  add constraint proc_sugestoes_tipo_check
  check (tipo in ('campo', 'parte_nova', 'parte_documento', 'parte_oab', 'parte_endereco', 'parte_contato', 'rec_credito', 'acordo', 'trabalhista'));

alter table public.proc_sugestoes drop constraint if exists proc_sugestoes_alvo;
alter table public.proc_sugestoes
  add constraint proc_sugestoes_alvo check (
    (tipo = 'campo' and campo is not null)
    or (tipo = 'parte_nova')
    or (tipo in ('parte_documento', 'parte_oab', 'parte_endereco', 'parte_contato') and parte_id is not null)
    or (tipo = 'rec_credito' and campo in ('titulo', 'citacao', 'pedido', 'lancamento'))
    or (tipo = 'acordo' and campo in ('acordo', 'pagamento', 'descumprimento'))
    or (tipo = 'trabalhista' and campo in ('afastamento', 'pedido'))
  );

comment on column public.proc_sugestoes.tipo is
  'campo: valor de um campo do cadastro. parte_nova: pessoa que não está no processo (sócio, fiador, advogado). parte_*: dado que falta numa parte já cadastrada. rec_credito: item da Rec. Crédito (campo = titulo, citacao, pedido ou lancamento). acordo: acordo, pagamento de parcela ou descumprimento lido nos autos (campo diz qual). trabalhista: afastamento pelo INSS ou pedido da inicial com o resultado nas decisões (campo diz qual).';
