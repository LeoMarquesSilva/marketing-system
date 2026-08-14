ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS minhas_fotos_tutorial_completed_at timestamptz;

COMMENT ON COLUMN public.users.minhas_fotos_tutorial_completed_at IS
  'Quando o usuário concluiu ou pulou o tour guiado de Minhas fotos.';
