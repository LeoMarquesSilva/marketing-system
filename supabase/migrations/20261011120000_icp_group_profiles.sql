-- ICP: porte (colaboradores) e logo de cada grupo de cliente, pela página pública da empresa
-- no LinkedIn. A faixa de colaboradores é a declarada pela empresa no LinkedIn ("51-200");
-- linkedin_members é quantas pessoas se vinculam à página. O logo fica no bucket
-- MARKETING-SYSTEM-PROJETOS, em icp-logos/. A carga é feita pelo script
-- scripts/icp-linkedin-sync.mjs, que roda na máquina local (o LinkedIn bloqueia servidores).
create table if not exists public.icp_group_profiles (
  grupo text primary key,
  status text not null check (status in ('found', 'not_found')),
  -- Quão seguro é que a página é da empresa do grupo.
  match_confidence text check (match_confidence in ('alta', 'media', 'baixa')),
  linkedin_url text,
  linkedin_name text,
  employee_range text,
  employee_min integer,
  employee_max integer,
  linkedin_members integer,
  industry text,
  headquarters text,
  website text,
  logo_path text,
  logo_source text check (logo_source in ('linkedin', 'site')),
  note text,
  fetched_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.icp_group_profiles enable row level security;
revoke all on public.icp_group_profiles from anon, authenticated;
grant select, insert, update, delete on public.icp_group_profiles to service_role;
