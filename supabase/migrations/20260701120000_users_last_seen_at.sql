ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN public.users.last_seen_at IS 'Última vez que o usuário abriu o sistema com sessão ativa (atualizado periodicamente).';

UPDATE public.users u
SET last_seen_at = GREATEST(au.last_sign_in_at, au.updated_at)
FROM auth.users au
WHERE u.auth_id = au.id
  AND u.last_seen_at IS NULL
  AND (au.last_sign_in_at IS NOT NULL OR au.updated_at IS NOT NULL);
