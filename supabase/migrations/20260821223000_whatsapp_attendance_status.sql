-- WhatsApp: status de atendimento (fila de triagem), independente do funil de
-- vendas (pipeline_stage). Responde "quem ainda não foi respondido".

alter table public.whatsapp_conversations
  add column if not exists attendance_status text not null default 'nao_respondido',
  add column if not exists last_outbound_at timestamptz;

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_attendance_status_check;
alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_attendance_status_check
  check (attendance_status in ('nao_respondido', 'em_atendimento', 'aguardando_cliente', 'resolvido'));

create index if not exists whatsapp_conversations_attendance_status_idx
  on public.whatsapp_conversations (attendance_status);

-- Backfill: quem já tem mensagem enviada por nós (from_me) como a mais
-- recente entra em "aguardando_cliente"; o resto fica no default (não
-- respondido) — mais seguro do que assumir "resolvido" sem saber.
update public.whatsapp_conversations c
set attendance_status = 'aguardando_cliente',
    last_outbound_at = m.last_out
from (
  select conversation_id, max(message_timestamp) as last_out
  from public.whatsapp_messages
  where from_me = true
  group by conversation_id
) m
where m.conversation_id = c.id
  and (c.last_inbound_at is null or m.last_out >= c.last_inbound_at);

comment on column public.whatsapp_conversations.attendance_status is
  'Fila de triagem: nao_respondido | em_atendimento | aguardando_cliente | resolvido (independente do pipeline de vendas)';
comment on column public.whatsapp_conversations.last_outbound_at is
  'Timestamp da última mensagem enviada por nós (from_me) — usado pra derivar o status de atendimento';
