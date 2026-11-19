-- Processos: acordos e o cumprimento das parcelas, em qualquer processo.
--
-- `posicao` diz de que lado o cliente está: "recebe" (o devedor paga ao cliente, como na Rec. Crédito) ou "paga"
-- (o cliente paga, como num acordo trabalhista). Em Rec. Crédito, a parcela recebida e paga conta como valor
-- recuperado e é abatida no valor atualizado, sem lançar levantamento à parte.
--
-- A situação guardada é só a que uma pessoa (ou a leitura dos autos, aprovada) declara: vigente, descumprido ou
-- cancelado. "Cumprido" (todas as parcelas pagas) e "em atraso" (parcela vencida sem pagamento) são calculados.
--
-- Os dados vêm da leitura dos autos (sugestão aprovada por uma pessoa) ou são lançados à mão na ficha; `origem`,
-- `documento_id` e `pagina` dizem de onde saiu, como nos itens da Rec. Crédito.
--
-- Acesso: RLS ligado e sem policy, como as outras tabelas proc_*.

create table if not exists public.proc_acordos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  posicao text not null default 'recebe' check (posicao in ('recebe', 'paga')),
  celebrado_em date,
  homologado_em date,
  valor_total numeric(16, 2) not null check (valor_total > 0),
  -- Multa (cláusula penal) pelo atraso ou descumprimento, em %.
  multa_percentual numeric(6, 2) check (multa_percentual is null or (multa_percentual >= 0 and multa_percentual <= 100)),
  situacao text not null default 'vigente' check (situacao in ('vigente', 'descumprido', 'cancelado')),
  descumprido_em date,
  observacao text,
  origem text not null default 'manual' check (origem in ('manual', 'autos')),
  documento_id uuid references public.proc_documentos(id) on delete set null,
  pagina integer,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proc_acordos_processo_idx on public.proc_acordos (processo_id, created_at);

comment on table public.proc_acordos is
  'Acordos do processo: quem paga (posicao), datas, valor total, multa por atraso e a situação declarada (vigente, descumprido, cancelado).';

create table if not exists public.proc_acordo_parcelas (
  id uuid primary key default gen_random_uuid(),
  acordo_id uuid not null references public.proc_acordos(id) on delete cascade,
  processo_id uuid not null references public.proc_processos(id) on delete cascade,
  -- 0 = entrada; 1, 2, 3… = parcelas.
  numero integer not null check (numero >= 0),
  vencimento date not null,
  valor numeric(16, 2) not null check (valor > 0),
  pago_em date,
  valor_pago numeric(16, 2) check (valor_pago is null or valor_pago > 0),
  observacao text,
  origem text not null default 'manual' check (origem in ('manual', 'autos')),
  documento_id uuid references public.proc_documentos(id) on delete set null,
  pagina integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proc_acordo_parcelas_numero_unico unique (acordo_id, numero),
  constraint proc_acordo_parcelas_pagamento check ((pago_em is null) = (valor_pago is null))
);

create index if not exists proc_acordo_parcelas_processo_idx on public.proc_acordo_parcelas (processo_id, vencimento);

comment on table public.proc_acordo_parcelas is
  'Parcelas de cada acordo (0 = entrada): vencimento, valor e o pagamento (data e valor pago, preenchidos juntos).';

alter table public.proc_acordos enable row level security;
alter table public.proc_acordo_parcelas enable row level security;

-- A leitura dos autos também sugere acordos, pagamentos de parcela e descumprimentos: tipo "acordo", com `campo`
-- dizendo qual. Só alarga as listas aceitas; nada que já está gravado muda.
alter table public.proc_sugestoes drop constraint if exists proc_sugestoes_tipo_check;
alter table public.proc_sugestoes
  add constraint proc_sugestoes_tipo_check
  check (tipo in ('campo', 'parte_nova', 'parte_documento', 'parte_oab', 'parte_endereco', 'parte_contato', 'rec_credito', 'acordo'));

alter table public.proc_sugestoes drop constraint if exists proc_sugestoes_alvo;
alter table public.proc_sugestoes
  add constraint proc_sugestoes_alvo check (
    (tipo = 'campo' and campo is not null)
    or (tipo = 'parte_nova')
    or (tipo in ('parte_documento', 'parte_oab', 'parte_endereco', 'parte_contato') and parte_id is not null)
    or (tipo = 'rec_credito' and campo in ('titulo', 'citacao', 'pedido', 'lancamento'))
    or (tipo = 'acordo' and campo in ('acordo', 'pagamento', 'descumprimento'))
  );

comment on column public.proc_sugestoes.tipo is
  'campo: valor de um campo do cadastro. parte_nova: pessoa que não está no processo (sócio, fiador, advogado). parte_*: dado que falta numa parte já cadastrada. rec_credito: item da Rec. Crédito (campo = titulo, citacao, pedido ou lancamento). acordo: acordo, pagamento de parcela ou descumprimento lido nos autos (campo diz qual).';
