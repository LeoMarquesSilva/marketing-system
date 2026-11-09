-- Vistagem: data limite própria da SESSÃO DE JULGAMENTO (pedido de 09/11/2026).
-- A sessão é num dia e o prazo da tarefa pode ir além: o jurídico (ou a Conferência, no lápis) escolhe a data limite,
-- que começa igual à data. O robô a põe na Data limite (prazo_fatal) do lançamento. Nos outros tipos fica null.
alter table public.vistagem_agendamentos
  add column if not exists data_limite date;

comment on column public.vistagem_agendamentos.data_limite is
  'SESSÃO DE JULGAMENTO: Data limite no VIOS (a data para conclusão ou depois). Null nos outros tipos e nas antigas: vale a própria data.';

notify pgrst, 'reload schema';
