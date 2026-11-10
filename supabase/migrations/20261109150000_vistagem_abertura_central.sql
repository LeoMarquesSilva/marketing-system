-- Publicação sem pasta no VIOS: depois da vistagem do jurídico vai para a Central do SharePoint (lista SOLICITAÇÃO DE
-- AGENDAMENTOS E REAGENDAMENTOS) como pedido de abertura de pasta, em vez de seguir para a conferência e o robô.
alter table public.vistagem_publicacoes
  drop constraint if exists vistagem_publicacoes_status_check;
alter table public.vistagem_publicacoes
  add constraint vistagem_publicacoes_status_check check (status in (
    'captada', 'duplicidade', 'descartada', 'triagem_pendente', 'juridico_vistar',
    'controladoria_vistar', 'pronto_para_agendar', 'agendado', 'checado', 'revisar',
    'abertura_pasta'
  ));

alter table public.vistagem_publicacoes
  add column if not exists central_item_id text,
  add column if not exists central_enviada_em timestamptz,
  add column if not exists central_erro text,
  add column if not exists central_tentativa_em timestamptz;

comment on column public.vistagem_publicacoes.central_item_id is 'Id do item criado na Central do SharePoint (abertura de pasta).';
comment on column public.vistagem_publicacoes.central_erro is 'Último erro ao criar o item na Central; a Conferência mostra e o cron tenta de novo.';
