-- Lead encaminhado para alguém da equipe (gestor, advogado da área) pelo
-- WhatsApp do escritório: o resumo e o cartão de contato do lead. Fica o
-- histórico de quem mandou, para quem e o texto enviado.
create table if not exists public.whatsapp_lead_forwards (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  recipient_user_id uuid references public.users(id) on delete set null,
  recipient_name text,
  recipient_phone text not null,
  message text not null,
  contact_sent boolean not null default false,
  sent_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_lead_forwards_conversation_idx
  on public.whatsapp_lead_forwards (conversation_id, created_at desc);

-- Sem policies: só as rotas do servidor (service role) leem e gravam.
alter table public.whatsapp_lead_forwards enable row level security;

comment on table public.whatsapp_lead_forwards is
  'Leads do WhatsApp encaminhados para a equipe pelo botão "Encaminhar" do atendimento.';
