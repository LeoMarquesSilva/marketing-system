-- A controladoria ajusta data e responsáveis da tarefa na Conferência, sem devolver ao jurídico.
-- Cada ajuste fica registrado na própria tarefa: quem fez, quando e o que mudou.
alter table public.vistagem_agendamentos
  add column if not exists ajustes jsonb;

comment on column public.vistagem_agendamentos.ajustes is
  'Ajustes feitos na Conferência: [{ por, em, mudancas: [{ campo, de, para }] }]. Null: a tarefa está como o jurídico vistou.';
