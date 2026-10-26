-- Vistagem: papel e áreas de cada usuário (Usuários › acesso) e transferência de área.

-- controladoria: todas as abas e áreas; juridico: só a aba Jurídico, nas áreas marcadas.
-- Sem papel (e admin), vale controladoria.
alter table public.users
  add column if not exists vistagem_papel text,
  add column if not exists vistagem_areas text[];
alter table public.users drop constraint if exists users_vistagem_papel_check;
alter table public.users
  add constraint users_vistagem_papel_check check (vistagem_papel is null or vistagem_papel in ('controladoria', 'juridico'));
comment on column public.users.vistagem_papel is
  'Vistagem e agendamento: controladoria (todas as abas e áreas) ou juridico (só a aba Jurídico, nas vistagem_areas). Null = controladoria.';
comment on column public.users.vistagem_areas is
  'Vistagem: escritórios (escritorio_responsavel) que o usuário do jurídico vista.';

-- Última transferência da publicação para a fila de outra área, feita no Orquestra.
alter table public.vistagem_publicacoes
  add column if not exists transferido_de text,
  add column if not exists transferido_por uuid references auth.users(id) on delete set null,
  add column if not exists transferido_em timestamptz,
  add column if not exists transferencia_motivo text;
