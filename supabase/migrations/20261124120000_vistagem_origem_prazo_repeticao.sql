-- COMPROVAR PAGAMENTO todo mês (pedido de 24/11/2026): a pessoa marca a fatal e quantas vezes a tarefa vai ao VIOS;
-- as dos meses seguintes são gravadas com a origem nova da fatal:
--
--   repeticao    repetição mensal da primeira fatal (mesmo dia do mês; sem ele, o último; sem expediente, o dia útil anterior)
--
-- Rodar antes de subir o código: sem ela, gravar uma vistagem com repetição falha nesta restrição.

alter table public.vistagem_agendamentos drop constraint if exists vistagem_agendamentos_origem_prazo_check;
alter table public.vistagem_agendamentos
  add constraint vistagem_agendamentos_origem_prazo_check
  check (origem_prazo is null or origem_prazo in ('atalho', 'calendario', 'tarefa', 'publicacao', 'sugestao_ia', 'repeticao'));

comment on column public.vistagem_agendamentos.origem_prazo is
  'Prazo: de onde vieram os dias ou a fatal (atalho, calendario, tarefa, publicacao, sugestao_ia, repeticao); null = não se sabe.';

notify pgrst, 'reload schema';
