-- GA4 Insights: cliques no botão do WhatsApp (já capturado pelo Enhanced
-- Measurement do GA4 como clique em link externo para wa.me).

alter table public.ga4_daily_metrics
  add column if not exists whatsapp_clicks integer not null default 0;
