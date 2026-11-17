-- Processos: download incremental dos autos do eproc.
--
-- O robô do eproc baixa os autos peça por peça. Cada documento guarda as peças que vieram nele
-- ("evento:nome", ex.: "12:PET1"); no pedido seguinte do mesmo processo, o robô recebe a lista das peças já
-- baixadas e traz só as novas. Documento antigo, do e-SAJ ou anexado à mão fica com a lista vazia.

alter table public.proc_documentos add column if not exists pecas text[];

comment on column public.proc_documentos.pecas is
  'Peças dos autos do eproc contidas neste PDF ("evento:nome"). O próximo pedido ao robô baixa só as que ainda não vieram.';
