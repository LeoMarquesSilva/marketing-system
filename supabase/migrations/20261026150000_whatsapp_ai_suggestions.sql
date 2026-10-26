-- Sugestões da IA no atendimento do WhatsApp. Guardadas para comparar com o que
-- foi enviado de fato e servir de base para a documentação de atendimento do
-- escritório (e, mais adiante, para automatizar respostas).
create table if not exists public.whatsapp_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  draft text,
  suggestion text not null,
  model text,
  messages_in_context integer,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_ai_suggestions_conversation_idx
  on public.whatsapp_ai_suggestions (conversation_id, created_at desc);

-- Sem policies: só as rotas do servidor (service role) leem e gravam.
alter table public.whatsapp_ai_suggestions enable row level security;

comment on table public.whatsapp_ai_suggestions is
  'Sugestões do botão "Sugerir resposta" no atendimento do WhatsApp, com o rascunho de quem pediu.';
