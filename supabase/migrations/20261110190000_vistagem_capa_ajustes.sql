-- Abertura de pasta (Triagem Manual, pendência "sem pasta"): a controladoria edita os campos da capa que vai para o
-- VIOS. Cada edição fica por cima do que veio das fontes (DJEN, e-SAJ, DataJud, triagem), com quem e quando.
alter table public.vistagem_publicacoes
  add column if not exists capa_ajustes jsonb not null default '{}'::jsonb;

comment on column public.vistagem_publicacoes.capa_ajustes is
  'Capa da abertura de pasta editada pela controladoria: { campo: { valor, por, porNome, em } }, por cima das fontes.';
