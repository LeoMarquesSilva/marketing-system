-- Controle de acesso por usuário: troca de senha obrigatória + permissões por seção.
alter table public.users
  add column if not exists must_change_password boolean default false,
  add column if not exists permissions text[];

comment on column public.users.must_change_password is
  'Quando true, o usuário é obrigado a trocar a senha no próximo login.';
comment on column public.users.permissions is
  'Seções (rotas) que o usuário pode acessar. null = comportamento legado por role/department.';
