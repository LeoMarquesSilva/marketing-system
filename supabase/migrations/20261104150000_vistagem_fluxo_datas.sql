-- Vistagem: datas do Fluxo do VIOS mudadas pelo jurídico (ex.: o VIOS dá 5 dias e a pessoa prioriza em 2).
-- [{ "caminho": ["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"], "data": "AAAA-MM-DD" }]: o caminho são os tipos desde a
-- tarefa agendada até a do fluxo. Na validação, o Orquestra manda ao robô essas datas (e as das tarefas que nascem
-- delas), e o robô grava no VIOS depois de lançar.
alter table public.vistagem_agendamentos
  add column if not exists fluxo_datas jsonb;

comment on column public.vistagem_agendamentos.fluxo_datas is
  'Datas do Fluxo do VIOS escolhidas pelo jurídico: [{caminho: tipos desde a tarefa agendada, data: AAAA-MM-DD}].';
