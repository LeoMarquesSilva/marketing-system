-- Vistagem: ação, fase processual e valor da ação da pasta (processos_completo do SIOE, vindos do relatório
-- "BASE GERAL DE PROCESSOS - OPS LEGAIS" do VIOS), gravados na triagem com o resto da pasta para o cabeçalho do jurídico.
alter table public.vistagem_publicacoes add column if not exists acao_processo text;
alter table public.vistagem_publicacoes add column if not exists fase_processual text;
alter table public.vistagem_publicacoes add column if not exists valor_acao numeric(16, 2);
alter table public.vistagem_publicacoes add column if not exists valor_acao_atualizado numeric(16, 2);
comment on column public.vistagem_publicacoes.acao_processo is
  'Ação da pasta no VIOS (processos_completo.acao do SIOE), ex.: Reclamação Trabalhista. Retrato da triagem.';
comment on column public.vistagem_publicacoes.fase_processual is
  'Fase da pasta no VIOS (processos_completo.fase_processual do SIOE), ex.: Execução. Retrato da triagem.';
comment on column public.vistagem_publicacoes.valor_acao is
  'Valor da ação (da causa) da pasta no VIOS (processos_completo.valor_acao do SIOE). Retrato da triagem.';
comment on column public.vistagem_publicacoes.valor_acao_atualizado is
  'Valor da ação atualizado da pasta no VIOS (processos_completo.valor_acao_atualizado do SIOE). Retrato da triagem.';
