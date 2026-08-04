ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS newsletter_tutorial_completed_at timestamptz;

COMMENT ON COLUMN public.users.newsletter_tutorial_completed_at IS
  'Quando o usuário concluiu o tour guiado da Newsletter.';
