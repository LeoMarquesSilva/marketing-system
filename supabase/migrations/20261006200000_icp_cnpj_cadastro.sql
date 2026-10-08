-- ICP: cadastro da Receita Federal (dados abertos via OpenCNPJ ou BrasilAPI) das empresas dos grupos de clientes.
-- Alimenta segmento (CNAE), região (sede) e porte cadastral do ICP. Os CNPJs vêm do
-- cadastro de pessoas do VIOS/SIOE; a rotina /api/cron/icp-cnpj-sync consulta os que
-- faltam e renova os antigos.
create table if not exists public.icp_cnpj_cadastro (
  cnpj text primary key check (cnpj ~ '^\d{14}$'),
  status text not null check (status in ('ok', 'not_found', 'error')),
  razao_social text,
  nome_fantasia text,
  situacao_cadastral text,
  data_inicio_atividade date,
  natureza_juridica text,
  porte text,
  capital_social numeric,
  matriz boolean,
  uf text,
  municipio text,
  cep text,
  cnae_principal text,
  cnae_descricao text,
  cnaes_secundarios jsonb not null default '[]'::jsonb,
  opcao_simples boolean,
  -- Sócios e administradores: só nome, qualificação e data de entrada (sem CPF).
  socios jsonb not null default '[]'::jsonb,
  source text not null default 'brasilapi',
  error text,
  fetched_at timestamptz not null default now()
);

create index if not exists icp_cnpj_cadastro_fetched_at_idx on public.icp_cnpj_cadastro (fetched_at);

alter table public.icp_cnpj_cadastro enable row level security;
revoke all on public.icp_cnpj_cadastro from anon, authenticated;
grant select, insert, update, delete on public.icp_cnpj_cadastro to service_role;
