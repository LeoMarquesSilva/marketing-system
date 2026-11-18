-- "Já falamos disso?": na busca, a IA compara a notícia com o que já publicamos no
-- Instagram e com as matérias que a equipe escolheu, e marca se é assunto novo,
-- repetição (sem fato novo) ou desdobramento (mesmo caso com fato novo).
alter table public.content_roteiros
  add column if not exists related_kind text check (related_kind in ('novo', 'repetido', 'desdobramento')),
  add column if not exists related_note text,
  add column if not exists related_ref jsonb;

comment on column public.content_roteiros.related_kind is 'novo | repetido | desdobramento (em relação ao que já publicamos/escolhemos)';
comment on column public.content_roteiros.related_note is 'No desdobramento: o que há de novo desde o nosso post.';
comment on column public.content_roteiros.related_ref is 'Post do Instagram ou matéria escolhida a que se refere: {source, id, title, url, date}.';
