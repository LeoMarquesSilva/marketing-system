alter table public.users
  add column if not exists content_tutorial_completed_at timestamptz;

comment on column public.users.content_tutorial_completed_at is
  'Momento em que o colaborador de conteúdo concluiu o tutorial interativo de primeiro acesso.';

-- Não preencher usuários existentes: null = elegível ao tutorial no primeiro acesso pós-senha.
