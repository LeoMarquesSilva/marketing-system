-- Vistagem: quem vistou de novo depois de uma devolução da conferência. "vistado_por" fica com quem analisou
-- primeiro (é quem errou, e para quem a devolução volta); revistado_por/em guardam a última vistagem depois
-- da devolução (ex.: a controladoria corrige e vista ela mesma para a publicação não ficar parada).
alter table public.vistagem_publicacoes
  add column if not exists revistado_por uuid references auth.users(id) on delete set null,
  add column if not exists revistado_em timestamptz;

comment on column public.vistagem_publicacoes.revistado_por is
  'Quem vistou de novo depois da devolução da conferência (vistado_por continua com quem vistou primeiro).';
comment on column public.vistagem_publicacoes.revistado_em is
  'Quando foi vistada de novo depois da devolução da conferência.';
