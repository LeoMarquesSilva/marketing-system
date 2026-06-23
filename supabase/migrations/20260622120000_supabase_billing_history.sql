-- Histórico de faturas Supabase sincronizado (por projeto / org).
create table if not exists public.supabase_billing_history (
  id uuid primary key default gen_random_uuid(),
  org_slug text not null,
  invoice_id text not null,
  invoice_number text,
  project_ref text not null default '',
  project_name text,
  period_end timestamptz not null,
  amount_usd numeric(12, 4) not null default 0,
  usd_brl_rate numeric(12, 6),
  amount_brl numeric(12, 2),
  description text not null default '',
  status text not null default 'paid',
  synced_at timestamptz not null default now(),
  unique (org_slug, invoice_id, project_ref, description)
);

create index if not exists supabase_billing_history_org_period_idx
  on public.supabase_billing_history (org_slug, period_end desc);

create index if not exists supabase_billing_history_project_idx
  on public.supabase_billing_history (project_ref, period_end desc);

alter table public.supabase_billing_history enable row level security;

-- Leitura para usuários autenticados; escrita só via service role (API).
create policy "supabase_billing_history_select_authenticated"
  on public.supabase_billing_history
  for select
  to authenticated
  using (true);
