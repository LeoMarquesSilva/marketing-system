-- Mensagem apagada para todos pelo atendimento. A linha fica no banco, só sem o
-- conteúdo: a Evolution continua devolvendo o texto em findMessages, e sem a linha a
-- sincronização ao abrir a conversa inseriria a mensagem de novo.
alter table public.whatsapp_messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users (id) on delete set null;

comment on column public.whatsapp_messages.deleted_at is 'Quando a mensagem foi apagada para todos pelo painel.';
comment on column public.whatsapp_messages.deleted_by is 'Quem da equipe apagou (o número é compartilhado).';
