-- Facilities > Fornecedores e contratos.
--
-- Cadastro único de fornecedores do escritório: o mesmo cadastro que a Gestão
-- de eventos já usava (event_suppliers), ampliado com CNPJ/CPF, razão social,
-- áreas atendidas e responsável interno. O nome da tabela fica o mesmo para
-- não quebrar orçamentos e vínculos dos eventos.
--
-- Ao redor dele:
--   supplier_services  — o que é contratado de cada fornecedor (linha de custo:
--                        valor, periodicidade, vencimento, área, forma de pagamento).
--                        Substitui as linhas da planilha FORNECEDORES.xlsx.
--   supplier_contracts — contratos com datas-chave: vigência, renovação
--                        automática, aviso prévio e reajuste.
--   supplier_documents — arquivos (contrato, aditivo, proposta, certidões,
--                        cartão CNPJ...) no bucket privado ou link do SharePoint
--                        enquanto o arquivo não é migrado.
--
-- As três tabelas novas só são lidas e gravadas pelo servidor (service role),
-- depois de conferir a permissão /facilities em users.permissions.

-- ------------------------------------------------------------ fornecedores

alter table public.event_suppliers
  add column if not exists legal_name text,
  add column if not exists document text,
  add column if not exists person_type text,
  add column if not exists areas text[] not null default '{}',
  add column if not exists responsible_user_id uuid references public.users(id) on delete set null,
  add column if not exists city text,
  add column if not exists source text not null default 'sistema';

alter table public.event_suppliers
  drop constraint if exists event_suppliers_document_digits,
  add constraint event_suppliers_document_digits
    check (document is null or document ~ '^(\d{11}|\d{14})$'),
  drop constraint if exists event_suppliers_person_type_check,
  add constraint event_suppliers_person_type_check
    check (person_type is null or person_type in ('pj', 'pf')),
  drop constraint if exists event_suppliers_source_check,
  add constraint event_suppliers_source_check
    check (source in ('sistema', 'planilha'));

-- Um CNPJ/CPF, um cadastro: evita o fornecedor duplicado (e o pagamento em dobro).
create unique index if not exists event_suppliers_document_key
  on public.event_suppliers (document) where document is not null;

comment on column public.event_suppliers.document is 'CNPJ (14) ou CPF (11), só dígitos.';
comment on column public.event_suppliers.areas is 'Áreas atendidas / centros de custo (Administrativo, Cível...).';

-- --------------------------------------------------- serviços contratados

create table if not exists public.supplier_services (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.event_suppliers(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  area text,
  shared_cost boolean not null default false,
  payer text,
  periodicity text not null default 'mensal'
    check (periodicity in ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'semanal', 'eventual')),
  due_day smallint check (due_day is null or due_day between 1 and 31),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  payment_method text
    check (payment_method is null or payment_method in ('boleto', 'pix', 'transferencia', 'debito_automatico', 'cartao', 'guia')),
  payment_details text,
  fiscal_document text
    check (fiscal_document is null or fiscal_document in ('nota_fiscal', 'recibo', 'fatura')),
  notes text,
  active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_services_supplier_idx on public.supplier_services (supplier_id);

comment on column public.supplier_services.shared_cost is 'Custo rateado entre as áreas (ex.: "rateio escritório").';
comment on column public.supplier_services.payer is 'Quem paga / CNPJ contratante (ex.: Bismarchi | Pires, Costa Loureiro).';

-- -------------------------------------------------------------- contratos

create table if not exists public.supplier_contracts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.event_suppliers(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  object text,
  status text not null default 'vigente'
    check (status in ('em_negociacao', 'vigente', 'encerrado')),
  formalization text not null default 'contrato_assinado'
    check (formalization in ('contrato_assinado', 'proposta_aceita', 'aceite_por_email', 'termo_de_adesao')),
  contracting_party text,
  start_date date,
  end_date date,
  auto_renew boolean not null default false,
  renewal_months smallint check (renewal_months is null or renewal_months between 1 and 120),
  notice_days smallint check (notice_days is null or notice_days between 0 and 365),
  adjustment_index text
    check (adjustment_index is null or adjustment_index in ('ipca', 'igpm', 'inpc', 'ivar', 'fixo', 'outro')),
  adjustment_month smallint check (adjustment_month is null or adjustment_month between 1 and 12),
  value numeric(12, 2) check (value is null or value >= 0),
  value_period text not null default 'mensal'
    check (value_period in ('mensal', 'anual', 'total')),
  responsible_user_id uuid references public.users(id) on delete set null,
  sharepoint_url text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists supplier_contracts_supplier_idx on public.supplier_contracts (supplier_id);
create index if not exists supplier_contracts_end_idx on public.supplier_contracts (end_date) where status = 'vigente';

comment on column public.supplier_contracts.end_date is 'Fim da vigência atual; null = prazo indeterminado.';
comment on column public.supplier_contracts.notice_days is 'Aviso prévio (dias antes do fim) para não renovar ou rescindir.';
comment on column public.supplier_contracts.adjustment_month is 'Mês-base do reajuste anual (1-12).';
comment on column public.supplier_contracts.sharepoint_url is 'Link do arquivo no SharePoint/OneDrive enquanto ele não sobe para o sistema.';

-- ------------------------------------------------------------- documentos

create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.event_suppliers(id) on delete cascade,
  contract_id uuid references public.supplier_contracts(id) on delete cascade,
  kind text not null default 'contrato'
    check (kind in ('contrato', 'aditivo', 'proposta', 'distrato', 'cartao_cnpj', 'certidao', 'alvara', 'seguro', 'outro')),
  title text,
  storage_path text unique,
  file_name text,
  content_type text,
  size_bytes bigint,
  external_url text,
  valid_until date,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create index if not exists supplier_documents_supplier_idx on public.supplier_documents (supplier_id);
create index if not exists supplier_documents_contract_idx on public.supplier_documents (contract_id);

comment on column public.supplier_documents.valid_until is 'Validade (certidões, alvará, seguro); vira alerta quando se aproxima.';

-- -------------------------------------------------------------- triggers

drop trigger if exists supplier_services_set_updated_at on public.supplier_services;
create trigger supplier_services_set_updated_at
before update on public.supplier_services
for each row execute function public.set_ferias_updated_at();

drop trigger if exists supplier_contracts_set_updated_at on public.supplier_contracts;
create trigger supplier_contracts_set_updated_at
before update on public.supplier_contracts
for each row execute function public.set_ferias_updated_at();

-- ------------------------------------------------------------------ acesso

alter table public.supplier_services enable row level security;
alter table public.supplier_contracts enable row level security;
alter table public.supplier_documents enable row level security;

revoke all on public.supplier_services from anon, authenticated;
revoke all on public.supplier_contracts from anon, authenticated;
revoke all on public.supplier_documents from anon, authenticated;
grant select, insert, update, delete on public.supplier_services to service_role;
grant select, insert, update, delete on public.supplier_contracts to service_role;
grant select, insert, update, delete on public.supplier_documents to service_role;

-- Bucket privado, sem policy para authenticated: upload e download só por URL
-- assinada que o servidor gera depois de conferir a permissão.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'FACILITIES-CONTRATOS',
  'FACILITIES-CONTRATOS',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.supplier_services is 'Facilities: o que é contratado de cada fornecedor (linha de custo recorrente ou eventual).';
comment on table public.supplier_contracts is 'Facilities: contratos de fornecedores com vigência, renovação, aviso prévio e reajuste.';
comment on table public.supplier_documents is 'Facilities: arquivos de fornecedores e contratos (bucket FACILITIES-CONTRATOS ou link do SharePoint).';
