-- Processos, Etapa 2: o PDF dos autos é temporário.
--
-- Com milhares de processos não há por que guardar todos os PDFs. O arquivo fica no bucket só enquanto
-- houver sugestão da IA a conferir (a pessoa abre o PDF na página do trecho) e sai quando a última é
-- decidida ou depois de alguns dias (PROCESSOS_AUTOS_DIAS, 7 por padrão). O registro do documento e as
-- sugestões, com página e trecho, permanecem.

alter table public.proc_documentos add column if not exists arquivo_removido_em timestamptz;

comment on column public.proc_documentos.arquivo_removido_em is
  'Quando o PDF foi excluído do bucket (todas as sugestões decididas ou prazo de guarda vencido). Nulo: o arquivo ainda está guardado.';

create index if not exists proc_documentos_guardados_idx
  on public.proc_documentos (criado_em)
  where arquivo_removido_em is null;
