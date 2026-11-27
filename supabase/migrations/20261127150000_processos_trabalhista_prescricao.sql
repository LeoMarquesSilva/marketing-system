-- Prescrição no saneamento trabalhista: a do processo (quinquenal com o marco, bienal, intercorrente) e a de cada
-- pedido. Situação = se foi arguida e o que a decisão fez com ela. Só acrescenta colunas.

alter table public.proc_trabalhista
  add column if not exists prescricao_quinquenal text,
  add column if not exists prescricao_quinquenal_marco date,
  add column if not exists prescricao_bienal text,
  add column if not exists prescricao_intercorrente text,
  add column if not exists prescricao_detalhe text;

alter table public.proc_trabalhista drop constraint if exists proc_trabalhista_prescricao_check;
alter table public.proc_trabalhista
  add constraint proc_trabalhista_prescricao_check check (
    (prescricao_quinquenal is null or prescricao_quinquenal in ('nao_alegada', 'alegada', 'acolhida', 'acolhida_em_parte', 'rejeitada'))
    and (prescricao_bienal is null or prescricao_bienal in ('nao_alegada', 'alegada', 'acolhida', 'acolhida_em_parte', 'rejeitada'))
    and (prescricao_intercorrente is null or prescricao_intercorrente in ('nao_alegada', 'alegada', 'acolhida', 'acolhida_em_parte', 'rejeitada'))
  );

comment on column public.proc_trabalhista.prescricao_quinquenal_marco is
  'Parcelas anteriores a esta data estão prescritas (5 anos antes do ajuizamento, ou o marco que a decisão fixou). Limita o período do adicional no cálculo do risco.';

alter table public.proc_trab_pedidos
  add column if not exists prescricao text check (prescricao is null or prescricao in ('nao_alegada', 'alegada', 'acolhida', 'acolhida_em_parte', 'rejeitada')),
  add column if not exists prescricao_marco date;

comment on column public.proc_trab_pedidos.prescricao is
  'Prescrição do pedido: se foi arguida e o que a decisão fez com ela (com o marco em prescricao_marco).';
