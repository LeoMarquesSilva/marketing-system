-- Faturas Cursor Pro+ (cadastro manual a partir dos PDFs)
update public.infra_services
set
  description = 'Plano Pro+ — US$ 60/mês. Renovação em 26 de junho de 2026.',
  billing_url = 'https://cursor.com/dashboard/billing',
  monthly_amount_usd = 60,
  monthly_amount_brl = 326.17,
  updated_at = now()
where slug = 'cursor';

insert into public.infra_service_payments (
  service_slug,
  period_month,
  paid_at,
  amount_usd,
  amount_brl,
  usd_brl_rate,
  description
)
values
  ('cursor', '2026-03-01', '2026-03-26', 60, 326.17, 5.4362, 'Fatura YKXMNZ8V-0001 — Cursor Pro Plus (26 mar – 26 abr/2026)'),
  ('cursor', '2026-04-01', '2026-04-26', 60, 326.17, 5.4362, 'Fatura YKXMNZ8V-0002 — Cursor Pro Plus (26 abr – 26 mai/2026)'),
  ('cursor', '2026-05-01', '2026-05-26', 60, 326.17, 5.4362, 'Fatura YKXMNZ8V-0003 — Cursor Pro Plus (26 mai – 26 jun/2026)')
on conflict (service_slug, period_month, description) do update
set
  paid_at = excluded.paid_at,
  amount_usd = excluded.amount_usd,
  amount_brl = excluded.amount_brl,
  usd_brl_rate = excluded.usd_brl_rate;
