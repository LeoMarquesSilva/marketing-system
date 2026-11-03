-- Vistagem (Check): como as tarefas ficaram no VIOS depois do lançamento — a pedida e as que o
-- fluxo automático criou, com tipo, datas, hora e responsáveis (resultado.tarefas_vios do robô).
alter table public.vistagem_agendamentos add column if not exists vios_tarefas jsonb;
comment on column public.vistagem_agendamentos.vios_tarefas is
  'Lista [{ci, tipo, principal, data, dataLimite, hora, responsaveis}] lida no VIOS pelo robô após gravar (datas AAAA-MM-DD).';
