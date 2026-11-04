-- Modo de cada sugestão da IA no atendimento: medir depois o que a equipe usa.
alter table public.whatsapp_ai_suggestions
  add column if not exists mode text not null default 'suggest';

comment on column public.whatsapp_ai_suggestions.mode is
  'suggest = próxima mensagem; reply = responder só a mensagem escolhida; improve = melhorar o rascunho.';
