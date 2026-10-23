-- Vistagem: a tarefa passa a ter três classes, iguais à etiqueta do tipo no VIOS:
-- PRAZO (ENVIAR), PROVIDENCIA (PROVIDÊNCIA) e COMPROMISSO (audiência, perícia, leilão…).
alter table public.vistagem_agendamentos drop constraint if exists vistagem_agendamentos_etiqueta_check;
alter table public.vistagem_agendamentos
  add constraint vistagem_agendamentos_etiqueta_check check (etiqueta in ('PRAZO', 'PROVIDENCIA', 'COMPROMISSO'));
