-- Processos: a leitura dos autos também sugere os itens da Rec. Crédito (título, citação, pedido de execução,
-- guia paga ou valor levantado). Tipo "rec_credito", com `campo` dizendo qual item; aprovada, a sugestão vira
-- linha em proc_titulos, proc_citacoes, proc_pedidos_execucao ou proc_lancamentos, com origem "autos".

alter table public.proc_sugestoes drop constraint if exists proc_sugestoes_tipo_check;
alter table public.proc_sugestoes
  add constraint proc_sugestoes_tipo_check
  check (tipo in ('campo', 'parte_nova', 'parte_documento', 'parte_oab', 'parte_endereco', 'parte_contato', 'rec_credito'));

alter table public.proc_sugestoes drop constraint if exists proc_sugestoes_alvo;
alter table public.proc_sugestoes
  add constraint proc_sugestoes_alvo check (
    (tipo = 'campo' and campo is not null)
    or (tipo = 'parte_nova')
    or (tipo in ('parte_documento', 'parte_oab', 'parte_endereco', 'parte_contato') and parte_id is not null)
    or (tipo = 'rec_credito' and campo in ('titulo', 'citacao', 'pedido', 'lancamento'))
  );

comment on column public.proc_sugestoes.tipo is
  'campo: valor de um campo do cadastro. parte_nova: pessoa que não está no processo (sócio, fiador, advogado). parte_*: dado que falta numa parte já cadastrada. rec_credito: item da Rec. Crédito (campo = titulo, citacao, pedido ou lancamento).';
