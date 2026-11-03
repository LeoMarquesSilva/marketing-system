-- Vistagem: sugestão para a publicação sem pasta no VIOS (possível abertura), que a controladoria confere.
-- Origem: processo citado no teor com pasta, parte que já é cliente ou, sem nada disso, a IA.
alter table public.vistagem_publicacoes add column if not exists sugestao_triagem jsonb;
comment on column public.vistagem_publicacoes.sugestao_triagem is
  'Sem pasta: dados sugeridos (escritório, grupo, demanda de risco, pasta de referência, motivo, confiança, origem numero/parte/ia). Pré-preenche a resolução na aba Controladoria.';
