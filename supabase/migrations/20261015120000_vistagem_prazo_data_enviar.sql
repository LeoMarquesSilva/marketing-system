-- PRAZO: o VIOS recebe a data do Enviar (fatal − 3 dias úteis); o fluxo automático
-- do VIOS cria o Revisar e o Protocolar (+1 dia útil cada).
comment on column public.vistagem_agendamentos.data_fatal is
  'PRAZO: data fatal. A tarefa vai ao VIOS com a data do Enviar (fatal − 3 dias úteis), gravada em data; o VIOS cria Revisar e Protocolar.';
