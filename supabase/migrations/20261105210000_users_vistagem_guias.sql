-- Guia (tour) de cada aba da Vistagem: quais a pessoa já viu, com a data ({"vistagem": "2026-11-05T18:00:00Z", ...}).
-- O guia abre sozinho na primeira vez que a pessoa entra na aba; depois, só pelo "Ver guia" do cabeçalho.
-- Sem a coluna, o Orquestra guarda no navegador (o guia volta a abrir em outro computador).

alter table public.users
  add column if not exists vistagem_guias jsonb not null default '{}'::jsonb;

comment on column public.users.vistagem_guias is
  'Guias da Vistagem já vistos pela pessoa: {aba: data ISO}. Abas: visao-geral, gestao, triagem, duplicidades, vistagem, conferencia, check, configuracoes.';
