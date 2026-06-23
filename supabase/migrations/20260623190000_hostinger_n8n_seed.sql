-- Dados iniciais da VPS Hostinger (n8n / Easypanel) via API billing + VPS
update public.infra_services
set
  provider = 'Hostinger',
  description = 'Plano KVM 2 (mensal) · Renovação em 12 de julho de 2026 · Renovação automática ativa · srv752945.hstgr.cloud · running · IP 212.85.2.227',
  billing_url = 'https://hpanel.hostinger.com/billing/subscriptions',
  monthly_amount_brl = 89.99,
  updated_at = now()
where slug = 'n8n-vps';
