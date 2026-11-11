-- De onde vieram os dias ou a data fatal do Prazo (pedido de 11/11/2026): a Conferência mostra, embaixo de
-- "30 dias úteis após a publicação", se a pessoa usou os botões de dias ou escolheu a data no calendário.
--
--   atalho       botões de dias (5, 10, 15, 30…)
--   calendario   data fatal escolhida no calendário
--   tarefa       prazo legal que a tarefa traz sozinha ao ser escolhida
--   publicacao   "Usar N dias" do leitor da publicação
--   sugestao_ia  "Usar sugestão" da IA
--
-- Nula nas tarefas vistadas antes desta coluna, nas que não são de Prazo e quando a fatal muda na Conferência.

alter table public.vistagem_agendamentos add column if not exists origem_prazo text;

alter table public.vistagem_agendamentos drop constraint if exists vistagem_agendamentos_origem_prazo_check;
alter table public.vistagem_agendamentos
  add constraint vistagem_agendamentos_origem_prazo_check
  check (origem_prazo is null or origem_prazo in ('atalho', 'calendario', 'tarefa', 'publicacao', 'sugestao_ia'));

comment on column public.vistagem_agendamentos.origem_prazo is
  'Prazo: de onde vieram os dias ou a fatal (atalho, calendario, tarefa, publicacao, sugestao_ia); null = não se sabe.';

notify pgrst, 'reload schema';
