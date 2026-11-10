-- Facilities > Gestão de Fornecedores e Prestadores de Serviços + Manutenção.
--
-- Pedido do gestor de Facilities (10/11/2026):
-- 1. Três classificações para cada terceiro: tipo (fornecedor, prestador de
--    serviços ou ambos), categoria do terceiro (o que ele fornece) e natureza da
--    despesa (onde o dinheiro é aplicado — a coluna category, com a lista
--    enxuta do gestor).
-- 2. O valor pago vem do OPEX (financeiro): cada fornecedor do cadastro é ligado
--    ao(s) nome(s) dele no SIOE (opex_names). Os pagamentos chegam agregados por
--    mês e departamento em opex_supplier_payments, sincronizados pela Edge
--    Function opex-fornecedores-sync. O tipo do departamento (área jurídica x
--    indireto) diz se o custo é de uma área só ou rateado.
-- 3. Módulo de manutenção: ativos e instalações, plano de manutenção (o que,
--    por quem, com qual periodicidade e quando) e o histórico de execuções.
--
-- As tabelas novas só são lidas e gravadas pelo servidor (service role), depois
-- de conferir a permissão /facilities, como as de contratos.

-- ------------------------------------------------------------ terceiros

alter table public.event_suppliers
  add column if not exists party_type text,
  add column if not exists third_party_category text,
  add column if not exists opex_names text[] not null default '{}';

alter table public.event_suppliers
  drop constraint if exists event_suppliers_party_type_check,
  add constraint event_suppliers_party_type_check
    check (party_type is null or party_type in ('fornecedor', 'prestador', 'ambos'));

comment on column public.event_suppliers.party_type is 'Tipo de terceiro: fornecedor (produtos), prestador (serviços) ou ambos. Null = não informado.';
comment on column public.event_suppliers.third_party_category is 'Categoria do terceiro: o que ele fornece ou qual serviço presta (tecnologia, consultoria, facilities...).';
comment on column public.event_suppliers.category is 'Natureza da despesa (Facilities) ou categoria de evento (buffet, brindes...).';
comment on column public.event_suppliers.opex_names is 'Nomes do fornecedor no OPEX/SIOE (coluna cliente dos títulos a pagar); ligam o cadastro ao valor pago.';

create index if not exists event_suppliers_opex_names_idx on public.event_suppliers using gin (opex_names);

-- Natureza da despesa: a lista do gestor não tem Material de escritório, Móveis,
-- Gráfica nem Segurança. Papelaria entra em Copa e insumos (exemplo do gestor),
-- móveis e eletrodomésticos em Informática e equipamentos, o resto em Outros.
-- Fornecedores de eventos com categoria Segurança continuam com ela.
update public.event_suppliers set category = 'copa' where category = 'escritorio';
update public.event_suppliers set category = 'informatica' where category = 'mobiliario';
update public.event_suppliers set category = 'outros' where category = 'grafica';
update public.event_suppliers set category = 'outros'
  where category = 'seguranca' and not exists (
    select 1 from public.event_supplier_event_usage u where u.supplier_id = event_suppliers.id
  );

-- Categoria do terceiro a partir da natureza (regra fixa, sem adivinhar nome).
update public.event_suppliers set third_party_category = case category
    when 'imovel' then 'imoveis'
    when 'consumo' then 'utilidades'
    when 'tecnologia' then 'tecnologia'
    when 'informatica' then 'suprimentos'
    when 'limpeza' then 'facilities'
    when 'manutencao' then 'manutencao'
    when 'copa' then 'suprimentos'
    when 'beneficios' then 'beneficios'
    when 'servicos_profissionais' then 'consultoria'
    when 'transporte' then 'facilities'
    when 'outros' then null
    else 'eventos'
  end
  where third_party_category is null;

-- Tipo de terceiro: só onde a natureza deixa claro (serviço x produto).
update public.event_suppliers set party_type = case
    when category in ('imovel', 'informatica', 'copa', 'brindes') then 'fornecedor'
    when category in ('consumo', 'tecnologia', 'manutencao', 'beneficios', 'servicos_profissionais', 'transporte',
                      'buffet', 'catering', 'decoracao', 'fotografia', 'som_iluminacao', 'locacao', 'seguranca') then 'prestador'
    else null
  end
  where party_type is null;

-- Limpeza mistura quem presta o serviço e quem vende o produto: os que vendem
-- produto vieram da planilha como "material de limpeza".
update public.event_suppliers s set party_type = case
    when exists (
      select 1 from public.supplier_services v
      where v.supplier_id = s.id and v.description ilike '%material de limpeza%'
    ) then 'fornecedor'
    else 'prestador'
  end
  where s.category = 'limpeza';

-- UTI Computadores presta serviço de informática (contrato de manutenção).
update public.event_suppliers set party_type = 'prestador', third_party_category = 'tecnologia'
  where document = '40280434000107';

-- ------------------------------------------------------------ OPEX

