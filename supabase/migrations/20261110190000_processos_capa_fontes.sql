-- Processos: capa completada por fontes oficiais, sempre como sugestão.
--
-- A capa que vem do VIOS não tem cidade, justiça, jurisdição nem último andamento. Esses dados passam a ser
-- propostos a partir do próprio número CNJ (justiça, UF, grau) e do DataJud, a API pública do CNJ (órgão
-- julgador, município, ajuizamento, sigilo, formato e movimentações). Como as sugestões da IA, nada é gravado
-- sem uma pessoa aprovar.

-- De onde veio a sugestão: leitura dos autos pela IA, DataJud ou regra do número CNJ.
alter table public.proc_sugestoes
  add column if not exists fonte text not null default 'autos' check (fonte in ('autos', 'datajud', 'cnj'));

comment on column public.proc_sugestoes.fonte is
  'autos: lida pela IA no PDF (página e trecho); datajud: API pública do CNJ; cnj: deduzida do número do processo.';

-- O histórico registra a fonte da sugestão aprovada.
alter table public.proc_alteracoes drop constraint if exists proc_alteracoes_origem_check;
alter table public.proc_alteracoes
  add constraint proc_alteracoes_origem_check check (origem in ('manual', 'vios', 'ia', 'datajud', 'cnj'));

-- Controle da consulta ao DataJud (a consulta em lote retoma pelos que ainda não foram consultados).
alter table public.proc_processos
  add column if not exists datajud_consultado_em timestamptz,
  add column if not exists datajud_erro text;

comment on column public.proc_processos.datajud_consultado_em is 'Última consulta ao DataJud para completar a capa.';
comment on column public.proc_processos.datajud_erro is 'Por que a última consulta não trouxe nada (processo fora do DataJud, tribunal sem índice, falha).';
