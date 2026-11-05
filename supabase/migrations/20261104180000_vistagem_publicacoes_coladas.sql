-- Vistagem: publicações coladas de e-mail ou Teams (Captura › Colar publicações), para as poucas demandas que
-- não vêm na Kurier. Cada colagem entra como um "arquivo" de origem 'colado', com o texto original guardado, e as
-- publicações seguem a mesma esteira (duplicidade, triagem, Controladoria, Jurídico).
alter table public.vistagem_kurier_arquivos drop constraint if exists vistagem_kurier_arquivos_origem_check;
alter table public.vistagem_kurier_arquivos
  add constraint vistagem_kurier_arquivos_origem_check check (origem = any (array['sharepoint', 'upload', 'colado']));

alter table public.vistagem_kurier_arquivos
  add column if not exists texto_colado text;

comment on column public.vistagem_kurier_arquivos.texto_colado is
  'Texto colado na Captura (origem colado), como veio do e-mail ou do Teams.';
