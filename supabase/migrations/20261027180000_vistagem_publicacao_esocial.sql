-- Vistagem: classificação "PUBLICAÇÃO - ESOCIAL" das publicações trabalhistas, escolhida pelo jurídico.
-- Não vai para o VIOS; os valores são os da BKP (SIOE sp_publicacoes.publicacao_esocial).
alter table public.vistagem_publicacoes add column if not exists publicacao_esocial text;
alter table public.vistagem_publicacoes drop constraint if exists vistagem_publicacoes_publicacao_esocial_check;
alter table public.vistagem_publicacoes
  add constraint vistagem_publicacoes_publicacao_esocial_check check (
    publicacao_esocial is null or publicacao_esocial in (
      'Não Identificado',
      'Sentença – Conhecimento',
      'Acordo homologado',
      'Homologação de cálculo',
      'Acórdão – Conhecimento',
      'Trânsito em julgado',
      'Deferimento de tutela'
    )
  );
comment on column public.vistagem_publicacoes.publicacao_esocial is
  'Trabalhista: classificação eSocial da publicação (mesmos valores da BKP). Acordo homologado e Homologação de cálculo pedem também a tarefa INSERIR E-SOCIAL no VIOS. Null nas outras áreas.';