create table if not exists public.opex_supplier_payments (
  fornecedor text not null,
  mes date not null,
  departamento text not null,
  departamento_tipo text,
  grupo_conta text not null,
  plano_contas text not null,
  valor_pago numeric(14, 2) not null,
  titulos integer not null default 0,
  synced_at timestamptz not null default now(),
  primary key (fornecedor, mes, departamento, grupo_conta, plano_contas)
);

create index if not exists opex_supplier_payments_mes_idx on public.opex_supplier_payments (mes);

comment on table public.opex_supplier_payments is
  'Pagamentos do OPEX (financeiro_parcelas_itens, tipo PAGAR) agregados por fornecedor, mês de pagamento, departamento e plano de contas. Sincronizado por opex-fornecedores-sync.';
comment on column public.opex_supplier_payments.departamento_tipo is 'Tipo no OPEX v2: area_juridica (custo direto de uma área), indireto (rateado), socio, conta_de_cliente...';

create table if not exists public.opex_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  period_start date,
  rows_written integer,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  error text,
  trigger text not null default 'manual'
);

-- ------------------------------------------------------------ manutenção

create table if not exists public.facility_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null default 'outros',
  location text,
  manufacturer text,
  model text,
  asset_tag text,
  installed_on date,
  warranty_until date,
  criticality text not null default 'media' check (criticality in ('alta', 'media', 'baixa')),
  notes text,
  active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.facility_assets is 'Facilities: equipamentos e instalações que recebem manutenção (ar-condicionado, elétrica, TI...).';
comment on column public.facility_assets.asset_tag is 'Número de patrimônio ou de série.';

create table if not exists public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.facility_assets(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  maintenance_type text not null default 'preventiva' check (maintenance_type in ('preventiva', 'corretiva')),
  periodicity text not null default 'mensal'
    check (periodicity in ('pontual', 'emergencial', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'personalizada')),
  custom_interval_days smallint check (custom_interval_days is null or custom_interval_days between 1 and 1095),
  supplier_id uuid references public.event_suppliers(id) on delete set null,
  contract_id uuid references public.supplier_contracts(id) on delete set null,
  responsible_user_id uuid references public.users(id) on delete set null,
  estimated_cost numeric(12, 2) check (estimated_cost is null or estimated_cost >= 0),
  last_done_on date,
  next_due_on date,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido')),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periodicity <> 'personalizada' or custom_interval_days is not null)
);

create index if not exists maintenance_plans_due_idx on public.maintenance_plans (next_due_on) where status = 'ativo';
create index if not exists maintenance_plans_asset_idx on public.maintenance_plans (asset_id);
create index if not exists maintenance_plans_supplier_idx on public.maintenance_plans (supplier_id);

comment on table public.maintenance_plans is 'Facilities: o que será feito, em qual ativo, por quem, com qual periodicidade e quando.';
comment on column public.maintenance_plans.status is 'ativo; pausado (fora do painel); concluido (pontual/emergencial já executada).';

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.maintenance_plans(id) on delete cascade,
  done_on date not null,
  cost numeric(12, 2) check (cost is null or cost >= 0),
  supplier_id uuid references public.event_suppliers(id) on delete set null,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_records_plan_idx on public.maintenance_records (plan_id, done_on desc);

create table if not exists public.maintenance_documents (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.maintenance_plans(id) on delete cascade,
  record_id uuid references public.maintenance_records(id) on delete cascade,
  kind text not null default 'laudo'
    check (kind in ('laudo', 'nota_fiscal', 'ordem_servico', 'certificado', 'pmoc', 'orcamento', 'outro')),
  title text,
  storage_path text unique,
  file_name text,
  content_type text,
  size_bytes bigint,
  external_url text,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create index if not exists maintenance_documents_plan_idx on public.maintenance_documents (plan_id);

drop trigger if exists facility_assets_set_updated_at on public.facility_assets;
create trigger facility_assets_set_updated_at
before update on public.facility_assets
for each row execute function public.set_ferias_updated_at();

drop trigger if exists maintenance_plans_set_updated_at on public.maintenance_plans;
create trigger maintenance_plans_set_updated_at
before update on public.maintenance_plans
for each row execute function public.set_ferias_updated_at();

-- ------------------------------------------------------------ acesso

alter table public.opex_supplier_payments enable row level security;
alter table public.opex_sync_runs enable row level security;
alter table public.facility_assets enable row level security;
alter table public.maintenance_plans enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.maintenance_documents enable row level security;

revoke all on public.opex_supplier_payments from anon, authenticated;
revoke all on public.opex_sync_runs from anon, authenticated;
revoke all on public.facility_assets from anon, authenticated;
revoke all on public.maintenance_plans from anon, authenticated;
revoke all on public.maintenance_records from anon, authenticated;
revoke all on public.maintenance_documents from anon, authenticated;

grant select, insert, update, delete on public.opex_supplier_payments to service_role;
grant select, insert, update, delete on public.opex_sync_runs to service_role;
grant select, insert, update, delete on public.facility_assets to service_role;
grant select, insert, update, delete on public.maintenance_plans to service_role;
grant select, insert, update, delete on public.maintenance_records to service_role;
grant select, insert, update, delete on public.maintenance_documents to service_role;
