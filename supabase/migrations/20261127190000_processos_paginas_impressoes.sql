-- Processos: a leitura dos autos pela IA não lê de novo a página que já leu.
--
-- O robô baixa os autos inteiros a cada pedido, e o mesmo processo chega pelo e-SAJ, pelo eproc e pelo Jus.br:
-- o PDF novo repete quase todo o anterior. Cada documento guarda as marcas (hash do texto) das páginas que a IA
-- leu nele; na leitura do PDF seguinte do mesmo processo, as páginas de texto idêntico ficam de fora.
-- Documento lido antes desta coluna fica com ela vazia (as páginas dele são lidas de novo uma vez).

alter table public.proc_documentos add column if not exists paginas_impressoes text[];

comment on column public.proc_documentos.paginas_impressoes is
  'Marcas (hash) do texto das páginas que a IA leu neste PDF. A leitura de outro PDF do mesmo processo pula as páginas de texto idêntico.';
