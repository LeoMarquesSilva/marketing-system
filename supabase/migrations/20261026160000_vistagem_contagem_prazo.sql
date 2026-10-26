-- Vistagem: o atalho de dias do Prazo conta em dias úteis ou corridos (escolha do jurídico no modal).
alter table public.vistagem_agendamentos add column if not exists contagem_prazo text;
alter table public.vistagem_agendamentos drop constraint if exists vistagem_agendamentos_contagem_prazo_check;
alter table public.vistagem_agendamentos
  add constraint vistagem_agendamentos_contagem_prazo_check check (contagem_prazo is null or contagem_prazo in ('uteis', 'corridos'));
-- Até aqui os atalhos só contavam dias úteis.
update public.vistagem_agendamentos set contagem_prazo = 'uteis' where dias_prazo is not null and contagem_prazo is null;
comment on column public.vistagem_agendamentos.contagem_prazo is
  'PRAZO com atalho de dias: uteis ou corridos (corridos: começa no 1º dia útil após a publicação, recesso suspende, vencimento em dia sem expediente vai ao próximo dia útil). Null quando a fatal foi escolhida no calendário.';
