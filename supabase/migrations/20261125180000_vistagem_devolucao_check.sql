-- Devolução do Check para a Vistagem (pedido de 25/11/2026, 2041725-27.2026.8.26.0000).
--
-- No Check, depois de "Encontrei erro", a Operações Legais pode devolver a publicação para a Vistagem: o robô cancela
-- no VIOS todas as tarefas que tinha agendado (tipo INCONSISTÊNCIA NA VISTAGEM), as tarefas voltam preenchidas para o
-- jurídico corrigir e a publicação volta para "A vistar" da área, com a faixa amarela.
--
-- devolucao_origem: de onde veio a última devolução ('conferencia' ou 'check'); a faixa amarela diz qual.
-- agendamentos_cancelados: o que foi agendado e cancelado em cada devolução do Check, para o Histórico e o aviso da
--   Vistagem. Lista de { em, por, motivo, inconsistencia_id, tarefas: [...], cancelamentos: [{ sama_id, cis }] }.

alter table public.vistagem_publicacoes
  add column if not exists devolucao_origem text,
  add column if not exists agendamentos_cancelados jsonb;

alter table public.vistagem_publicacoes drop constraint if exists vistagem_publicacoes_devolucao_origem_check;
alter table public.vistagem_publicacoes
  add constraint vistagem_publicacoes_devolucao_origem_check
  check (devolucao_origem is null or devolucao_origem in ('conferencia', 'check'));

comment on column public.vistagem_publicacoes.devolucao_origem is
  'De onde veio a última devolução para a Vistagem: conferencia (controladoria) ou check (Operações Legais).';
comment on column public.vistagem_publicacoes.agendamentos_cancelados is
  'Devoluções do Check: as tarefas que estavam no VIOS e os pedidos de cancelamento ao robô (fila do SAMA).';

-- As devoluções da Conferência feitas antes desta coluna.
update public.vistagem_publicacoes
   set devolucao_origem = 'conferencia'
 where devolucao_origem is null
   and devolvido_em is not null;

notify pgrst, 'reload schema';
