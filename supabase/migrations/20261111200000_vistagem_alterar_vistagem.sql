-- Alterar a vistagem antes da Conferência (pedido de 11/11/2026).
--
-- conferencia_aberta_por/em: a controladoria abriu (ou ajustou) a publicação na Conferência. Por 10 minutos, renovados
--   pela tela enquanto ela estiver aberta, o jurídico não consegue reabrir: se as duas pessoas agirem ao mesmo tempo,
--   vale a decisão da controladoria.
-- reaberta_por/em: quem vistou reabriu a vistagem para alterar (a publicação volta para "A vistar" com as tarefas).

alter table public.vistagem_publicacoes add column if not exists conferencia_aberta_por uuid;
alter table public.vistagem_publicacoes add column if not exists conferencia_aberta_em timestamptz;
alter table public.vistagem_publicacoes add column if not exists reaberta_por uuid;
alter table public.vistagem_publicacoes add column if not exists reaberta_em timestamptz;

comment on column public.vistagem_publicacoes.conferencia_aberta_em is
  'Última vez que a controladoria abriu ou ajustou a publicação na Conferência; por 10 min o jurídico não reabre a vistagem.';
comment on column public.vistagem_publicacoes.reaberta_em is
  'Quem vistou reabriu a vistagem para alterar antes da Conferência (volta para A vistar).';

notify pgrst, 'reload schema';
