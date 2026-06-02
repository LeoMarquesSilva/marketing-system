-- Dica de performance (cruzamento com Instagram) exibida ao colaborador no card do post.
alter table public.content_roteiros
  add column if not exists performance_hint text;

comment on column public.content_roteiros.performance_hint is
  'Dica curta gerada a partir da performance histórica do Instagram da área, exibida ao colaborador.';
