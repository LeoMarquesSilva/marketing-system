-- Vistagem: sugestão da IA (Trabalhista) para o jurídico e se ela foi usada.
alter table public.vistagem_publicacoes add column if not exists sugestao_ia jsonb;
alter table public.vistagem_publicacoes add column if not exists sugestao_ia_em timestamptz;
alter table public.vistagem_publicacoes add column if not exists sugestao_ia_resultado text;
alter table public.vistagem_publicacoes drop constraint if exists vistagem_publicacoes_sugestao_ia_resultado_check;
alter table public.vistagem_publicacoes
  add constraint vistagem_publicacoes_sugestao_ia_resultado_check check (
    sugestao_ia_resultado is null or sugestao_ia_resultado in ('nao_usada', 'usada', 'usada_com_alteracao')
  );
comment on column public.vistagem_publicacoes.sugestao_ia is
  'Sugestão da IA para a vistagem (resumo, tarefas da lista do VIOS, eSocial, confiança, modelo, custo). Só Trabalhista; o jurídico decide se usa.';
comment on column public.vistagem_publicacoes.sugestao_ia_resultado is
  'Ao enviar a vistagem: nao_usada, usada (enviada igual à sugestão) ou usada_com_alteracao. Mede o acerto da IA.';
