-- Serviços de infra externos (Cursor, N8N, RD CRM, etc.)
create table if not exists public.infra_services (
  slug text primary key,
  display_name text not null,
  provider text,
  logo_url text,
  category text,
  description text,
  billing_url text,
  monthly_amount_usd numeric(12, 4),
  monthly_amount_brl numeric(12, 2),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.infra_service_payments (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null references public.infra_services (slug) on delete cascade,
  period_month date not null,
  paid_at date,
  amount_usd numeric(12, 4),
  amount_brl numeric(12, 2) not null default 0,
  usd_brl_rate numeric(12, 6),
  description text not null default '',
  created_at timestamptz not null default now(),
  unique (service_slug, period_month, description)
);

create index if not exists infra_service_payments_slug_idx
  on public.infra_service_payments (service_slug, period_month desc);

alter table public.infra_services enable row level security;
alter table public.infra_service_payments enable row level security;

create policy "infra_services_select_authenticated"
  on public.infra_services for select to authenticated using (true);

create policy "infra_services_insert_authenticated"
  on public.infra_services for insert to authenticated with check (true);

create policy "infra_services_update_authenticated"
  on public.infra_services for update to authenticated using (true) with check (true);

create policy "infra_service_payments_select_authenticated"
  on public.infra_service_payments for select to authenticated using (true);

create policy "infra_service_payments_insert_authenticated"
  on public.infra_service_payments for insert to authenticated with check (true);

create policy "infra_service_payments_update_authenticated"
  on public.infra_service_payments for update to authenticated using (true) with check (true);

create policy "infra_service_payments_delete_authenticated"
  on public.infra_service_payments for delete to authenticated using (true);

insert into public.infra_services (slug, display_name, provider, category, description, billing_url, sort_order)
values
  (
    'cursor',
    'Cursor',
    'Cursor',
    'Desenvolvimento',
    'Assinatura do editor Cursor (IA para código).',
    'https://cursor.com/settings/billing',
    10
  ),
  (
    'n8n-vps',
    'N8N (VPS)',
    'VPS',
    'Automação',
    'Instância n8n self-hosted na VPS.',
    null,
    20
  ),
  (
    'rd-crm',
    'RD CRM',
    'RD Station',
    'CRM',
    'RD Station CRM — gestão comercial e marketing.',
    'https://app.rdstation.com.br/configuracoes/conta/faturamento',
    30
  )
on conflict (slug) do nothing;
