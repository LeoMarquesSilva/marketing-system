-- Favoritos da tela inicial: atalhos que a pessoa escolhe (módulos "m:<id>" e
-- ferramentas da área "l:<id>"). NULL = nunca personalizou (a tela sugere os primeiros).
alter table public.users
  add column if not exists home_favorites text[];

comment on column public.users.home_favorites is
  'Atalhos favoritos da tela inicial (m:<módulo>, l:<link>); null = nunca personalizou.';
